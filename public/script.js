// ============================================================
// CONFIGURACIÓN DE PDF.JS
// ============================================================
pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ============================================================
// ESTADO GLOBAL
// ============================================================
let mergeFiles = [];
let currentFileForReorder = null;
let pageThumbnails = [];

// ============================================================
// FUNCIONES AUXILIARES
// ============================================================
function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e.target.error);
        reader.readAsArrayBuffer(file);
    });
}

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
}

function showStatus(elementId, message, isError = false) {
    const el = document.getElementById(elementId);
    el.textContent = message;
    el.style.color = isError ? '#d32f2f' : '#1d1d1f';
}

// ============================================================
// MANEJO DE TABS
// ============================================================
const tabs = document.querySelectorAll('.tab');
const panels = {
    merge: document.getElementById('mergePanel'),
    split: document.getElementById('splitPanel'),
    delete: document.getElementById('deletePanel'),
    extract: document.getElementById('extractPanel'),
    reorder: document.getElementById('reorderPanel')
};

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.tab;
        Object.keys(panels).forEach(key => {
            panels[key].classList.toggle('active', key === target);
        });
    });
});

// Mostrar/ocultar campo de rangos en Dividir
document.querySelectorAll('input[name="splitMode"]').forEach(radio => {
    radio.addEventListener('change', () => {
        const container = document.getElementById('splitRangesContainer');
        container.style.display = radio.value === 'ranges' ? 'block' : 'none';
    });
});

// ============================================================
// FUNCIONES PARA RENDERIZAR MINIATURAS (genéricas)
// ============================================================
async function renderThumbnail(file, canvas) {
    try {
        const arrayBuffer = await readFileAsArrayBuffer(file);
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        const scale = 0.5;
        const viewport = page.getViewport({ scale });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
    } catch (_) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#f0f0f2';
        ctx.fillRect(0, 0, canvas.width || 50, canvas.height || 70);
        ctx.fillStyle = '#86868b';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Sin vista previa', (canvas.width || 50) / 2, (canvas.height || 70) / 2);
    }
}

// ============================================================
// UNIR PDF (Merge)
// ============================================================
const dropZoneMerge = document.getElementById('dropZoneMerge');
const fileInputMerge = document.getElementById('fileInputMerge');
const fileListMerge = document.getElementById('fileListMerge');
const fileCountMerge = document.getElementById('fileCountMerge');
const clearMerge = document.getElementById('clearMerge');
const mergeBtn = document.getElementById('mergeBtn');

let mergeSortable = new Sortable(fileListMerge, {
    animation: 150,
    ghostClass: 'sortable-ghost',
    onEnd: function(evt) {
        const [moved] = mergeFiles.splice(evt.oldIndex, 1);
        mergeFiles.splice(evt.newIndex, 0, moved);
        updateMergeCount();
    }
});

function updateMergeCount() {
    const count = mergeFiles.length;
    fileCountMerge.textContent = count === 0 ? '0 archivos' : (count === 1 ? '1 archivo' : `${count} archivos`);
}

function renderMergeList() {
    fileListMerge.innerHTML = '';
    mergeFiles.forEach((file, index) => {
        const li = document.createElement('li');
        const thumbDiv = document.createElement('div');
        thumbDiv.className = 'thumbnail';
        const canvas = document.createElement('canvas');
        thumbDiv.appendChild(canvas);
        li.appendChild(thumbDiv);
        renderThumbnail(file, canvas);

        const infoDiv = document.createElement('div');
        infoDiv.className = 'file-info';
        const nameSpan = document.createElement('div');
        nameSpan.className = 'file-name';
        nameSpan.textContent = file.name;
        const metaSpan = document.createElement('div');
        metaSpan.className = 'file-meta';
        metaSpan.textContent = (file.size / 1024).toFixed(1) + ' KB';
        infoDiv.appendChild(nameSpan);
        infoDiv.appendChild(metaSpan);
        li.appendChild(infoDiv);

        const delBtn = document.createElement('button');
        delBtn.className = 'delete-btn';
        delBtn.textContent = '×';
        delBtn.addEventListener('click', () => {
            mergeFiles.splice(index, 1);
            renderMergeList();
        });
        li.appendChild(delBtn);
        fileListMerge.appendChild(li);
    });
    updateMergeCount();
}

function handleMergeFiles(files) {
    const pdfFiles = Array.from(files).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
    if (pdfFiles.length === 0) { alert('Solo se permiten PDF'); return; }
    for (const f of pdfFiles) mergeFiles.push(f);
    renderMergeList();
    fileInputMerge.value = '';
}

dropZoneMerge.addEventListener('dragover', e => { e.preventDefault(); dropZoneMerge.classList.add('dragover'); });
dropZoneMerge.addEventListener('dragleave', () => dropZoneMerge.classList.remove('dragover'));
dropZoneMerge.addEventListener('drop', e => {
    e.preventDefault();
    dropZoneMerge.classList.remove('dragover');
    handleMergeFiles(e.dataTransfer.files);
});
dropZoneMerge.addEventListener('click', () => fileInputMerge.click());
fileInputMerge.addEventListener('change', e => handleMergeFiles(e.target.files));

