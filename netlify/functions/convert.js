const Groq = require("groq-sdk");

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { docText } = JSON.parse(event.body);
        if (!docText) throw new Error("No document text provided.");

        // Use the new variable name
        const apiKey = process.env.GROQ_API_KEY; 
        if (!apiKey) throw new Error("GROQ_API_KEY is not set in Netlify settings!");

        const groq = new Groq({ apiKey: apiKey });

        const prompt = `You are an expert exam converter. Convert this raw text into a valid JSON array of question objects.

Schema required:
[
  {
    "question": "Exact question text",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "answer": "Exact text of correct option"
  }
]

Raw text to convert:
${docText}`;

        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            response_format: { type: "json_object" } 
        });

        // The response format from Groq with JSON object mode is a bit different
        // It returns a JSON string in the content
        const output = chatCompletion.choices[0].message.content;

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: output
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