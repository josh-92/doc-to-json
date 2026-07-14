// --- UI NAVIGATION LOGIC ---

document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('active');
});

function showSection(sectionId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    document.getElementById('sidebar').classList.remove('active');
}

// --- CONVERTER & FILE LOGIC ---

let generatedJson = null; // Store the data globally
const fileDisplay = document.getElementById('file-name-display');
const modal = document.getElementById('download-modal');
const closeModalBtn = document.getElementById('close-modal');

// Close modal logic
closeModalBtn.onclick = () => modal.style.display = "none";
window.onclick = (event) => { if (event.target == modal) modal.style.display = "none"; }

document.getElementById('file-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Show the user their file was accepted
    fileDisplay.innerText = `Uploaded: ${file.name}`;
    fileDisplay.style.color = "#2563eb"; // Blue color for success
    
    // Quick alert so they know processing has started
    alert("Converting your file... this might take a few seconds.");

    try {
        const reader = new FileReader();
        reader.onload = async function(event) {
            const arrayBuffer = event.target.result;
            const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
            const text = result.value; 

            // Send text to Netlify Function
            const response = await fetch('/.netlify/functions/convert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ docText: text })
            });

            if (!response.ok) throw new Error('Conversion failed on the server.');

            // Store JSON data
            generatedJson = await response.json();
            
            // Show the download popup!
            modal.style.display = "block";
        };
        reader.readAsArrayBuffer(file);
        
    } catch (error) {
        console.error("Error:", error);
        fileDisplay.innerText = "Error processing file.";
        fileDisplay.style.color = "#dc2626"; // Red color for error
        alert("Something went wrong: " + error.message);
    }
});

// --- DOWNLOAD LOGIC ---

document.getElementById('download-btn').addEventListener('click', () => {
    if (!generatedJson) return;

    // Get file name from input, default to 'exam_data' if empty
    let fileName = document.getElementById('filename-input').value.trim();
    if (fileName === "") fileName = "exam_data";

    // Convert JSON object to string
    const dataStr = JSON.stringify(generatedJson, null, 2);
    
    // Trigger the download natively in the browser
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName + '.json';
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Close modal after download
    modal.style.display = "none";
});