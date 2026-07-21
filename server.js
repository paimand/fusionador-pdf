const express = require('express');
const multer = require('multer');
const { PDFDocument } = require('pdf-lib');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de multer (almacenamiento en memoria)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB límite
});

// Servir archivos estáticos (frontend)
app.use(express.static('public'));

// Ruta para fusionar PDFs
app.post('/merge', upload.array('pdfs'), async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).send('No se subió ningún archivo PDF');
    }

    // Crear un nuevo documento PDF
    const mergedPdf = await PDFDocument.create();

    // Recorrer los archivos en el orden recibido
    for (const file of files) {
      // Cargar el PDF desde el buffer
      const pdf = await PDFDocument.load(file.buffer);
      // Copiar todas sus páginas
      const indices = pdf.getPageIndices();
      const copiedPages = await mergedPdf.copyPages(pdf, indices);
      copiedPages.forEach(page => mergedPdf.addPage(page));
    }

    // Guardar el PDF combinado
    const pdfBytes = await mergedPdf.save();

    // Enviar como descarga
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=merged.pdf');
    res.send(Buffer.from(pdfBytes));

  } catch (error) {
    console.error('Error al fusionar:', error);
    res.status(500).send('Error interno al procesar los PDFs');
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});