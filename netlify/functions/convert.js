const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    try {
        const { docText } = JSON.parse(event.body);
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const systemPrompt = `
            You are an expert Educational Data Digitizer. Your task is to convert raw exam text into a strict, validated JSON array.
            
            IDENTIFICATION & ANSWERS:
            - Identify questions by looking for numbers (1., 1), (a), etc.
            - SCAN FOR ANSWER KEY: Look for sections labeled "Answer Key," "Answers," or a table. Map the correct answer to the "correct_answer" field. If none found, set to null.
            
            SCHEMA:
            [ { "id": 1, "paragraph": "...", "text": "...", "options": {"a": "...", "b": "...", "c": "...", "d": "..."}, "correct_answer": "a" } ]
            
            Output ONLY valid JSON. No markdown, no preamble.
        `;

        const result = await model.generateContent(systemPrompt + "\n\nTEXT TO CONVERT:\n" + docText);
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: result.response.text()
        };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};