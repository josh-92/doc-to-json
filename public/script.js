// --- UI NAVIGATION LOGIC ---

// Toggle Sidebar (Hamburger Menu)
document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('active');
});

// Switch Pages (Converter, About, Donate)
function showSection(sectionId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    document.getElementById('sidebar').classList.remove('active');
}

// --- CONVERTER & FILE DOWNLOAD LOGIC ---

let generatedJson = null; // Store output globally for download
const fileDisplay = document.getElementById('file-name-display');
const progressContainer = document.getElementById('progress-container');
const progressBarFill = document.getElementById('progress-bar-fill');
const progressText = document.getElementById('progress-text');
const modal = document.getElementById('download-modal');
const closeModalBtn = document.getElementById('close-modal');

// Close modal controls
closeModalBtn.onclick = () => {
    modal.classList.remove('active');
};
window.onclick = (event) => { 
    if (event.target == modal) {
        modal.classList.remove('active');
    } 
};

// File Upload Handler
document.getElementById('file-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Show the file name on-screen immediately so the user knows it's accepted!
    fileDisplay.innerText = `Selected: ${file.name}`;
    fileDisplay.style.color = "#2563eb"; // Accent blue
    
    // Reset and show progress bar
    progressBarFill.style.width = "0%";
    progressText.innerText = "Extracting raw Word text... 0%";
    progressContainer.style.display = "block";

    let progress = 0;
    // Simulate real visual progress while waiting on the API call
    const progressInterval = setInterval(() => {
        if (progress < 90) {
            progress += Math.floor(Math.random() * 12) + 4;
            if (progress > 90) progress = 90;
            progressBarFill.style.width = `${progress}%`;
            progressText.innerText = `Processing with AI... ${progress}%`;
        }
    }, 250);

    try {
        // 1. Read document buffer via Mammoth
        const reader = new FileReader();
        reader.onload = async function(event) {
            try {
                const arrayBuffer = event.target.result;
                const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                const text = result.value; 

                // 2. Transmit extracted text to Netlify Backend Function
                const response = await fetch('/.netlify/functions/convert', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ docText: text })
                });

                if (!response.ok) throw new Error('Conversion call failed.');

                // Store output
                generatedJson = await response.json();
                
                // Clear simulated progress timer and complete progress visual
                clearInterval(progressInterval);
                progressBarFill.style.width = "100%";
                progressText.innerText = "Complete! 100%";

                // Auto-show Custom Pop-Up after 400ms transition
                setTimeout(() => {
                    progressContainer.style.display = "none";
                    modal.classList.add('active');
                }, 400);

            } catch (innerError) {
                clearInterval(progressInterval);
                progressContainer.style.display = "none";
                fileDisplay.innerText = "Error processing content.";
                fileDisplay.style.color = "#dc2626"; // Error Red
                console.error(innerError);
            }
        };
        reader.readAsArrayBuffer(file);
        
    } catch (error) {
        clearInterval(progressInterval);
        progressContainer.style.display = "none";
        console.error("Error:", error);
        fileDisplay.innerText = "Failed to load file.";
        fileDisplay.style.color = "#dc2626";
    }
});

// Download Event Handler
document.getElementById('download-btn').addEventListener('click', () => {
    if (!generatedJson) return;

    // Grab user naming value or fall back to default
    let fileName = document.getElementById('filename-input').value.trim();
    if (fileName === "") fileName = "exam_data";

    // Format output string
    const dataStr = JSON.stringify(generatedJson, null, 2);
    
    // Construct local download link
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.json`;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup reference
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Hide download overlay card
    modal.classList.remove('active');
});