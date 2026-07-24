const express = require('express');
const multer = require('multer');
const path = require('path');
const util = require('util');
const { PDFDocument } = require('pdf-lib');
const libre = require('libreoffice-convert');
const libreConvert = util.promisify(libre.convert);

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Multer para almacenar archivos en memoria (búfer)
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // Límite de 50 MB
});

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================
// 1. UNIR PDFS (/merge)
// ============================================================
app.post('/merge', upload.array('files'), async (req, res) => {
    try {
        if (!req.files || req.files.length < 2) {
            return res.status(400).send('Debes subir al menos 2 archivos PDF para unirlos.');
        }

        const mergedPdf = await PDFDocument.create();

        for (const file of req.files) {
            const pdfToMerge = await PDFDocument.load(file.buffer);
            const copiedPages = await mergedPdf.copyPages(pdfToMerge, pdfToMerge.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
        }

        const pdfBytes = await mergedPdf.save();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="unido.pdf"');
        res.send(Buffer.from(pdfBytes));
    } catch (error) {
        console.error('Error al unir PDFs:', error);
        res.status(500).send(`Error al unir PDFs: ${error.message}`);
    }
});

// ============================================================
// 2. DIVIDIR PDF (/split)
// ============================================================
app.post('/split', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send('No se subió ningún archivo PDF.');

        const { mode, ranges } = req.body;
        const srcPdf = await PDFDocument.load(req.file.buffer);
        const totalPages = srcPdf.getPageCount();

        const newPdf = await PDFDocument.create();
        let pagesToKeep = [];

        if (mode === 'ranges' && ranges) {
            const parts = ranges.split(',');
            parts.forEach(part => {
                part = part.trim();
                if (part.includes('-')) {
                    const [start, end] = part.split('-').map(Number);
                    for (let i = start; i <= end; i++) {
                        if (i >= 1 && i <= totalPages) pagesToKeep.push(i - 1);
                    }
                } else {
                    const pageNum = Number(part);
                    if (pageNum >= 1 && pageNum <= totalPages) pagesToKeep.push(pageNum - 1);
                }
            });
        } else {
            for (let i = 0; i < totalPages; i++) pagesToKeep.push(i);
        }

        const copiedPages = await newPdf.copyPages(srcPdf, pagesToKeep);
        copiedPages.forEach(page => newPdf.addPage(page));

        const pdfBytes = await newPdf.save();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="dividido.pdf"');
        res.send(Buffer.from(pdfBytes));
    } catch (error) {
        console.error('Error al dividir PDF:', error);
        res.status(500).send(`Error al dividir PDF: ${error.message}`);
    }
});

// ============================================================
// 3. ELIMINAR PÁGINAS (/delete-pages)
// ============================================================
app.post('/delete-pages', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send('No se subió ningún archivo PDF.');

        const pagesToDeleteStr = req.body.pages || '';
        const srcPdf = await PDFDocument.load(req.file.buffer);
        const totalPages = srcPdf.getPageCount();

        const pagesToDelete = new Set();
        const parts = pagesToDeleteStr.split(',');
        parts.forEach(part => {
            part = part.trim();
            if (part.includes('-')) {
                const [start, end] = part.split('-').map(Number);
                for (let i = start; i <= end; i++) pagesToDelete.add(i - 1);
            } else if (part) {
                pagesToDelete.add(Number(part) - 1);
            }
        });

        const newPdf = await PDFDocument.create();
        const pagesToKeep = [];
        for (let i = 0; i < totalPages; i++) {
            if (!pagesToDelete.has(i)) pagesToKeep.push(i);
        }

        if (pagesToKeep.length === 0) {
            return res.status(400).send('No se pueden eliminar todas las páginas del PDF.');
        }

        const copiedPages = await newPdf.copyPages(srcPdf, pagesToKeep);
        copiedPages.forEach(page => newPdf.addPage(page));

        const pdfBytes = await newPdf.save();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="modificado.pdf"');
        res.send(Buffer.from(pdfBytes));
    } catch (error) {
        console.error('Error al eliminar páginas:', error);
        res.status(500).send(`Error al eliminar páginas: ${error.message}`);
    }
});

