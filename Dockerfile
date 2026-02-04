# Dockerfile para ColLawRAG
FROM node:20-alpine

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar código fuente
COPY . .

# Construir la aplicación
RUN npm run build

# Exponer puerto
EXPOSE 3000

# Variables de entorno (se pueden sobrescribir)
ENV NODE_ENV=production
ENV PORT=3000

# Comando para iniciar
CMD ["npm", "start"]