clearMerge.addEventListener('click', () => {
    mergeFiles = [];
    renderMergeList();
});

mergeBtn.addEventListener('click', async () => {
    if (mergeFiles.length === 0) { alert('No hay archivos para unir'); return; }
    mergeBtn.disabled = true;
    showLoading(true);
    try {
        const formData = new FormData();
        for (const f of mergeFiles) formData.append('pdfs', f);
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
    } catch (err) {
        alert('Error: ' + err.message);
    } finally {
        mergeBtn.disabled = false;
        showLoading(false);
    }
});

// ============================================================
// DIVIDIR (Split)
// ============================================================
const dropZoneSplit = document.getElementById('dropZoneSplit');
const fileInputSplit = document.getElementById('fileInputSplit');
const splitBtn = document.getElementById('splitBtn');
let splitFile = null;

dropZoneSplit.addEventListener('dragover', e => { e.preventDefault(); dropZoneSplit.classList.add('dragover'); });
dropZoneSplit.addEventListener('dragleave', () => dropZoneSplit.classList.remove('dragover'));
dropZoneSplit.addEventListener('drop', e => {
    e.preventDefault();
    dropZoneSplit.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        splitFile = files[0];
        dropZoneSplit.querySelector('p').textContent = `📄 ${splitFile.name}`;
        fileInputSplit.files = files;
    }
});
dropZoneSplit.addEventListener('click', () => fileInputSplit.click());
fileInputSplit.addEventListener('change', e => {
    if (e.target.files.length > 0) {
        splitFile = e.target.files[0];
        dropZoneSplit.querySelector('p').textContent = `📄 ${splitFile.name}`;
    }
});

splitBtn.addEventListener('click', async () => {
    if (!splitFile) { alert('Primero selecciona un PDF'); return; }
    const mode = document.querySelector('input[name="splitMode"]:checked').value;
    const ranges = document.getElementById('splitRanges').value.trim();
    if (mode === 'ranges' && !ranges) { alert('Introduce rangos válidos'); return; }
    splitBtn.disabled = true;
    showLoading(true);
    try {
        const formData = new FormData();
        formData.append('file', splitFile);
        formData.append('mode', mode);
        if (mode === 'ranges') formData.append('ranges', ranges);
        const resp = await fetch('/split', { method: 'POST', body: formData });
        if (!resp.ok) throw new Error(await resp.text());
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'split.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showStatus('splitStatus', '✅ División completada');
    } catch (err) {
        showStatus('splitStatus', '❌ ' + err.message, true);
    } finally {
        splitBtn.disabled = false;
        showLoading(false);
    }
});

// ============================================================
// ELIMINAR PÁGINAS (Delete)
// ============================================================
const dropZoneDelete = document.getElementById('dropZoneDelete');
const fileInputDelete = document.getElementById('fileInputDelete');
const deleteBtn = document.getElementById('deleteBtn');
let deleteFile = null;

dropZoneDelete.addEventListener('dragover', e => { e.preventDefault(); dropZoneDelete.classList.add('dragover'); });
dropZoneDelete.addEventListener('dragleave', () => dropZoneDelete.classList.remove('dragover'));
dropZoneDelete.addEventListener('drop', e => {
    e.preventDefault();
    dropZoneDelete.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        deleteFile = files[0];
        dropZoneDelete.querySelector('p').textContent = `📄 ${deleteFile.name}`;
        fileInputDelete.files = files;
    }
});
dropZoneDelete.addEventListener('click', () => fileInputDelete.click());
fileInputDelete.addEventListener('change', e => {
    if (e.target.files.length > 0) {
        deleteFile = e.target.files[0];
        dropZoneDelete.querySelector('p').textContent = `📄 ${deleteFile.name}`;
    }
});

deleteBtn.addEventListener('click', async () => {
    if (!deleteFile) { alert('Selecciona un PDF'); return; }
    const pagesToDelete = document.getElementById('deletePages').value.trim();
    if (!pagesToDelete) { alert('Introduce páginas a eliminar'); return; }
    deleteBtn.disabled = true;
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
        a.download = 'modified.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showStatus('deleteStatus', '✅ Páginas eliminadas correctamente');
    } catch (err) {
        showStatus('deleteStatus', '❌ ' + err.message, true);
    } finally {
        deleteBtn.disabled = false;
        showLoading(false);
    }
});

// ============================================================
// EXTRAER PÁGINAS (Extract)
// ============================================================
const dropZoneExtract = document.getElementById('dropZoneExtract');
const fileInputExtract = document.getElementById('fileInputExtract');
const extractBtn = document.getElementById('extractBtn');
let extractFile = null;

