const Groq = require("groq-sdk");

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { docText } = JSON.parse(event.body);
        if (!docText) throw new Error("No document text provided.");

        const apiKey = process.env.GROQ_API_KEY; 
        if (!apiKey) throw new Error("GROQ_API_KEY is not set!");

        const groq = new Groq({ apiKey: apiKey });

        // Notice the JSON STRUCTURE requires a wrapper object {"questions": [...]} 
        // because response_format: { type: "json_object" } strictly requires a root object.
        const prompt = `
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

Raw exam text:
${docText}
        `;

        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            response_format: { type: "json_object" },
            temperature: 0.1
        });

        // Parse Groq's output
        const rawOutput = chatCompletion.choices[0].message.content;
        const parsedJson = JSON.parse(rawOutput);
        
        // Extract the array to send back a flat list to the frontend
        const questionsArray = parsedJson.questions || [];

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(questionsArray)
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