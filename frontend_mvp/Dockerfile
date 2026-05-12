FROM node:20 AS builder
WORKDIR /app

# Copia os arquivos de dependência e instala
COPY package.json ./
RUN npm install

# Copia o código fonte e gera a build de produção (pasta dist)
COPY . .

# Expõe a URL do backend para o Vite bake na build estática
ENV VITE_API_URL=https://mfs-backend-564952987470.us-central1.run.app

RUN npm run build

# Stage 2: Produção (Nginx)
FROM nginx:alpine

# Copia apenas os arquivos estáticos gerados no Stage 1
COPY --from=builder /app/dist /usr/share/nginx/html

# Configuração simples para React Router (redirecionar 404 para index.html)
RUN echo 'server { \
    listen 8080; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
