const express = require('express');
const multer = require('multer');
const { PDFDocument } = require('pdf-lib');
const path = require('path');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const { createCanvas } = require('canvas');

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({ storage: multer.memoryStorage() });

app.use(express.static('public'));

// ========== FUNCIÓN AUXILIAR: parsear rangos ==========
function parsePageRanges(rangesStr, totalPages) {
    if (!rangesStr || rangesStr.trim() === '') return [];
    const parts = rangesStr.split(',').map(s => s.trim());
    const pageIndices = new Set();
    for (const part of parts) {
        if (part.includes('-')) {
            const [start, end] = part.split('-').map(Number);
            if (isNaN(start) || isNaN(end)) continue;
            const min = Math.max(1, start);
            const max = Math.min(totalPages, end);
            for (let i = min; i <= max; i++) {
                pageIndices.add(i - 1);
            }
        } else {
            const num = Number(part);
            if (!isNaN(num) && num >= 1 && num <= totalPages) {
                pageIndices.add(num - 1);
            }
        }
    }
    return Array.from(pageIndices).sort((a, b) => a - b);
}

// ========== RUTA: UNIR ==========
app.post('/merge', upload.array('pdfs'), async (req, res) => {
    try {
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).send('No se subió ningún archivo PDF');
        }
        const mergedPdf = await PDFDocument.create();
        for (const file of files) {
            const pdf = await PDFDocument.load(file.buffer);
            const indices = pdf.getPageIndices();
            const copiedPages = await mergedPdf.copyPages(pdf, indices);
            copiedPages.forEach(page => mergedPdf.addPage(page));
        }
        const pdfBytes = await mergedPdf.save();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=merged.pdf');
        res.send(Buffer.from(pdfBytes));
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al fusionar PDFs');
    }
});

// ========== RUTA: DIVIDIR ==========
app.post('/split', upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) return res.status(400).send('No se subió ningún archivo');
        const mode = req.body.mode;
        const rangesStr = req.body.ranges || '';
        const pdf = await PDFDocument.load(file.buffer);
        const totalPages = pdf.getPageCount();

        if (mode === 'individual') {
            return res.status(501).send('Dividir en páginas individuales requiere generar un ZIP. Pendiente de implementar.');
        } else {
            const pageIndices = parsePageRanges(rangesStr, totalPages);
            if (pageIndices.length === 0) {
                return res.status(400).send('No se especificaron rangos válidos');
            }
            const newPdf = await PDFDocument.create();
            const pages = await newPdf.copyPages(pdf, pageIndices);
            pages.forEach(p => newPdf.addPage(p));
            const pdfBytes = await newPdf.save();
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=split.pdf');
            res.send(Buffer.from(pdfBytes));
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al dividir PDF');
    }
});

// ========== RUTA: ELIMINAR PÁGINAS ==========
app.post('/delete-pages', upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) return res.status(400).send('No se subió ningún archivo');
        const pagesToDeleteStr = req.body.pagesToDelete || '';
        const pdf = await PDFDocument.load(file.buffer);
        const totalPages = pdf.getPageCount();
        const indicesToDelete = parsePageRanges(pagesToDeleteStr, totalPages);
        if (indicesToDelete.length === 0) {
            return res.status(400).send('No se especificaron páginas a eliminar');
        }
        const allIndices = Array.from({ length: totalPages }, (_, i) => i);
        const remainingIndices = allIndices.filter(i => !indicesToDelete.includes(i));
        if (remainingIndices.length === 0) {
            return res.status(400).send('No quedan páginas después de eliminar');
        }
        const newPdf = await PDFDocument.create();
        const pages = await newPdf.copyPages(pdf, remainingIndices);
        pages.forEach(p => newPdf.addPage(p));
        const pdfBytes = await newPdf.save();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=modified.pdf');
        res.send(Buffer.from(pdfBytes));
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al eliminar páginas');
    }
});

// ========== RUTA: EXTRAER PÁGINAS ==========
app.post('/extract-pages', upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) return res.status(400).send('No se subió ningún archivo');
        const pagesToExtractStr = req.body.pagesToExtract || '';
        const pdf = await PDFDocument.load(file.buffer);
        const totalPages = pdf.getPageCount();
        const indicesToExtract = parsePageRanges(pagesToExtractStr, totalPages);
        if (indicesToExtract.length === 0) {
            return res.status(400).send('No se especificaron páginas a extraer');
        }
        const newPdf = await PDFDocument.create();
        const pages = await newPdf.copyPages(pdf, indicesToExtract);
        pages.forEach(p => newPdf.addPage(p));
        const pdfBytes = await newPdf.save();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=extracted.pdf');
        res.send(Buffer.from(pdfBytes));
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al extraer páginas');
    }
});

