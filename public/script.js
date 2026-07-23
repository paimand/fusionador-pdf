// Configuración de PDF.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// Helpers UI
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = show ? 'flex' : 'none';
}

function showStatus(elementId, text, isError = false) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = text;
    el.className = 'status-msg ' + (isError ? 'error' : 'success');
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// NAVEGACIÓN POR PESTAÑAS
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
    });
});

// ============================================================
// 1. MERGE (UNIR)
// ============================================================
let mergeFiles = [];
const dropZoneMerge = document.getElementById('dropZoneMerge');
const fileInputMerge = document.getElementById('fileInputMerge');
const mergeFileList = document.getElementById('mergeFileList');
const mergeBtn = document.getElementById('mergeBtn');

dropZoneMerge.addEventListener('click', () => fileInputMerge.click());
fileInputMerge.addEventListener('change', (e) => handleMergeFiles(e.target.files));

dropZoneMerge.addEventListener('dragover', (e) => { e.preventDefault(); dropZoneMerge.classList.add('dragover'); });
dropZoneMerge.addEventListener('dragleave', () => dropZoneMerge.classList.remove('dragover'));
dropZoneMerge.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZoneMerge.classList.remove('dragover');
    handleMergeFiles(e.dataTransfer.files);
});

function handleMergeFiles(files) {
    for (const file of files) {
        if (file.type === 'application/pdf') mergeFiles.push(file);
    }
    renderMergeList();
}

function renderMergeList() {
    mergeFileList.innerHTML = '';
    mergeFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `
            <span>📄 ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)</span>
            <button class="btn-remove" onclick="removeMergeFile(${index})">✕</button>
        `;
        mergeFileList.appendChild(item);
    });
    mergeBtn.disabled = mergeFiles.length < 2;
}

window.removeMergeFile = function(index) {
    mergeFiles.splice(index, 1);
    renderMergeList();
};

mergeBtn.addEventListener('click', async () => {
    if (mergeFiles.length < 2) return;
    mergeBtn.disabled = true;
    showLoading(true);
    showStatus('mergeStatus', '⏳ Procesando unión de archivos...');

    try {
        const formData = new FormData();
        mergeFiles.forEach(file => formData.append('pdfs', file));

        const resp = await fetch('/merge', { method: 'POST', body: formData });
        if (!resp.ok) throw new Error(await resp.text());

        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'merged.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showStatus('mergeStatus', '✅ Unificado correctamente');
    } catch (err) {
        showStatus('mergeStatus', '❌ ' + err.message, true);
    } finally {
        mergeBtn.disabled = false;
        showLoading(false);
    }
});

// ============================================================
// 2. SPLIT (DIVIDIR)
// ============================================================
let splitFile = null;
const dropZoneSplit = document.getElementById('dropZoneSplit');
const fileInputSplit = document.getElementById('fileInputSplit');
const splitBtn = document.getElementById('splitBtn');

dropZoneSplit.addEventListener('click', () => fileInputSplit.click());
fileInputSplit.addEventListener('change', (e) => {
    if (e.target.files[0]) {
        splitFile = e.target.files[0];
        document.getElementById('splitFileName').textContent = '📄 ' + splitFile.name;
        splitBtn.disabled = false;
    }
});

splitBtn.addEventListener('click', async () => {
    const ranges = document.getElementById('splitRanges').value.trim();
    if (!splitFile || !ranges) return;

    showLoading(true);
    try {
        const formData = new FormData();
        formData.append('file', splitFile);
        formData.append('ranges', ranges);

        const resp = await fetch('/split', { method: 'POST', body: formData });
        if (!resp.ok) throw new Error(await resp.text());

        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'split.pdf';
        a.click();
        URL.revokeObjectURL(url);
        showStatus('splitStatus', '✅ PDF dividido con éxito');
    } catch (err) {
        showStatus('splitStatus', '❌ ' + err.message, true);
    } finally {
        showLoading(false);
    }
});

