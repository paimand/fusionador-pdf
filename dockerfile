# Imagen base ligera de Node.js
FROM node:20-slim

# Instalar LibreOffice y tipografías estándar para un renderizado perfecto de documentos
RUN apt-get update && apt-get install -y \
    libreoffice \
    fonts-liberation \
    fonts-dejavu-core \
    fontconfig \
    && rm -rf /var/lib/apt-get/lists/*

# Crear el directorio de trabajo
WORKDIR /usr/src/app

# Copiar manifiestos de dependencias
COPY package*.json ./

# Instalar dependencias de producción
RUN npm ci --only=production

# Copiar todo el código fuente de la aplicación
COPY . .

# Exponer el puerto por defecto de Render
EXPOSE 3000

# Comando de arranque de la aplicación
CMD ["node", "server.js"]
