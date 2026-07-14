// --- UI NAVIGATION LOGIC ---

// Toggle Sidebar (Hamburger Menu)
document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('active');
});

// Switch Pages (Converter, About, Donate)
function showSection(sectionId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    // Show the selected page
    document.getElementById(sectionId).classList.add('active');
    // Close the sidebar automatically
    document.getElementById('sidebar').classList.remove('active');
}


// --- CONVERTER LOGIC ---

document.getElementById('file-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    alert("Converting your file... this might take a few seconds.");

    try {
        // 1. Convert Word to plain text using Mammoth (via CDN) wrapped in a Promise
        const text = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async function(event) {
                try {
                    const arrayBuffer = event.target.result;
                    const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                    resolve(result.value);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error("Failed to read the file."));
            reader.readAsArrayBuffer(file);
        });

        // 2. Send text to your Netlify Function
        const response = await fetch('/.netlify/functions/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ docText: text })
        });

        // Safely parse the JSON response body
        const json = await response.json().catch(() => null);

        if (!response.ok) {
            // Extract the real server error message if sent by our backend
            const errorMsg = json?.details || json?.error || 'Conversion failed on the server.';
            throw new Error(errorMsg);
        }

        // 3. Success Feedback
        console.log("Here is your JSON for the exam portal:", json);
        alert("Conversion complete! Check the browser console (Right-click -> Inspect -> Console) for your JSON.");
        
    } catch (error) {
        console.error("Error during conversion:", error);
        alert("Something went wrong: " + error.message);
    }
});