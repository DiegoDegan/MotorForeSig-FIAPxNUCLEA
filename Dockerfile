# Stage 1: Build & Python Setup
FROM python:3.11-slim

# Evitar que o Python gere arquivos .pyc e garantir output em tempo real nos logs do GCP
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

WORKDIR /app

# Instalar dependências de sistema (necessárias para algumas libs de ML se houver compilação)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements e instalar
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar o código do backend
COPY backend/ /app/backend/

# Criar diretórios que o lifespan tentará sincronizar se não existirem
RUN mkdir -p /app/backend/models /app/data/processed /app/data/raw

# Definir variável de ambiente para o gCloud SDK encontrar as credenciais no Cloud Run
# (O Cloud Run injeta a Service Account automaticamente, mas setamos os caminhos base)
ENV PYTHONPATH=/app/backend

# Porta padrão do Cloud Run
EXPOSE 8080

# Comando para rodar a API usando uvicorn com workers para concorrência
CMD ["uvicorn", "backend.main_rest_api:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "2"]