// ========== RUTA: REORDENAR PÁGINAS ==========
app.post('/reorder-pages', upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) return res.status(400).send('No se subió ningún archivo');
        const newOrderStr = req.body.newOrder;
        if (!newOrderStr) return res.status(400).send('No se especificó el nuevo orden');
        const newOrder = JSON.parse(newOrderStr);
        if (!Array.isArray(newOrder) || newOrder.length === 0) {
            return res.status(400).send('Formato de orden inválido');
        }
        const pdf = await PDFDocument.load(file.buffer);
        const totalPages = pdf.getPageCount();
        const indices = newOrder.map(n => n - 1).filter(i => i >= 0 && i < totalPages);
        if (indices.length !== newOrder.length) {
            return res.status(400).send('Algunos números de página están fuera de rango');
        }
        const unique = new Set(indices);
        if (unique.size !== indices.length) {
            return res.status(400).send('No se permiten páginas duplicadas');
        }
        const newPdf = await PDFDocument.create();
        const pages = await newPdf.copyPages(pdf, indices);
        pages.forEach(p => newPdf.addPage(p));
        const pdfBytes = await newPdf.save();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=reordered.pdf');
        res.send(Buffer.from(pdfBytes));
    } catch (error) {
        console.error(error);
        res.status(500).send('Error al reordenar páginas');
    }
});

// ========== RUTA: COMPRIMIR PDF (Corregida) ==========
app.post('/compress', upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) return res.status(400).send('No se subió ningún archivo');

        const level = req.body.level || 'recommended';

        // 1. Cargar el PDF con pdfjs
        const data = new Uint8Array(file.buffer);
        const loadingTask = pdfjsLib.getDocument({ data });
        const pdf = await loadingTask.promise;
        const totalPages = pdf.numPages;

        // 2. Ajustar parámetros de compresión según nivel
        let maxDimension, quality;
        switch (level) {
            case 'extreme':
                maxDimension = 800;
                quality = 0.5; // 50%
                break;
            case 'recommended':
                maxDimension = 1200;
                quality = 0.7; // 70%
                break;
            case 'low':
                maxDimension = 1800;
                quality = 0.85; // 85%
                break;
            default:
                maxDimension = 1200;
                quality = 0.7;
        }

        const newPdf = await PDFDocument.create();

        // 3. Procesar página por página
        for (let i = 1; i <= totalPages; i++) {
            const page = await pdf.getPage(i);
            
            // Obtener el viewport base a escala 1.0
            const unscaledViewport = page.getViewport({ scale: 1.0 });
            
            // Calcular la escala de reducción requerida
            const currentMax = Math.max(unscaledViewport.width, unscaledViewport.height);
            let scale = 1.0;
            if (currentMax > maxDimension) {
                scale = maxDimension / currentMax;
            }

            // Crear el viewport escalado exactamente a las nuevas dimensiones
            const viewport = page.getViewport({ scale });

            const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
            const context = canvas.getContext('2d');

            // Rellenar fondo blanco limpio antes de renderizar
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, canvas.width, canvas.height);

            // Renderizar la página PDF en el Canvas con el viewport escalado
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            // Obtener buffer JPEG optimizado directamente de canvas
            const jpegBuffer = canvas.toBuffer('image/jpeg', { quality: quality });

            // Incrustar en el nuevo documento PDF
            const img = await newPdf.embedJpg(jpegBuffer);
            const newPage = newPdf.addPage([viewport.width, viewport.height]);
            
            newPage.drawImage(img, {
                x: 0,
                y: 0,
                width: viewport.width,
                height: viewport.height,
            });
        }

        const pdfBytes = await newPdf.save();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=compressed_${level}.pdf`);
        res.send(Buffer.from(pdfBytes));

    } catch (error) {
        console.error('Error al comprimir:', error);
        res.status(500).send('Error al comprimir el PDF');
    }
});

// ========== INICIO DEL SERVIDOR ==========
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
