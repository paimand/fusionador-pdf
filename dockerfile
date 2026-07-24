FROM node:20-slim

# Instalar LibreOffice y fuentes de texto
RUN apt-get update && apt-get install -y \
    libreoffice \
    fonts-liberation \
    fonts-dejavu-core \
    fontconfig \
    && rm -rf /var/lib/apt-get/lists/*

WORKDIR /usr/src/app

COPY package*.json ./

# Usamos 'npm install' en lugar de 'npm ci' para evitar errores si no hay package-lock.json
RUN npm install --only=production

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
