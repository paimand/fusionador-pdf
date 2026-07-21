// Configuración de PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Elementos DOM
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const fileListEl = document.getElementById('fileList');
const fileCountSpan = document.getElementById('fileCount');
const mergeBtn = document.getElementById('mergeBtn');
const clearBtn = document.getElementById('clearBtn');
const loadingDiv = document.getElementById('loading');

// Estado
let fileList = []; // Array de objetos File

// Inicializar Sortable en la lista
const sortable = new Sortable(fileListEl, {
  animation: 150,
  ghostClass: 'sortable-ghost',
  onEnd: function(evt) {
    // Reordenar el array fileList según el nuevo orden DOM
    const [moved] = fileList.splice(evt.oldIndex, 1);
    fileList.splice(evt.newIndex, 0, moved);
    updateFileCount();
  }
});

// --- Funciones auxiliares ---

// Actualizar contador
function updateFileCount() {
  fileCountSpan.textContent = fileList.length;
}

// Limpiar la lista (vaciar todo)
function clearList() {
  fileList = [];
  fileListEl.innerHTML = '';
  updateFileCount();
  fileInput.value = ''; // resetear input
}

// Eliminar un archivo por índice
function removeFile(index) {
  fileList.splice(index, 1);
  renderList();
}

// Renderizar toda la lista desde el array fileList
function renderList() {
  fileListEl.innerHTML = '';
  fileList.forEach((file, index) => {
    const li = createListItem(file, index);
    fileListEl.appendChild(li);
  });
  updateFileCount();
  // Sortable ya está vinculado al mismo elemento, no es necesario reiniciar.
}

// Crear elemento <li> para un archivo (con miniatura)
function createListItem(file, index) {
  const li = document.createElement('li');
  li.dataset.index = index;

  // Contenedor de miniatura
  const thumbDiv = document.createElement('div');
  thumbDiv.className = 'thumbnail';
  const canvas = document.createElement('canvas');
  thumbDiv.appendChild(canvas);
  li.appendChild(thumbDiv);

  // Info del archivo
  const infoDiv = document.createElement('div');
  infoDiv.className = 'file-info';
  const nameSpan = document.createElement('span');
  nameSpan.className = 'file-name';
  nameSpan.textContent = file.name;
  const metaSpan = document.createElement('span');
  metaSpan.className = 'file-meta';
  const sizeKB = (file.size / 1024).toFixed(1);
  metaSpan.textContent = `${sizeKB} KB`;
  infoDiv.appendChild(nameSpan);
  infoDiv.appendChild(metaSpan);
  li.appendChild(infoDiv);

  // Botón eliminar
  const delBtn = document.createElement('button');
  delBtn.className = 'delete-btn';
  delBtn.textContent = '×';
  delBtn.title = 'Eliminar este archivo';
  delBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    removeFile(index);
  });
  li.appendChild(delBtn);

  // Generar miniatura con PDF.js
  generateThumbnail(file, canvas);

  return li;
}

// Generar miniatura de la primera página usando PDF.js
async function generateThumbnail(file, canvas) {
  try {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    const scale = 0.5;
    const viewport = page.getViewport({ scale });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext('2d');
    await page.render({ canvasContext: context, viewport }).promise;
  } catch (error) {
    console.warn('No se pudo generar la miniatura para', file.name, error);
    // Mostrar un mensaje en el canvas
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#999';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Vista previa no disponible', canvas.width/2, canvas.height/2);
  }
}

// Leer archivo como ArrayBuffer (promesa)
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e.target.error);
    reader.readAsArrayBuffer(file);
  });
}

// --- Manejo de selección de archivos ---

function handleFiles(files) {
  if (!files || files.length === 0) return;

  // Filtrar solo PDF
  const pdfFiles = Array.from(files).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
  if (pdfFiles.length === 0) {
    alert('Por favor selecciona solo archivos PDF.');
    return;
  }

  // Agregar al final de la lista
  for (const file of pdfFiles) {
    fileList.push(file);
  }
  renderList();

  // Resetear el input para permitir seleccionar los mismos archivos de nuevo
  fileInput.value = '';
}

// Eventos del input file
fileInput.addEventListener('change', (e) => {
  handleFiles(e.target.files);
});

// Drag and drop en la zona
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.style.background = '#e8edff';
  dropZone.style.borderColor = '#4a6cf7';
});

dropZone.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dropZone.style.background = '#fafafa';
  dropZone.style.borderColor = '#aaa';
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.style.background = '#fafafa';
  dropZone.style.borderColor = '#aaa';
  const files = e.dataTransfer.files;
  handleFiles(files);
});

// Hacer clic en la zona para abrir el selector de archivos
dropZone.addEventListener('click', () => {
  fileInput.click();
});

// --- Botones ---

// Vaciar lista
clearBtn.addEventListener('click', clearList);

// Unir PDFs
mergeBtn.addEventListener('click', async () => {
  if (fileList.length === 0) {
    alert('No hay archivos para unir.');
    return;
  }

  // Deshabilitar botón y mostrar loading
  mergeBtn.disabled = true;
  loadingDiv.style.display = 'block';

  try {
    // Crear FormData y añadir archivos en el orden actual
    const formData = new FormData();
    for (const file of fileList) {
      formData.append('pdfs', file);
    }

    const response = await fetch('/merge', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Error al fusionar');
    }

    // Descargar el PDF resultante
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'merged.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

  } catch (error) {
    alert('Error al fusionar: ' + error.message);
    console.error(error);
  } finally {
    mergeBtn.disabled = false;
    loadingDiv.style.display = 'none';
  }
});

// Inicializar contador
updateFileCount();