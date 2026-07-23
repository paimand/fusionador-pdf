document.addEventListener('DOMContentLoaded', () => {
    // 1. Configuración segura de PDF.js Worker
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
    }

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

    // ============================================================
    // NAVEGACIÓN POR PESTAÑAS (Garantizado)
    // ============================================================
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            tabButtons.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-tab');
            const targetTab = document.getElementById(targetId);
            if (targetTab) targetTab.classList.add('active');
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

    if (dropZoneMerge && fileInputMerge) {
        dropZoneMerge.addEventListener('click', () => fileInputMerge.click());
        fileInputMerge.addEventListener('change', (e) => handleMergeFiles(e.target.files));

        dropZoneMerge.addEventListener('dragover', (e) => { e.preventDefault(); dropZoneMerge.classList.add('dragover'); });
        dropZoneMerge.addEventListener('dragleave', () => dropZoneMerge.classList.remove('dragover'));
        dropZoneMerge.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZoneMerge.classList.remove('dragover');
            handleMergeFiles(e.dataTransfer.files);
        });
    }

    function handleMergeFiles(files) {
        for (const file of files) {
            if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
                mergeFiles.push(file);
            }
        }
        renderMergeList();
    }

    function renderMergeList() {
        if (!mergeFileList) return;
        mergeFileList.innerHTML = '';
        mergeFiles.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'file-item';
            item.innerHTML = `
                <span>📄 ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                <button type="button" class="btn-remove" data-index="${index}">✕</button>
            `;
            mergeFileList.appendChild(item);
        });

        // Event delegation para botones de eliminar
        mergeFileList.querySelectorAll('.btn-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.getAttribute('data-index'), 10);
                mergeFiles.splice(idx, 1);
                renderMergeList();
            });
        });

        if (mergeBtn) mergeBtn.disabled = mergeFiles.length < 2;
    }

    if (mergeBtn) {
        mergeBtn.addEventListener('click', async () => {
            if (mergeFiles.length < 2) return;
            mergeBtn.disabled = true;
            showLoading(true);
            showStatus('mergeStatus', '⏳ Uniendo archivos...');

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
    }

    // ============================================================
    // 2. SPLIT (DIVIDIR)
    // ============================================================
    let splitFile = null;
    const dropZoneSplit = document.getElementById('dropZoneSplit');
    const fileInputSplit = document.getElementById('fileInputSplit');
    const splitBtn = document.getElementById('splitBtn');

    if (dropZoneSplit && fileInputSplit) {
        dropZoneSplit.addEventListener('click', () => fileInputSplit.click());
        fileInputSplit.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                splitFile = e.target.files[0];
                const nameEl = document.getElementById('splitFileName');
                if (nameEl) nameEl.textContent = '📄 ' + splitFile.name;
                if (splitBtn) splitBtn.disabled = false;
            }
        });
    }

    if (splitBtn) {
        splitBtn.addEventListener('click', async () => {
            const rangesEl = document.getElementById('splitRanges');
            const ranges = rangesEl ? rangesEl.value.trim() : '';
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
    }

    // ============================================================
    // 3. DELETE PAGES (ELIMINAR PÁGINAS)
    // ============================================================
    let deleteFile = null;
    const dropZoneDelete = document.getElementById('dropZoneDelete');
    const fileInputDelete = document.getElementById('fileInputDelete');
    const deleteBtn = document.getElementById('deleteBtn');

    if (dropZoneDelete && fileInputDelete) {
        dropZoneDelete.addEventListener('click', () => fileInputDelete.click());
        fileInputDelete.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                deleteFile = e.target.files[0];
                const nameEl = document.getElementById('deleteFileName');
                if (nameEl) nameEl.textContent = '📄 ' + deleteFile.name;
                if (deleteBtn) deleteBtn.disabled = false;
            }
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            const rangesEl = document.getElementById('deleteRanges');
            const pagesToDelete = rangesEl ? rangesEl.value.trim() : '';
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
    }

    // ============================================================
    // 4. EXTRACT PAGES (EXTRAER PÁGINAS)
    // ============================================================
    let extractFile = null;
    const dropZoneExtract = document.getElementById('dropZoneExtract');
    const fileInputExtract = document.getElementById('fileInputExtract');
    const extractBtn = document.getElementById('extractBtn');

    if (dropZoneExtract && fileInputExtract) {
        dropZoneExtract.addEventListener('click', () => fileInputExtract.click());
        fileInputExtract.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                extractFile = e.target.files[0];
                const nameEl = document.getElementById('extractFileName');
                if (nameEl) nameEl.textContent = '📄 ' + extractFile.name;
                if (extractBtn) extractBtn.disabled = false;
            }
        });
    }

    if (extractBtn) {
        extractBtn.addEventListener('click', async () => {
            const rangesEl = document.getElementById('extractRanges');
            const pagesToExtract = rangesEl ? rangesEl.value.trim() : '';
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
    }

    // ============================================================
    // 5. REORDER (REORDENAR PÁGINAS)
    // ============================================================
    let reorderFile = null;
    let pageOrder = [];
    const dropZoneReorder = document.getElementById('dropZoneReorder');
    const fileInputReorder = document.getElementById('fileInputReorder');
    const reorderBtn = document.getElementById('reorderBtn');
    const pageList = document.getElementById('pageList');

    if (dropZoneReorder && fileInputReorder) {
        dropZoneReorder.addEventListener('click', () => fileInputReorder.click());
        fileInputReorder.addEventListener('change', async (e) => {
            if (e.target.files[0]) {
                reorderFile = e.target.files[0];
                const nameEl = document.getElementById('reorderFileName');
                if (nameEl) nameEl.textContent = '📄 ' + reorderFile.name;
                showLoading(true);
                await loadReorderPages(reorderFile);
                showLoading(false);
                if (reorderBtn) reorderBtn.disabled = false;
            }
        });
    }

    async function loadReorderPages(file) {
        if (!pageList || typeof pdfjsLib === 'undefined') return;
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
                }

                pageList.appendChild(li);
            }

            if (typeof Sortable !== 'undefined') {
                new Sortable(pageList, {
                    animation: 150,
                    ghostClass: 'sortable-ghost',
                    draggable: '.reorder-item',
                    onEnd: function() {
                        const items = pageList.querySelectorAll('.reorder-item');
                        pageOrder = Array.from(items).map(item => parseInt(item.dataset.page, 10));
                    }
                });
            }
        } catch (err) {
            alert('Error al cargar la vista previa: ' + err.message);
        }
    }

    if (reorderBtn) {
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
    }

    // ============================================================
    // 6. COMPRESS (COMPRIMIR)
    // ============================================================
    let compressFile = null;
    const dropZoneCompress = document.getElementById('dropZoneCompress');
    const fileInputCompress = document.getElementById('fileInputCompress');
    const compressBtn = document.getElementById('compressBtn');

    if (dropZoneCompress && fileInputCompress) {
        dropZoneCompress.addEventListener('click', () => fileInputCompress.click());
        fileInputCompress.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                compressFile = e.target.files[0];
                const nameEl = document.getElementById('compressFileName');
                if (nameEl) nameEl.textContent = '📄 ' + compressFile.name;
                if (compressBtn) compressBtn.disabled = false;
            }
        });
    }

    if (compressBtn) {
        compressBtn.addEventListener('click', async () => {
            if (!compressFile || typeof pdfjsLib === 'undefined') return;

            showLoading(true);
            showStatus('compressStatus', '⏳ Optimizando y comprimiendo el PDF...');

            try {
                const qualityEl = document.getElementById('compressQuality');
                const quality = qualityEl ? parseFloat(qualityEl.value) : 0.6;
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
    }
});