// ============================================================
// 3. DELETE PAGES (ELIMINAR PÁGINAS)
// ============================================================
let deleteFile = null;
const dropZoneDelete = document.getElementById('dropZoneDelete');
const fileInputDelete = document.getElementById('fileInputDelete');
const deleteBtn = document.getElementById('deleteBtn');

dropZoneDelete.addEventListener('click', () => fileInputDelete.click());
fileInputDelete.addEventListener('change', (e) => {
    if (e.target.files[0]) {
        deleteFile = e.target.files[0];
        document.getElementById('deleteFileName').textContent = '📄 ' + deleteFile.name;
        deleteBtn.disabled = false;
    }
});

deleteBtn.addEventListener('click', async () => {
    const pagesToDelete = document.getElementById('deleteRanges').value.trim();
    if (!deleteFile || !pagesToDelete) return;

    showLoading(true);
    try {
        const formData = new FormData();
        formData.append('file', deleteFile);
        formData.append('pagesToDelete', pagesToDelete);

        const resp = await fetch('/delete-pages', { method: 'POST', body: formData });
        if (!resp.ok) throw new Error(await resp.text());

        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'modificado.pdf';
        a.click();
        URL.revokeObjectURL(url);
        showStatus('deleteStatus', '✅ Páginas eliminadas con éxito');
    } catch (err) {
        showStatus('deleteStatus', '❌ ' + err.message, true);
    } finally {
        showLoading(false);
    }
});

// ============================================================
// 4. EXTRACT PAGES (EXTRAER PÁGINAS)
// ============================================================
let extractFile = null;
const dropZoneExtract = document.getElementById('dropZoneExtract');
const fileInputExtract = document.getElementById('fileInputExtract');
const extractBtn = document.getElementById('extractBtn');

dropZoneExtract.addEventListener('click', () => fileInputExtract.click());
fileInputExtract.addEventListener('change', (e) => {
    if (e.target.files[0]) {
        extractFile = e.target.files[0];
        document.getElementById('extractFileName').textContent = '📄 ' + extractFile.name;
        extractBtn.disabled = false;
    }
});

extractBtn.addEventListener('click', async () => {
    const pagesToExtract = document.getElementById('extractRanges').value.trim();
    if (!extractFile || !pagesToExtract) return;

    showLoading(true);
    try {
        const formData = new FormData();
        formData.append('file', extractFile);
        formData.append('pagesToExtract', pagesToExtract);

        const resp = await fetch('/extract-pages', { method: 'POST', body: formData });
        if (!resp.ok) throw new Error(await resp.text());

        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'extraido.pdf';
        a.click();
        URL.revokeObjectURL(url);
        showStatus('extractStatus', '✅ Páginas extraídas con éxito');
    } catch (err) {
        showStatus('extractStatus', '❌ ' + err.message, true);
    } finally {
        showLoading(false);
    }
});

// ============================================================
// 5. REORDER (REORDENAR PÁGINAS - CON VISTA PREVIA Y DRAG & DROP)
// ============================================================
let reorderFile = null;
let pageOrder = [];
const dropZoneReorder = document.getElementById('dropZoneReorder');
const fileInputReorder = document.getElementById('fileInputReorder');
const reorderBtn = document.getElementById('reorderBtn');
const pageList = document.getElementById('pageList');

dropZoneReorder.addEventListener('click', () => fileInputReorder.click());
fileInputReorder.addEventListener('change', async (e) => {
    if (e.target.files[0]) {
        reorderFile = e.target.files[0];
        document.getElementById('reorderFileName').textContent = '📄 ' + reorderFile.name;
        showLoading(true);
        await loadReorderPages(reorderFile);
        showLoading(false);
        reorderBtn.disabled = false;
    }
});

