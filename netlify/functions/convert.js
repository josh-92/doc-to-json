const Groq = require("groq-sdk");

// Calls Groq once and returns the parsed { questions: [...] } object.
// Throws if the response isn't valid JSON (e.g. truncated mid-generation).
async function callGroq(groq, prompt) {
    const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.3-70b-versatile",
        response_format: { type: "json_object" },
        temperature: 0.1,
        // CRITICAL FIX: no max_tokens was set before, so long/dense batches
        // (lots of LaTeX, long option text) could hit the default output cap
        // mid-object. That produces truncated JSON -> JSON.parse throws ->
        // the whole batch (and, in the old frontend loop, every batch after it)
        // was lost. 8000 gives a 20-question batch plenty of headroom.
        max_tokens: 8000
    });

    const rawOutput = chatCompletion.choices[0].message.content;

    // finish_reason tells us if Groq cut the response short even before we
    // try to parse it — much more useful than waiting for JSON.parse to fail.
    const finishReason = chatCompletion.choices[0].finish_reason;
    if (finishReason === "length") {
        throw new Error("TRUNCATED: model hit max_tokens before finishing.");
    }

    return JSON.parse(rawOutput); // may throw SyntaxError on malformed JSON
}

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { docText, expectedNumbers } = JSON.parse(event.body);
        if (!docText) throw new Error("No document text provided.");

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) throw new Error("GROQ_API_KEY is not set!");

        const groq = new Groq({ apiKey: apiKey });

        const basePrompt = `
        You are an expert Exam Parsing Engine. Convert the following raw exam text into a strict JSON format.

RULES FOR CLASSIFICATION:
1. If the text block is a reading passage (a block of text meant to be read before answering questions, no options), categorize it as "type": "passage".
   - Use "id": "I", "II", "III", etc. (Roman Numerals) for these.
   - Combine all paragraphs of the passage into a single "content" string. Use \\n\\n for paragraph breaks.
2. If the text block is a question (has a number, text, and A/B/C/D options), categorize it as "type": "question".
3. For questions, set "type": "question", "question_number": X (use the number from the text).
JSON STRUCTURE REQUIRED:
{
  "questions": [
    {
      "type": "passage",
      "id": "I",
      "content": "Full text of the passage here..."
    },
    {
      "type": "question",
      "question_number": 1,
      "question_text": "Exact text of the question, preserving all LaTeX/math symbols (e.g. $t^2$) exactly.",
      "option_a": "Option A text",
      "option_b": "Option B text",
      "option_c": "Option C text",
      "option_d": "Option D text",
      "correct_answer": "a"
    }
  ]
}

IMPORTANT:
- Assign 'a', 'b', 'c', or 'd' to correct_answer (lowercase).
- Keep the array order exactly as it appears in the source document.
- Preserve all LaTeX/math symbols ($...$) exactly.
- Return ONLY valid JSON.
- Ensure every question object has the "question_number" field.

CRITICAL INSTRUCTION: You must process EVERY SINGLE question provided in the input text.
        Do not skip any questions, do not summarize, and do not omit questions to save space.
        If there are 20 questions in this batch, I expect 20 questions in the JSON output.
${docText}
        `;

        let parsedJson;
        let usedRetry = false;

        try {
            parsedJson = await callGroq(groq, basePrompt);
        } catch (firstError) {
            // One retry on truncation/malformed JSON before giving up on the batch.
            console.warn("First attempt failed, retrying once:", firstError.message);
            usedRetry = true;
            parsedJson = await callGroq(groq, basePrompt);
        }

        let questionsArray = parsedJson.questions || [];

        // Validation pass: if the frontend told us which question numbers it
        // expected in this batch, check for gaps. If any are missing, ask the
        // model specifically for the missing ones instead of silently
        // returning a partial batch.
        if (Array.isArray(expectedNumbers) && expectedNumbers.length > 0) {
            const returnedNumbers = new Set(
                questionsArray
                    .filter(q => q.type === "question")
                    .map(q => q.question_number)
            );
            const missing = expectedNumbers.filter(n => !returnedNumbers.has(n));

            if (missing.length > 0 && !usedRetry) {
                console.warn("Missing question numbers, requesting them explicitly:", missing);
                const followUpPrompt = `
${basePrompt}

NOTE: Your previous attempt on this exact text omitted question number(s): ${missing.join(", ")}.
Return the COMPLETE JSON again, including every one of those question numbers this time. Do not omit any question.
                `;
                try {
                    const retryJson = await callGroq(groq, followUpPrompt);
                    const retryQuestions = retryJson.questions || [];
                    // Merge: keep original results, fill in any that were missing.
                    const merged = [...questionsArray];
                    for (const q of retryQuestions) {
                        if (q.type === "question" && missing.includes(q.question_number)) {
                            merged.push(q);
                        }
                    }
                    questionsArray = merged;
                } catch (retryErr) {
                    console.warn("Follow-up retry for missing questions also failed:", retryErr.message);
                    // fall through and return what we have, plus a warning field
                }
            }
        }

        // Recompute what's still missing so the frontend can report it accurately
        // instead of silently dropping questions from the final file.
        let stillMissing = [];
        if (Array.isArray(expectedNumbers) && expectedNumbers.length > 0) {
            const finalReturned = new Set(
                questionsArray.filter(q => q.type === "question").map(q => q.question_number)
            );
            stillMissing = expectedNumbers.filter(n => !finalReturned.has(n));
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questions: questionsArray, missing: stillMissing })
        };

    } catch (error) {
        console.error("Groq Error:", error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: error.message })
        };
    }
};