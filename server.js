const express = require('express');
const multer = require('multer');
const { PDFDocument } = require('pdf-lib');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Multer para almacenar archivos en memoria RAM
const upload = multer({ storage: multer.memoryStorage() });

// Middleware para parsing de JSON y archivos estáticos
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(express.static('public'));

// ============================================================
// ENDPOINT: MERGE (UNIR PDFs) - CORREGIDO
// ============================================================
app.post('/merge', upload.array('pdfs'), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).send('No se han subido archivos PDF.');
        }

        // Crear un documento PDF vacío
        const mergedPdf = await PDFDocument.create();

        for (const file of req.files) {
            try {
                // ⚠️ CLAVE DEL ARREGLO: 
                // ignoreEncryption: ignora protecciones/firmas bancarias SEPA
                // throwOnInvalidObject: omite pequeños errores de estructura interna
                const pdfToMerge = await PDFDocument.load(file.buffer, {
                    ignoreEncryption: true,
                    throwOnInvalidObject: false
                });

                // Copiar todas las páginas al PDF final
                const pageIndices = pdfToMerge.getPageIndices();
                const copiedPages = await mergedPdf.copyPages(pdfToMerge, pageIndices);
                copiedPages.forEach((page) => mergedPdf.addPage(page));

            } catch (fileErr) {
                console.error(`Error al procesar el archivo ${file.originalname}:`, fileErr);
                throw new Error(`El archivo "${file.originalname}" no se pudo procesar. Asegúrate de que no esté corrupto.`);
            }
        }

        // Guardar y enviar el PDF combinado
        const pdfBytes = await mergedPdf.save();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="merged.pdf"');
        return res.send(Buffer.from(pdfBytes));

    } catch (err) {
        console.error('Error general en /merge:', err);
        return res.status(500).send(err.message || 'Error interno al unir los PDFs.');
    }
});

// ============================================================
// ENDPOINT: SPLIT (DIVIDIR PDF)
// ============================================================
app.post('/split', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send('No se ha subido ningún archivo.');

        const { ranges } = req.body;
        const pdfDoc = await PDFDocument.load(req.file.buffer, { ignoreEncryption: true, throwOnInvalidObject: false });
        const newPdf = await PDFDocument.create();

        const pageIndexes = parseRanges(ranges, pdfDoc.getPageCount());
        const copiedPages = await newPdf.copyPages(pdfDoc, pageIndexes);
        copiedPages.forEach((page) => newPdf.addPage(page));

        const pdfBytes = await newPdf.save();
        res.setHeader('Content-Type', 'application/pdf');
        return res.send(Buffer.from(pdfBytes));
    } catch (err) {
        return res.status(500).send('Error al dividir PDF: ' + err.message);
    }
});

// ============================================================
// ENDPOINT: DELETE PAGES (ELIMINAR PÁGINAS)
// ============================================================
app.post('/delete-pages', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send('No se ha subido ningún archivo.');

        const { pagesToDelete } = req.body;
        const pdfDoc = await PDFDocument.load(req.file.buffer, { ignoreEncryption: true, throwOnInvalidObject: false });
        const totalPages = pdfDoc.getPageCount();

        const deleteIndexes = new Set(parseRanges(pagesToDelete, totalPages));
        const keepIndexes = Array.from({ length: totalPages }, (_, i) => i).filter(i => !deleteIndexes.has(i));

        const newPdf = await PDFDocument.create();
        const copiedPages = await newPdf.copyPages(pdfDoc, keepIndexes);
        copiedPages.forEach((page) => newPdf.addPage(page));

        const pdfBytes = await newPdf.save();
        res.setHeader('Content-Type', 'application/pdf');
        return res.send(Buffer.from(pdfBytes));
    } catch (err) {
        return res.status(500).send('Error al eliminar páginas: ' + err.message);
    }
});

// ============================================================
// ENDPOINT: EXTRACT PAGES (EXTRAER PÁGINAS)
// ============================================================
app.post('/extract-pages', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send('No se ha subido ningún archivo.');

        const { pagesToExtract } = req.body;
        const pdfDoc = await PDFDocument.load(req.file.buffer, { ignoreEncryption: true, throwOnInvalidObject: false });

        const keepIndexes = parseRanges(pagesToExtract, pdfDoc.getPageCount());

        const newPdf = await PDFDocument.create();
        const copiedPages = await newPdf.copyPages(pdfDoc, keepIndexes);
        copiedPages.forEach((page) => newPdf.addPage(page));

        const pdfBytes = await newPdf.save();
        res.setHeader('Content-Type', 'application/pdf');
        return res.send(Buffer.from(pdfBytes));
    } catch (err) {
        return res.status(500).send('Error al extraer páginas: ' + err.message);
    }
});

// ============================================================
// ENDPOINT: REORDER PAGES (REORDENAR PÁGINAS)
// ============================================================
app.post('/reorder-pages', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send('No se ha subido ningún archivo.');

        const newOrder = JSON.parse(req.body.newOrder); // Array con 1-based index: [3, 1, 2]
        const pdfDoc = await PDFDocument.load(req.file.buffer, { ignoreEncryption: true, throwOnInvalidObject: false });

        const zeroBasedIndexes = newOrder.map(num => num - 1);

        const newPdf = await PDFDocument.create();
        const copiedPages = await newPdf.copyPages(pdfDoc, zeroBasedIndexes);
        copiedPages.forEach((page) => newPdf.addPage(page));

        const pdfBytes = await newPdf.save();
        res.setHeader('Content-Type', 'application/pdf');
        return res.send(Buffer.from(pdfBytes));
    } catch (err) {
        return res.status(500).send('Error al reordenar páginas: ' + err.message);
    }
});

// ============================================================
// ENDPOINT: COMPRESS (COMPRIMIR DESDE IMÁGENES CLIENTE)
// ============================================================
app.post('/compress', async (req, res) => {
    try {
        const { images } = req.body;
        if (!images || !Array.isArray(images) || images.length === 0) {
            return res.status(400).send('No se recibieron imágenes para reconstruir el PDF.');
        }

        const newPdf = await PDFDocument.create();

        for (const dataUrl of images) {
            const base64Data = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
            const imgBuffer = Buffer.from(base64Data, 'base64');

            const embeddedImg = await newPdf.embedJpg(imgBuffer);
            const page = newPdf.addPage([embeddedImg.width, embeddedImg.height]);
            page.drawImage(embeddedImg, {
                x: 0,
                y: 0,
                width: embeddedImg.width,
                height: embeddedImg.height,
            });
        }

        const pdfBytes = await newPdf.save();
        res.setHeader('Content-Type', 'application/pdf');
        return res.send(Buffer.from(pdfBytes));
    } catch (err) {
        return res.status(500).send('Error al comprimir PDF: ' + err.message);
    }
});

// ============================================================
// FUNCIÓN AUXILIAR: PARSEAR RANGOS (ej. "1,3,5-8")
// ============================================================
function parseRanges(rangeStr, maxPages) {
    const indexes = [];
    if (!rangeStr) return indexes;

    const parts = rangeStr.split(',');
    for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.includes('-')) {
            const [start, end] = trimmed.split('-').map(n => parseInt(n, 10));
            if (!isNaN(start) && !isNaN(end)) {
                for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
                    if (i >= 1 && i <= maxPages) indexes.push(i - 1);
                }
            }
        } else {
            const page = parseInt(trimmed, 10);
            if (!isNaN(page) && page >= 1 && page <= maxPages) {
                indexes.push(page - 1);
            }
        }
    }
    return indexes;
}

// Iniciar Servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
});
