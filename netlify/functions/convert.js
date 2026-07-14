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
        
        CRITICAL MATH INSTRUCTIONS:
        - Preserve ALL mathematical symbols, equations, and LaTeX format (e.g., $t^2$, $\\sqrt{x}$, etc.) exactly as written. 
        - Do not strip characters or attempt to simplify/explain the math. Keep the original text for the "question_text".

        JSON STRUCTURE RULES:
        - Return an object with a key "questions" which is an array.
        - Each object MUST follow this specific key structure:
          "question_number": (Integer)
          "paragraph_text": (String, or empty string if standalone)
          "question_text": (String, including all original math formatting)
          "option_a": (String)
          "option_b": (String)
          "option_c": (String)
          "option_d": (String)
          "correct_answer": (String: 'a', 'b', 'c', or 'd' ONLY)
        
        Return ONLY valid JSON.
        
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