const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { docText } = JSON.parse(event.body);
        if (!docText) throw new Error("No document text was sent.");

        const apiKey = process.env.GOOGLE_API_KEY;
        const genAI = new GoogleGenerativeAI(apiKey);
        
        // Use 1.5-flash if you are strictly on the Free Tier to avoid 429s
        // If you need 2.0-flash, you MUST enable billing in Google AI Studio
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `Convert the following text to a JSON array of questions:
        [{"question": "...", "options": ["A", "B", "C", "D"], "answer": "..."}]
        Text: ${docText}`;

        const result = await model.generateContent(prompt);
        let output = result.response.text();
        output = output.replace(/```json/g, '').replace(/```/g, '').trim();

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: output
        };

    } catch (error) {
        console.error("Backend Error:", error.message);
        
        // Specifically detect Quota limits
        const status = error.message.includes("429") ? 429 : 500;
        const message = error.message.includes("429") 
            ? "API Quota exceeded. Please enable billing in Google AI Studio or wait." 
            : error.message;

        return {
            statusCode: status,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: message })
        };
    }
};