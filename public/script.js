// ============================================================
// CONFIGURACIÓN
// ============================================================
pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ============================================================
// FUNCIONES AUXILIARES GLOBALES
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
    if (el) {
        el.textContent = message;
        el.style.color = isError ? '#d32f2f' : '#1d1d1f';
    }
}

// Descarga un blob en el navegador de forma limpia
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

// Armoniza y centraliza todos los "Drag & Drop" del proyecto
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
// MANEJO DE TABS
// ============================================================
const tabs = document.querySelectorAll('.tab');
const panels = {
    merge: document.getElementById('mergePanel'),
    split: document.getElementById('splitPanel'),
    delete: document.getElementById('deletePanel'),
    extract: document.getElementById('extractPanel'),
    reorder: document.getElementById('reorderPanel'),
    compress: document.getElementById('compressPanel')
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

// ============================================================
// RENDERIZADO VISUAL DE PDFs
// ============================================================
async function renderThumbnail(file, canvas, pageNum = 1) {
    try {
        const arrayBuffer = await readFileAsArrayBuffer(file);
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(pageNum);
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
        ctx.fillText('Sin vista', (canvas.width || 50) / 2, (canvas.height || 70) / 2);
    }
}

async function renderPageGrid(file, gridId, selectionsArray) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    grid.innerHTML = '';
    try {
        const arrayBuffer = await readFileAsArrayBuffer(file);
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const totalPages = pdf.numPages;

        if (selectionsArray.length !== totalPages) {
            selectionsArray.length = 0;
            for (let i = 0; i < totalPages; i++) selectionsArray.push(false);
        }

        for (let i = 0; i < totalPages; i++) {
            const pageNum = i + 1;
            const div = document.createElement('div');
            div.className = 'page-item';
            div.dataset.index = i;

            const canvas = document.createElement('canvas');
            div.appendChild(canvas);

            const overlay = document.createElement('div');
            overlay.className = 'check-overlay';
            overlay.textContent = '✓';
            div.appendChild(overlay);

            const label = document.createElement('div');
            label.className = 'page-number';
            label.textContent = `Pág. ${pageNum}`;
            div.appendChild(label);

            const updateStyle = () => div.classList.toggle('selected', selectionsArray[i]);

            div.addEventListener('click', () => {
                selectionsArray[i] = !selectionsArray[i];
                updateStyle();
            });

            grid.appendChild(div);
            updateStyle();

            try {
                const page = await pdf.getPage(pageNum);
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
                ctx.fillText('Pág. ' + pageNum, (canvas.width || 120) / 2, (canvas.height || 160) / 2);
            }
        }

        const previewId = gridId.replace('PageGrid', 'Preview');
        const previewEl = document.getElementById(previewId);
        if (previewEl) previewEl.style.display = 'block';

    } catch (err) {
        alert('Error al cargar las páginas: ' + err.message);
    }
}

// ============================================================
// MERGE (UNIR)
// ============================================================
let mergeFiles = [];
const fileListMerge = document.getElementById('fileListMerge');
const fileCountMerge = document.getElementById('fileCountMerge');
const mergeBtn = document.getElementById('mergeBtn');