// ============================================================
// 4. EXTRAER PÁGINAS (/extract-pages)
// ============================================================
app.post('/extract-pages', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send('No se subió ningún archivo PDF.');

        const pagesToExtractStr = req.body.pages || '';
        const srcPdf = await PDFDocument.load(req.file.buffer);
        const totalPages = srcPdf.getPageCount();

        const pagesToExtract = [];
        const parts = pagesToExtractStr.split(',');
        parts.forEach(part => {
            part = part.trim();
            if (part.includes('-')) {
                const [start, end] = part.split('-').map(Number);
                for (let i = start; i <= end; i++) {
                    if (i >= 1 && i <= totalPages) pagesToExtract.push(i - 1);
                }
            } else if (part) {
                const num = Number(part);
                if (num >= 1 && num <= totalPages) pagesToExtract.push(num - 1);
            }
        });

        if (pagesToExtract.length === 0) {
            return res.status(400).send('Debes especificar al menos una página válida.');
        }

        const newPdf = await PDFDocument.create();
        const copiedPages = await newPdf.copyPages(srcPdf, pagesToExtract);
        copiedPages.forEach(page => newPdf.addPage(page));

        const pdfBytes = await newPdf.save();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="extraido.pdf"');
        res.send(Buffer.from(pdfBytes));
    } catch (error) {
        console.error('Error al extraer páginas:', error);
        res.status(500).send(`Error al extraer páginas: ${error.message}`);
    }
});

// ============================================================
// 5. REORDENAR PÁGINAS (/reorder-pages)
// ============================================================
app.post('/reorder-pages', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send('No se subió ningún archivo PDF.');

        const orderStr = req.body.order || '';
        const newOrder = orderStr.split(',').map(n => Number(n.trim()) - 1);

        const srcPdf = await PDFDocument.load(req.file.buffer);
        const newPdf = await PDFDocument.create();

        const copiedPages = await newPdf.copyPages(srcPdf, newOrder);
        copiedPages.forEach(page => newPdf.addPage(page));

        const pdfBytes = await newPdf.save();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="reordenado.pdf"');
        res.send(Buffer.from(pdfBytes));
    } catch (error) {
        console.error('Error al reordenar páginas:', error);
        res.status(500).send(`Error al reordenar páginas: ${error.message}`);
    }
});

// ============================================================
// 6. COMPRIMIR PDF (/compress)
// ============================================================
app.post('/compress', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send('No se subió ningún archivo PDF.');

        const srcPdf = await PDFDocument.load(req.file.buffer, { ignoreEncryption: true });
        const pdfBytes = await srcPdf.save({ useObjectStreams: true });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="comprimido.pdf"');
        res.send(Buffer.from(pdfBytes));
    } catch (error) {
        console.error('Error al comprimir PDF:', error);
        res.status(500).send(`Error al comprimir PDF: ${error.message}`);
    }
});

// ============================================================
// 7. CONVERTIR A PDF (/convert-to-pdf) - OPTIMIZADO
// ============================================================
app.post('/convert-to-pdf', upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        if (!file || !file.buffer) {
            return res.status(400).send('No se recibió ningún archivo o el búfer está vacío.');
        }

        const ext = path.extname(file.originalname).toLowerCase();
        const baseName = path.parse(file.originalname).name;

        // --- A. IMÁGENES (JPG, JPEG, PNG, WEBP, BMP) ---
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'];
        if (imageExtensions.includes(ext)) {
            const pdfDoc = await PDFDocument.create();
            let image;

            // 1. Intentar incrustar JPG/PNG directamente (Ultrarrápido, < 1 segundo)
            try {
                if (ext === '.png') {
                    image = await pdfDoc.embedPng(file.buffer);
                } else if (ext === '.jpg' || ext === '.jpeg') {
                    image = await pdfDoc.embedJpg(file.buffer);
                } else {
                    throw new Error('Formato requiere conversión previa');
                }
            } catch (errDirect) {
                // 2. Si falla (JPG CMYK/Progresivo o WEBP), procesar con sharp
                const pngBuffer = await sharp(file.buffer).png().toBuffer();
                image = await pdfDoc.embedPng(pngBuffer);
            }

            const page = pdfDoc.addPage([image.width, image.height]);
            page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });

            const pdfBytes = await pdfDoc.save();
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${baseName}.pdf"`);
            return res.send(Buffer.from(pdfBytes));
        }

        // --- B. DOCUMENTOS OFFICE (WORD, POWERPOINT, EXCEL) ---
        const officeExtensions = ['.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx'];
        if (officeExtensions.includes(ext)) {
            const pdfBuffer = await libreConvert(file.buffer, '.pdf', undefined);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${baseName}.pdf"`);
            return res.send(Buffer.from(pdfBuffer));
        }

        return res.status(400).send('Formato de archivo no soportado.');

    } catch (error) {
        console.error('Error detallado en conversión:', error);
        res.status(500).send(`Error en servidor: ${error.message}`);
    }
});

// Iniciar Servidor
app.listen(PORT, () => {
    console.log(`Servidor activo escuchando en el puerto ${PORT}`);
});
