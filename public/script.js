// ============================================================
// CONFIGURACIÓN INICIAL
// ============================================================
pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

function showLoading(show) {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.style.display = show ? 'block' : 'none';
}

function showStatus(elementId, message, isError = false) {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = message;
        el.style.color = isError ? '#d32f2f' : '#10b981';
    }
}

function downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function setupDropZone(zoneId, inputId, onFilesSelected) {
    const dropZone = document.getElementById(zoneId);
    const fileInput = document.getElementById(inputId);
    if (!dropZone || !fileInput) return;

    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            fileInput.files = e.dataTransfer.files;
            onFilesSelected(e.dataTransfer.files);
        }
    });
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', e => {
        if (e.target.files && e.target.files.length > 0) {
            onFilesSelected(e.target.files);
        }
    });
}

// ============================================================
// CAMBIO DE PESTAÑAS (RESPONSIVO Y LIMPIO)
// ============================================================
const tabs = document.querySelectorAll('.tab');
const panels = {
    merge: document.getElementById('mergePanel'),
    split: document.getElementById('splitPanel'),
    delete: document.getElementById('deletePanel'),
    extract: document.getElementById('extractPanel'),
    reorder: document.getElementById('reorderPanel'),
    compress: document.getElementById('compressPanel'),
    convert: document.getElementById('convertPanel')
};

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.tab;
        
        Object.keys(panels).forEach(key => {
            if (panels[key]) {
                if (key === target) {
                    panels[key].classList.add('active');
                    panels[key].style.display = 'block';
                } else {
                    panels[key].classList.remove('active');
                    panels[key].style.display = 'none';
                }
            }
        });
    });
});

// ============================================================
// PESTAÑA: CONVERTIR A PDF
// ============================================================
let convertFile = null;
const convertBtn = document.getElementById('convertBtn');
const convertText = document.getElementById('convertText');

setupDropZone('dropZoneConvert', 'fileInputConvert', files => {
    convertFile = files[0];
    if (convertText && convertFile) {
        convertText.textContent = `📄 Archivo seleccionado: ${convertFile.name}`;
    }
});

convertBtn?.addEventListener('click', async () => {
    if (!convertFile) { 
        alert('Por favor, selecciona o arrastra un archivo primero'); 
        return; 
    }

    convertBtn.disabled = true;
    showLoading(true);
    showStatus('convertStatus', '⏳ Convirtiendo documento...');

    try {
        const formData = new FormData();
        formData.append('file', convertFile);

        const resp = await fetch('/convert-to-pdf', { method: 'POST', body: formData });
        if (!resp.ok) throw new Error(await resp.text());

        const baseName = convertFile.name.substring(0, convertFile.name.lastIndexOf('.')) || convertFile.name;
        downloadFile(await resp.blob(), `${baseName}.pdf`);
        showStatus('convertStatus', '✅ ¡Convertido con éxito!');
    } catch (err) {
        showStatus('convertStatus', '❌ ' + err.message, true);
    } finally {
        convertBtn.disabled = false;
        showLoading(false);
    }
});
