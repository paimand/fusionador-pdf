# 1. Imagen base oficial de Node.js (versión ligera basada en Debian)
FROM node:20-slim

# 2. Instalar LibreOffice, tipografías y herramientas de imágenes/PDF
RUN apt-get update && apt-get install -y \
    libreoffice \
    fonts-liberation \
    fonts-dejavu-core \
    fontconfig \
    poppler-utils \
    imagemagick \
    && rm -rf /var/lib/apt/lists/*

# 3. Directorio de trabajo en el contenedor
WORKDIR /usr/src/app

# 4. Copiar package.json y package-lock.json
COPY package*.json ./

# 5. Instalar dependencias de producción de Node.js
RUN npm install --only=production

# 6. Copiar todo el código de tu proyecto
COPY . .

# 7. Puerto en el que escucha la aplicación
EXPOSE 3000

# 8. Comando para arrancar el servidor
CMD ["node", "server.js"]