async function loadReorderPages(file) {
    try {
        const arrayBuffer = await readFileAsArrayBuffer(file);
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const totalPages = pdf.numPages;
        pageOrder = Array.from({ length: totalPages }, (_, i) => i + 1);
        pageList.innerHTML = '';

        for (let i = 1; i <= totalPages; i++) {
            const li = document.createElement('li');
            li.className = 'reorder-item';
            li.dataset.page = i;

            const canvas = document.createElement('canvas');
            canvas.style.pointerEvents = 'none'; // Evita interferencias al arrastrar
            li.appendChild(canvas);

            const label = document.createElement('div');
            label.className = 'page-number';
            label.textContent = `Pág. ${i}`;
            li.appendChild(label);

            try {
                const page = await pdf.getPage(i);
                const scale = 0.3;
                const viewport = page.getViewport({ scale });
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const ctx = canvas.getContext('2d');
                await page.render({ canvasContext: ctx, viewport }).promise;
            } catch (_) {
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#f0f0f2';
                ctx.fillRect(0, 0, canvas.width || 120, canvas.height || 160);
                ctx.fillStyle = '#86868b';
                ctx.font = '12px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('Pág. ' + i, (canvas.width || 120) / 2, (canvas.height || 160) / 2);
            }

            pageList.appendChild(li);
        }

        // Inicializamos Sortable sobre elementos <li>
        new Sortable(pageList, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            draggable: '.reorder-item',
            onEnd: function() {
                const items = pageList.querySelectorAll('.reorder-item');
                pageOrder = Array.from(items).map(item => parseInt(item.dataset.page));
            }
        });
    } catch (err) {
        alert('Error al cargar las páginas: ' + err.message);
    }
}

reorderBtn.addEventListener('click', async () => {
    if (!reorderFile || pageOrder.length === 0) return;

    showLoading(true);
    try {
        const formData = new FormData();
        formData.append('file', reorderFile);
        formData.append('newOrder', JSON.stringify(pageOrder));

        const resp = await fetch('/reorder-pages', { method: 'POST', body: formData });
        if (!resp.ok) throw new Error(await resp.text());

        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'reordenado.pdf';
        a.click();
        URL.revokeObjectURL(url);
        showStatus('reorderStatus', '✅ Páginas reordenadas con éxito');
    } catch (err) {
        showStatus('reorderStatus', '❌ ' + err.message, true);
    } finally {
        showLoading(false);
    }
});

// ============================================================
// 6. COMPRESS (COMPRIMIR RECONSTRUYENDO PÁGINAS)
// ============================================================
let compressFile = null;
const dropZoneCompress = document.getElementById('dropZoneCompress');
const fileInputCompress = document.getElementById('fileInputCompress');
const compressBtn = document.getElementById('compressBtn');

dropZoneCompress.addEventListener('click', () => fileInputCompress.click());
fileInputCompress.addEventListener('change', (e) => {
    if (e.target.files[0]) {
        compressFile = e.target.files[0];
        document.getElementById('compressFileName').textContent = '📄 ' + compressFile.name;
        compressBtn.disabled = false;
    }
});

compressBtn.addEventListener('click', async () => {
    if (!compressFile) return;

    showLoading(true);
    showStatus('compressStatus', '⏳ Optimizando y comprimiendo el PDF...');

    try {
        const quality = parseFloat(document.getElementById('compressQuality').value) || 0.6;
        const arrayBuffer = await readFileAsArrayBuffer(compressFile);
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const images = [];

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.2 });

            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');

            await page.render({ canvasContext: ctx, viewport }).promise;
            images.push(canvas.toDataURL('image/jpeg', quality));
        }

        const resp = await fetch('/compress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ images })
        });

        if (!resp.ok) throw new Error(await resp.text());

        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'comprimido.pdf';
        a.click();
        URL.revokeObjectURL(url);
        showStatus('compressStatus', '✅ Documento optimizado correctamente');
    } catch (err) {
        showStatus('compressStatus', '❌ ' + err.message, true);
    } finally {
        showLoading(false);
    }
});
