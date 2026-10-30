# Motor ForeSig (MFS) - Núclea

Bem-vindo ao repositório do **Motor de Risco ForeSig (MFS)**. Este projeto é uma esteira híbrida de avaliação preditiva de risco de crédito, desenvolvida para analisar Operações de Antecipação de Recebíveis (FIDCs) de ponta a ponta.

O sistema integra:

* **Inteligência Artificial & Machine Learning**: Modelos Random Forest (Classificador de PD e Regressor de Atraso) com explicabilidade SHAP.
* **Ciência de Redes & Teoria dos Grafos**: Neo4j 5 com plugin Graph Data Science (GDS) nativo via Docker (PageRank e Degree Centrality), contando com fallback automático em NetworkX.
* **Motor de Decisão Macroprudencial**: Filtros dinâmicos de CNAEs de risco e cedentes tóxicos configuráveis via YAML.
* **Frontend Dashboard**: Interface moderna e interativa em React + Vite + TailwindCSS.

---

## Vídeo de Apresentação e Demonstração

Assista ao vídeo explicativo com a apresentação e demonstração completa do projeto:
* **YouTube:** [https://youtu.be/3FXUcSbAgAE](https://youtu.be/3FXUcSbAgAE)

---

## Documentação Técnica Completa

Para aprofundar nos fundamentos e na arquitetura do projeto, consulte a pasta [`Documentação/`](Documentação/) e materiais complementares:

* [Vídeo de Demonstração (YouTube)](https://youtu.be/3FXUcSbAgAE): Apresentação do projeto e tour pelo sistema.
* [Relatório Técnico & Executivo Final](Documentação/Relatório%20Final%20-%20MFS.md): Racional detalhado, decisões de arquitetura e defesa de banca.
* [Referência Técnica dos Scripts & API](Documentação/REFERENCIA_TECNICA_SCRIPTS.md): Guia funcional de cada script do backend, catálogo da API REST e fluxo de dados.
* [Estudo de Qualidade do Modelo (Jupyter Notebook)](Documentação/estudo_qualidade_modelo_mfs.ipynb): Análise de métricas, calibração e curvas de performance.

---

## Guia Rápido de Replicação (Setup do Zero)

Siga os passos abaixo para rodar o projeto completo (Banco de Grafos Neo4j, Backend FastAPI e Frontend React) em qualquer computador.

### 1. Pré-Requisitos

* **Python 3.11 a 3.13** instalado com pip ([python.org](https://www.python.org/downloads/)).
* **Node.js 18+** e npm instalados ([nodejs.org](https://nodejs.org/)).
* **Docker & Docker Compose** (ex: Docker Desktop) instalado e em execução ([docker.com](https://www.docker.com/)).
* **Git** instalado.

---

### 2. Clonar e Configurar o Ambiente Python

No terminal (PowerShell ou Bash), na raiz do repositório:

```bash
# 1. Criar e ativar o ambiente virtual (.venv)
python -m venv .venv

# Windows (PowerShell):
.\\.venv\\Scripts\\Activate.ps1
# Linux / macOS:
source .venv/bin/activate

# 2. Instalar dependências Python
pip install -r requirements.txt
```

---

### 3. Configurar as Variáveis de Ambiente (.env)

O repositório já inclui templates prontos para uso local:

```bash
# Configuração do Backend (raiz do projeto)
# Copie o arquivo de exemplo para .env:
cp .env.example .env

# Configuração do Frontend
cp frontend_mvp/.env.example frontend_mvp/.env
```

> [!NOTE]
> As credenciais padrão do `.env.example` já vêm configuradas para conectar no container local do Neo4j (`bolt://localhost:7687`, usuário `neo4j` e senha `nuclea`).

---

### 4. Subir o Banco Neo4j com GDS via Docker

Suba o container oficial do Neo4j com o plugin Graph Data Science (GDS) pré-instalado:

```bash
docker compose up -d
```

* O serviço inicializará nas portas `7474` (HTTP / Neo4j Browser) e `7687` (Bolt).
* Aguarde cerca de 10 a 20 segundos para a JVM e o plugin GDS carregarem.

---

### 5. Executar a Esteira de Dados e IA (Pipeline Mestre com Smart Sync)

Execute a esteira unificada que limpa os dados brutos, sincroniza com o banco de grafos, extrai métricas, treina os modelos preditivos e gera os relatórios operacionais:

```bash
python backend/run_pipeline.py
```

> [!TIP]
> **Sincronização Inteligente com o Neo4j (Smart Sync):**  
> Logo após a limpeza higienizar os CSVs brutos, o `run_pipeline.py` verifica automaticamente a conectividade do Neo4j:
> * Se o Neo4j estiver online e sem dados, executa o `upload_neo4j.py` automaticamente.
> * Se o banco já estiver populado, pula a carga para economizar tempo.
> * Se o Neo4j estiver offline, prossegue sem travar a esteira, acionando o fallback automático em memória via **NetworkX**.

#### Carga Manual no Banco Neo4j (Opcional)

Se você preferir rodar a injeção de transações no Neo4j de forma avulsa para consultas visuais no Neo4j Browser (`http://localhost:7474`):

```bash
python backend/scripts/upload_neo4j.py
```

---

### 6. Iniciar o Servidor Backend (FastAPI)

Na raiz do projeto com o `.venv` ativado:

```bash
uvicorn backend.main_rest_api:app --host 0.0.0.0 --port 8000 --reload
```

* A API REST estará acessível em: `http://localhost:8000`
* Documentação interativa (Swagger UI): `http://localhost:8000/docs`

---

### 7. Iniciar o Frontend (Dashboard React)

Abra outro terminal, entre na pasta do frontend e inicie a aplicação:

```bash
cd frontend_mvp
npm install
npm run dev
```

* O Dashboard estará acessível em: `http://localhost:3000`

---

## Como Operar e Testar

Com os serviços rodando, você e seus colegas têm acesso completo:

|Recurso|URL|Credenciais / Notas|
|-|-|-|
|**Painel Frontend**|`http://localhost:3000`|Interface visual: Cockpit, Mesa de Crédito, Risco Sistêmico e Governança|
|**Documentação da API**|`http://localhost:8000/docs`|Swagger interativo da API REST|
|**Neo4j Browser (Navegador)**|`http://localhost:7474`|**Connect URL:** `bolt://localhost:7687`<br>**User:** `neo4j`<br>**Password:** `nuclea`|

### Exemplo de Query Cypher para testar no Neo4j Browser:

No console do `http://localhost:7474`, execute:

```cypher
// Visualizar 50 transações e rede entre Sacados e Cedentes
MATCH (pagador:Empresa)-[t:PAGOU_PARA]->(beneficiario:Empresa)
RETURN pagador, t, beneficiario
LIMIT 50;
```

---

## Resolução de Problemas Frequentes

1. **Erro de permissão no PowerShell (`UnauthorizedAccess` ao ativar .venv):**

   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

2. **Neo4j não conecta no Docker:**

   * Verifique se o Docker Desktop está aberto e rodando.
   * Verifique o status com `docker compose ps` ou logs com `docker compose logs -f neo4j`.
   * Se o Neo4j não estiver rodando, o pipeline acionará automaticamente o fallback em memória via **NetworkX**, sem interromper a esteira.
3. **Frontend não conecta na API:**

   * Verifique se o arquivo `frontend_mvp/.env` contém `VITE_API_URL=http://localhost:8000`.

---

*MFS - Inteligência de Crédito & Redes Complexas - Núclea*
