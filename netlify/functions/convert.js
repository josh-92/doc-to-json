const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { docText } = JSON.parse(event.body);
        if (!docText) throw new Error("No document text was sent to the server.");

        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) throw new Error("API key is missing in Netlify environment variables.");

        // Initialize the official Google SDK
        const genAI = new GoogleGenerativeAI(apiKey);
        
        // FIX: Specifying model with the stable v1 API path
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash"
        });

        const prompt = `You are an expert exam converter. Convert the following raw text extracted from an exam document into a clean, well-structured JSON array of question objects. 

Schema required:
[
  {
    "question": "Exact question text",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "answer": "Exact text of correct option"
  }
]

Return ONLY valid JSON. No markdown, no backticks.
Raw exam text:
${docText}`;

        // Call the API
        const result = await model.generateContent(prompt);
        let output = result.response.text();
        
        // Strip markdown if Gemini includes it
        output = output.replace(/```json/g, '').replace(/```/g, '').trim();

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(JSON.parse(output))
        };

    } catch (error) {
        console.error("Backend Error:", error.message);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: error.message })
        };
    }
};