dropZoneExtract.addEventListener('dragover', e => { e.preventDefault(); dropZoneExtract.classList.add('dragover'); });
dropZoneExtract.addEventListener('dragleave', () => dropZoneExtract.classList.remove('dragover'));
dropZoneExtract.addEventListener('drop', e => {
    e.preventDefault();
    dropZoneExtract.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        extractFile = files[0];
        dropZoneExtract.querySelector('p').textContent = `📄 ${extractFile.name}`;
        fileInputExtract.files = files;
    }
});
dropZoneExtract.addEventListener('click', () => fileInputExtract.click());
fileInputExtract.addEventListener('change', e => {
    if (e.target.files.length > 0) {
        extractFile = e.target.files[0];
        dropZoneExtract.querySelector('p').textContent = `📄 ${extractFile.name}`;
    }
});

extractBtn.addEventListener('click', async () => {
    if (!extractFile) { alert('Selecciona un PDF'); return; }
    const pagesToExtract = document.getElementById('extractPages').value.trim();
    if (!pagesToExtract) { alert('Introduce páginas a extraer'); return; }
    extractBtn.disabled = true;
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
        a.download = 'extracted.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showStatus('extractStatus', '✅ Páginas extraídas correctamente');
    } catch (err) {
        showStatus('extractStatus', '❌ ' + err.message, true);
    } finally {
        extractBtn.disabled = false;
        showLoading(false);
    }
});

// ============================================================
// REORDENAR PÁGINAS (Reorder)
// ============================================================
const dropZoneReorder = document.getElementById('dropZoneReorder');
const fileInputReorder = document.getElementById('fileInputReorder');
const reorderBtn = document.getElementById('reorderBtn');
const pageList = document.getElementById('pageList');
let reorderFile = null;
let pageOrder = [];

dropZoneReorder.addEventListener('dragover', e => { e.preventDefault(); dropZoneReorder.classList.add('dragover'); });
dropZoneReorder.addEventListener('dragleave', () => dropZoneReorder.classList.remove('dragover'));
dropZoneReorder.addEventListener('drop', e => {
    e.preventDefault();
    dropZoneReorder.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        reorderFile = files[0];
        dropZoneReorder.querySelector('p').textContent = `📄 ${reorderFile.name}`;
        fileInputReorder.files = files;
        loadPagesForReorder(reorderFile);
    }
});
dropZoneReorder.addEventListener('click', () => fileInputReorder.click());
fileInputReorder.addEventListener('change', e => {
    if (e.target.files.length > 0) {
        reorderFile = e.target.files[0];
        dropZoneReorder.querySelector('p').textContent = `📄 ${reorderFile.name}`;
        loadPagesForReorder(reorderFile);
    }
});

async function loadPagesForReorder(file) {
    try {
        const arrayBuffer = await readFileAsArrayBuffer(file);
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const totalPages = pdf.numPages;
        pageOrder = Array.from({ length: totalPages }, (_, i) => i + 1);
        renderPageThumbnails(pdf, totalPages);
    } catch (err) {
        alert('Error al cargar las páginas: ' + err.message);
    }
}

async function renderPageThumbnails(pdf, totalPages) {
    pageList.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
        const li = document.createElement('li');
        li.dataset.page = i;
        const thumbDiv = document.createElement('div');
        thumbDiv.className = 'thumbnail';
        const canvas = document.createElement('canvas');
        thumbDiv.appendChild(canvas);
        li.appendChild(thumbDiv);

        const infoDiv = document.createElement('div');
        infoDiv.className = 'file-info';
        const nameSpan = document.createElement('div');
        nameSpan.className = 'file-name';
        nameSpan.textContent = `Página ${i}`;
        infoDiv.appendChild(nameSpan);
        li.appendChild(infoDiv);

        // Renderizar miniatura
        try {
            const page = await pdf.getPage(i);
            const scale = 0.4;
            const viewport = page.getViewport({ scale });
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;
        } catch (_) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#f0f0f2';
            ctx.fillRect(0, 0, canvas.width || 50, canvas.height || 70);
            ctx.fillStyle = '#86868b';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Página ' + i, (canvas.width || 50) / 2, (canvas.height || 70) / 2);
        }

        pageList.appendChild(li);
    }
    // Inicializar Sortable en la lista de páginas
    new Sortable(pageList, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: function(evt) {
            const items = pageList.querySelectorAll('li');
            pageOrder = Array.from(items).map(li => parseInt(li.dataset.page));
        }
    });
}

reorderBtn.addEventListener('click', async () => {
    if (!reorderFile) { alert('Selecciona un PDF'); return; }
    if (pageOrder.length === 0) { alert('No hay páginas para ordenar'); return; }
    reorderBtn.disabled = true;
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
        a.download = 'reordered.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showStatus('reorderStatus', '✅ Nuevo orden aplicado');
    } catch (err) {
        showStatus('reorderStatus', '❌ ' + err.message, true);
    } finally {
        reorderBtn.disabled = false;
        showLoading(false);
    }
});

// ============================================================
// INICIALIZACIÓN
// ============================================================
updateMergeCount();
