# Estágio de Produção: Servindo com Nginx
FROM nginx:alpine

# Copiar a build para o diretório de servidor do Nginx
COPY frontend_mvp/dist /usr/share/nginx/html

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
