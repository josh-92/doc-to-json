// netlify/functions/convert.js

exports.handler = async (event, context) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405, 
            body: 'Method Not Allowed' 
        };
    }

    try {
        const { docText } = JSON.parse(event.body);
        if (!docText) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'No document text provided.' })
            };
        }

        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Gemini API key is missing in Netlify environment variables!' })
            };
        }

        const prompt = `You are an expert exam converter. Convert the following raw text extracted from an exam document into a clean, well-structured JSON array of question objects. 

Each question object in the JSON array must follow this structure:
{
  "question": "Write the exact question text here",
  "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
  "answer": "Write the correct option text exactly matching one of the options (e.g., 'Option B text')"
}

Do not include any extra text, explanation, or markdown backticks (\`\`\`json). Return ONLY the raw JSON array.

Here is the raw exam text:
${docText}`;

        // Call Google's Gemini API directly using Node's native fetch
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            return {
                statusCode: response.status,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Gemini API error.', details: errText })
            };
        }

        const data = await response.json();
        
        // Defensive Check 1: Make sure we actually received candidate outputs
        if (!data.candidates || data.candidates.length === 0) {
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    error: 'Empty response from Gemini.', 
                    details: 'The prompt might have triggered a safety filter or failed to generate content.' 
                })
            };
        }

        const candidate = data.candidates[0];
        // Defensive Check 2: Verify candidate contains parts text
        if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    error: 'Gemini did not return text.', 
                    details: `Finish reason: ${candidate.finishReason || 'UNKNOWN'}` 
                })
            };
        }

        let geminiOutput = candidate.content.parts[0].text;
        
        // Sanitize output in case Gemini returns markdown blocks despite instructions
        geminiOutput = geminiOutput.replace(/```json/g, '').replace(/```/g, '').trim();

        // Validate that it's actually valid JSON before responding to the client
        const parsedJson = JSON.parse(geminiOutput);

        return {
            statusCode: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify(parsedJson)
        };

    } catch (error) {
        console.error('Error in convert function:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                error: 'Internal Server Error in Netlify Function', 
                details: error.message 
            })
        };
    }
};