new Sortable(fileListMerge, {
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

setupDropZone('dropZoneMerge', 'fileInputMerge', files => {
    const pdfFiles = Array.from(files).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
    if (pdfFiles.length === 0) { alert('Solo se permiten PDF'); return; }
    mergeFiles.push(...pdfFiles);
    renderMergeList();
});

document.getElementById('clearMerge').addEventListener('click', () => { mergeFiles = []; renderMergeList(); });

mergeBtn.addEventListener('click', async () => {
    if (mergeFiles.length === 0) { alert('No hay archivos para unir'); return; }
    mergeBtn.disabled = true;
    showLoading(true);
    try {
        const formData = new FormData();
        mergeFiles.forEach(f => formData.append('pdfs', f));
        
        const resp = await fetch('/merge', { method: 'POST', body: formData });
        if (!resp.ok) throw new Error(await resp.text());
        
        downloadFile(await resp.blob(), 'merged.pdf');
    } catch (err) {
        alert('Error: ' + err.message);
    } finally {
        mergeBtn.disabled = false;
        showLoading(false);
    }
});

// ============================================================
// SPLIT (DIVIDIR)
// ============================================================
let splitFile = null;
let splitSelections = [];
const splitBtn = document.getElementById('splitBtn');
const splitRangesInput = document.getElementById('splitRanges');
const splitRangesContainer = document.getElementById('splitRangesContainer');

document.querySelectorAll('input[name="splitMode"]').forEach(radio => {
    radio.addEventListener('change', () => {
        splitRangesContainer.style.display = radio.value === 'ranges' ? 'block' : 'none';
        document.getElementById('splitPreview').style.display = radio.value === 'individual' ? 'block' : 'none';
    });
});

setupDropZone('dropZoneSplit', 'fileInputSplit', files => {
    splitFile = files[0];
    document.querySelector('#dropZoneSplit p').textContent = `📄 ${splitFile.name}`;
    renderPageGrid(splitFile, 'splitPageGrid', splitSelections);
});

document.getElementById('splitSelectAll').addEventListener('click', () => {
    splitSelections.fill(true);
    renderPageGrid(splitFile, 'splitPageGrid', splitSelections);
});
document.getElementById('splitDeselectAll').addEventListener('click', () => {
    splitSelections.fill(false);
    renderPageGrid(splitFile, 'splitPageGrid', splitSelections);
});

splitBtn.addEventListener('click', async () => {
    if (!splitFile) { alert('Primero selecciona un PDF'); return; }
    const mode = document.querySelector('input[name="splitMode"]:checked').value;
    let pagesToSend = '';
    
    if (mode === 'individual') {
        const selectedIndices = splitSelections.map((sel, idx) => sel ? idx + 1 : null).filter(v => v !== null);
        if (selectedIndices.length === 0) { alert('Selecciona al menos una página'); return; }
        pagesToSend = selectedIndices.join(',');
    } else {
        pagesToSend = splitRangesInput.value.trim();
        if (!pagesToSend) { alert('Introduce rangos válidos'); return; }
    }
    
    splitBtn.disabled = true;
    showLoading(true);
    try {
        const formData = new FormData();
        formData.append('file', splitFile);
        formData.append('mode', mode);
        formData.append('ranges', pagesToSend);
        
        const resp = await fetch('/split', { method: 'POST', body: formData });
        if (!resp.ok) throw new Error(await resp.text());
        
        downloadFile(await resp.blob(), 'split.pdf');
        showStatus('splitStatus', '✅ División completada');
    } catch (err) {
        showStatus('splitStatus', '❌ ' + err.message, true);
    } finally {
        splitBtn.disabled = false;
        showLoading(false);
    }
});

// ============================================================
// DELETE (ELIMINAR PÁGINAS)
// ============================================================
let deleteFile = null;
let deleteSelections = [];
const deleteBtn = document.getElementById('deleteBtn');
const deletePagesInput = document.getElementById('deletePages');

setupDropZone('dropZoneDelete', 'fileInputDelete', files => {
    deleteFile = files[0];
    document.querySelector('#dropZoneDelete p').textContent = `📄 ${deleteFile.name}`;
    renderPageGrid(deleteFile, 'deletePageGrid', deleteSelections);
});

document.getElementById('deleteSelectAll').addEventListener('click', () => {
    deleteSelections.fill(true);
    renderPageGrid(deleteFile, 'deletePageGrid', deleteSelections);
});
document.getElementById('deleteDeselectAll').addEventListener('click', () => {
    deleteSelections.fill(false);
    renderPageGrid(deleteFile, 'deletePageGrid', deleteSelections);
});

deleteBtn.addEventListener('click', async () => {
    if (!deleteFile) { alert('Selecciona un PDF'); return; }
    let pagesToDelete = deletePagesInput.value.trim();
    if (!pagesToDelete) {
        const selected = deleteSelections.map((sel, idx) => sel ? idx + 1 : null).filter(v => v !== null);
        if (selected.length === 0) { alert('Selecciona al menos una página o escribe rangos'); return; }
        pagesToDelete = selected.join(',');
    }
    
    deleteBtn.disabled = true;
    showLoading(true);
    try {
        const formData = new FormData();
        formData.append('file', deleteFile);
        formData.append('pagesToDelete', pagesToDelete);
        
        const resp = await fetch('/delete-pages', { method: 'POST', body: formData });
        if (!resp.ok) throw new Error(await resp.text());
        
        downloadFile(await resp.blob(), 'modified.pdf');
        showStatus('deleteStatus', '✅ Páginas eliminadas correctamente');
    } catch (err) {
        showStatus('deleteStatus', '❌ ' + err.message, true);
    } finally {
        deleteBtn.disabled = false;
        showLoading(false);
    }
});

// ============================================================
// EXTRACT (EXTRAER PÁGINAS)
// ============================================================
let extractFile = null;
let extractSelections = [];
const extractBtn = document.getElementById('extractBtn');
const extractPagesInput = document.getElementById('extractPages');

setupDropZone('dropZoneExtract', 'fileInputExtract', files => {
    extractFile = files[0];
    document.querySelector('#dropZoneExtract p').textContent = `📄 ${extractFile.name}`;
    renderPageGrid(extractFile, 'extractPageGrid', extractSelections);
});

document.getElementById('extractSelectAll').addEventListener('click', () => {
    extractSelections.fill(true);
    renderPageGrid(extractFile, 'extractPageGrid', extractSelections);
});
document.getElementById('extractDeselectAll').addEventListener('click', () => {
    extractSelections.fill(false);
    renderPageGrid(extractFile, 'extractPageGrid', extractSelections);
});

extractBtn.addEventListener('click', async () => {
    if (!extractFile) { alert('Selecciona un PDF'); return; }
    let pagesToExtract = extractPagesInput.value.trim();
    if (!pagesToExtract) {
        const selected = extractSelections.map((sel, idx) => sel ? idx + 1 : null).filter(v => v !== null);
        if (selected.length === 0) { alert('Selecciona al menos una página o escribe rangos'); return; }
        pagesToExtract = selected.join(',');
    }
    
    extractBtn.disabled = true;
    showLoading(true);
    try {
        const formData = new FormData();
        formData.append('file', extractFile);
        formData.append('pagesToExtract', pagesToExtract);
        
        const resp = await fetch('/extract-pages', { method: 'POST', body: formData });
        if (!resp.ok) throw new Error(await resp.text());
        
        downloadFile(await resp.blob(), 'extracted.pdf');
        showStatus('extractStatus', '✅ Páginas extraídas correctamente');
    } catch (err) {
        showStatus('extractStatus', '❌ ' + err.message, true);
    } finally {
        extractBtn.disabled = false;
        showLoading(false);
    }
});

// ============================================================
// REORDER (ORDENAR PÁGINAS)
// ============================================================
let reorderFile = null;
let pageOrder = [];
const reorderBtn = document.getElementById('reorderBtn');
const pageList = document.getElementById('pageList');

// Instanciar Sortable UNA sola vez de manera global
new Sortable(pageList, {
    animation: 150,
    ghostClass: 'sortable-ghost',
    draggable: '.reorder-item',
    onEnd: function() {
        const items = pageList.querySelectorAll('.reorder-item');
        pageOrder = Array.from(items).map(item => parseInt(item.dataset.page));
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
            canvas.style.pointerEvents = 'none';
            li.appendChild(canvas);

            const label = document.createElement('div');
            label.className = 'page-number';
            label.textContent = `Pág. ${i}`;
            li.appendChild(label);

            pageList.appendChild(li);

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
        }
    } catch (err) {
        alert('Error al cargar las páginas: ' + err.message);
    }
}

setupDropZone('dropZoneReorder', 'fileInputReorder', files => {
    reorderFile = files[0];
    document.querySelector('#dropZoneReorder p').textContent = `📄 ${reorderFile.name}`;
    loadReorderPages(reorderFile);
});

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
        
        downloadFile(await resp.blob(), 'reordered.pdf');
        showStatus('reorderStatus', '✅ Nuevo orden aplicado');
    } catch (err) {
        showStatus('reorderStatus', '❌ ' + err.message, true);
    } finally {
        reorderBtn.disabled = false;
        showLoading(false);
    }
});

