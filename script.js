// --- UI NAVIGATION LOGIC ---
document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('active');
});

function showSection(sectionId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    document.getElementById('sidebar').classList.remove('active');
}

// --- CONVERTER LOGIC ---
let generatedJson = null;
const fileDisplay = document.getElementById('file-name-display');
const progressContainer = document.getElementById('progress-container');
const progressBarFill = document.getElementById('progress-bar-fill');
const progressText = document.getElementById('progress-text');
const modal = document.getElementById('download-modal');
const closeModalBtn = document.getElementById('close-modal');

closeModalBtn.onclick = () => modal.classList.remove('active');
window.onclick = (event) => { if (event.target == modal) modal.classList.remove('active'); };

document.getElementById('file-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Update UI immediately
    fileDisplay.innerText = `Selected: ${file.name}`;
    fileDisplay.style.color = "#2563eb";
    
    progressBarFill.style.width = "0%";
    progressText.innerText = "Extracting text... 0%";
    progressContainer.style.display = "block";

    // Simulate progress
    let progress = 0;
    const progressInterval = setInterval(() => {
        if (progress < 90) {
            progress += Math.floor(Math.random() * 10) + 5;
            if (progress > 90) progress = 90;
            progressBarFill.style.width = `${progress}%`;
            progressText.innerText = `Processing with AI... ${progress}%`;
        }
    }, 300);

    try {
        const text = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async function(event) {
                try {
                    const result = await mammoth.extractRawText({ arrayBuffer: event.target.result });
                    resolve(result.value);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error("Failed to read file."));
            reader.readAsArrayBuffer(file);
        });

        const response = await fetch('/.netlify/functions/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ docText: text })
        });

        const json = await response.json().catch(() => null);

        if (!response.ok) {
            throw new Error(json?.error || 'Server conversion failed.');
        }

        generatedJson = json;
        
        // Finish progress
        clearInterval(progressInterval);
        progressBarFill.style.width = "100%";
        progressText.innerText = "Complete! 100%";

        // Show modal
        setTimeout(() => {
            progressContainer.style.display = "none";
            modal.classList.add('active');
        }, 500);

    } catch (error) {
        clearInterval(progressInterval);
        progressContainer.style.display = "none";
        fileDisplay.innerText = "Error: " + error.message;
        fileDisplay.style.color = "#dc2626";
    }
});

// --- DOWNLOAD LOGIC ---
document.getElementById('download-btn').addEventListener('click', () => {
    if (!generatedJson) return;
    
    let fileName = document.getElementById('filename-input').value.trim();
    if (fileName === "") fileName = "exam_data";
    
    const dataStr = JSON.stringify(generatedJson, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    modal.classList.remove('active');
});