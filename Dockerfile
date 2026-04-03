# Imagem base enxuta com Python 3.11
FROM python:3.11-slim

# Variáveis para otimizar o Python em contêineres e o gestor de pacotes
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Configurar diretório de trabalho
WORKDIR /app

# Instalar dependências essenciais de sistema (necessárias para XGBoost, Pandas, etc.)
# Realiza a limpeza de cache do apt na mesma camada para reduzir o tamanho final da imagem
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Aproveitar cache de camadas do Docker: Copiar dependências primeiro
COPY requirements.txt .

# Instalar pacotes Python
RUN pip install --no-cache-dir -r requirements.txt

# Segurança: Criar e usar um usuário não-root (Cloud Run Best Practices)
RUN addgroup --system appgroup && adduser --system --group appuser \
    && chown -R appuser:appgroup /app
USER appuser

# Copiar todo o código-fonte restante do projeto (ETL, Core, Pipeline)
COPY . .

# Expor a porta que o Cloud Run usa por padrão
EXPOSE 8080

# Subir a aplicação via Uvicorn (FastAPI) de forma performática
CMD ["uvicorn", "backend.core.main:app", "--host", "0.0.0.0", "--port", "8080"]