// ============================================================
// COMPRESS (COMPRIMIR PDF)
// ============================================================
let compressFile = null;
const compressBtn = document.getElementById('compressBtn');

setupDropZone('dropZoneCompress', 'fileInputCompress', files => {
    compressFile = files[0];
    document.querySelector('#dropZoneCompress p').textContent = `📄 ${compressFile.name}`;
});

compressBtn.addEventListener('click', async () => {
    if (!compressFile) { alert('Selecciona un PDF para comprimir'); return; }

    const level = document.querySelector('input[name="compressLevel"]:checked').value;
    compressBtn.disabled = true;
    showLoading(true);
    showStatus('compressStatus', '⏳ Procesando optimización...');

    try {
        const arrayBuffer = await readFileAsArrayBuffer(compressFile);
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const totalPages = pdf.numPages;

        let maxDimension, quality;
        switch (level) {
            case 'extreme': maxDimension = 800; quality = 0.5; break;
            case 'recommended': maxDimension = 1200; quality = 0.7; break;
            case 'low': maxDimension = 1800; quality = 0.85; break;
            default: maxDimension = 1200; quality = 0.7;
        }

        const images = [];

        for (let i = 1; i <= totalPages; i++) {
            showStatus('compressStatus', `⏳ Procesando página ${i} de ${totalPages}...`);
            const page = await pdf.getPage(i);
            const unscaledViewport = page.getViewport({ scale: 1.0 });

            const currentMax = Math.max(unscaledViewport.width, unscaledViewport.height);
            let scale = 1.0;
            if (currentMax > maxDimension) scale = maxDimension / currentMax;

            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvasContext: ctx, viewport }).promise;

            images.push(canvas.toDataURL('image/jpeg', quality));
        }

        showStatus('compressStatus', '⏳ Generando documento comprimido...');

        const resp = await fetch('/compress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ images, level })
        });

        if (!resp.ok) throw new Error(await resp.text());

        downloadFile(await resp.blob(), `compressed_${level}.pdf`);
        showStatus('compressStatus', '✅ PDF comprimido correctamente');
    } catch (err) {
        showStatus('compressStatus', '❌ ' + err.message, true);
    } finally {
        compressBtn.disabled = false;
        showLoading(false);
    }
});

// ============================================================
// INICIALIZACIÓN
// ============================================================
updateMergeCount();
console.log('📄 Suite PDF cargada correctamente');
