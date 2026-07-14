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
        You are an expert Educational Content Engineer. Parse the provided exam text into a strict JSON structure.
        
        RULES:
        1. If the text has reading passages, include the full text of the passage in the "passage" field. If the question is standalone, set "passage" to null.
        2. Assign a sequential "id" to every question.
        3. Options MUST be a key-value object where keys are "A", "B", "C", "D".
        4. "correctOption" should only be the letter (e.g., "A").
        5. Return ONLY valid JSON.
        
        Schema:
        {
          "examTitle": "String",
          "questions": [
            {
              "id": Number,
              "passage": "String or null",
              "questionText": "String",
              "options": { "A": "String", "B": "String", "C": "String", "D": "String" },
              "correctOption": "A" | "B" | "C" | "D"
            }
          ]
        }
        
        Exam text to parse:
        ${docText}
        `;

        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            response_format: { type: "json_object" },
            temperature: 0.1
        });

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