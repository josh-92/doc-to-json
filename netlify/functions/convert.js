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

        const prompt = `
        You are an expert Exam Parsing Engine. Your goal is to convert exam text into a flat JSON array.

RULES FOR CLASSIFICATION:
1. If the text block is a reading passage (contains multiple sentences, introduces a topic, has no options), categorize it as "type": "passage".
   - Use "id": "I", "II", "III", etc. for these.
   - Combine all paragraphs of the passage into a single "content" string. Use \n\n to denote paragraph breaks inside that string.
2. If the text block is a question (has a number, question text, and A/B/C/D options), categorize it as "type": "question".

JSON STRUCTURE RULES:
- Return ONLY a JSON array [ ... ].
- Structure for "passage" objects:
  {
    "type": "passage",
    "id": "I", 
    "content": "Full text here..."
  }
- Structure for "question" objects:
  {
    "type": "question",
    "question_number": (Integer),
    "question_text": "Text including $t^2$ math notation",
    "option_a": "...",
    "option_b": "...",
    "option_c": "...",
    "option_d": "...",
    "correct_answer": "a" (or b, c, d)
  }

IMPORTANT:
- Keep the array order exactly as it appears in the source document.
- Do not add section wrapper objects.
- Preserve all LaTeX/math symbols ($...$) exactly.

Exam text to parse:
${docText}
        `;

        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            response_format: { type: "json_object" },
            temperature: 0.1
        });

        // The response body is the JSON string
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: chatCompletion.choices[0].message.content
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