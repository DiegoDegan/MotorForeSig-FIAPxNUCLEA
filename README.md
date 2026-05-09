# 🚀 Motor ForeSig (MFS) - Núclea Ribeiro

Bem-vindo ao repositório do **Motor de Risco ForeSig (MFS)**. Este projeto é uma esteira de avaliação preditiva de risco de crédito, desenvolvida para analisar Operações de Antecipação de Recebíveis (FIDCs) de forma ponta a ponta.

O projeto abandona as planilhas estáticas e une **Inteligência Artificial (Machine Learning/SHAP)**, **Dinâmica das Redes (Graph DB/Neo4j)** e **Macroeconomia Brasileira (Integração BACEN)**.

---

## 📋 Arquitetura Macro
Se você quiser entender a profundidade das peças do Motor, verifique os documentos contidos nesta base:
- `DOCUMENTACAO_MFS.md`: Explicação em linguagem de negócio de como a máquina opera.
- `diagrama_arquitetura_mfs.md`: A arquitetura visual mapeando os pipelines Python.
- `GUIA_DATA_INSIGHTS_MFS.md`: Guia de consumo das planilhas e auditoria de insights do MVP.

---

## 🛠️ Guia Rápido de Instalação (Quickstart)

### 1. Pré-Requisitos
- Python 3.10 ou 3.11 instalado.
- Acesso à internet liberado (para consumo automático da API do BACEN).
- Módulo Git instalado.

### 2. Configurando o Ambiente Virtual
Clone o repositório e crie o interpretador fechado para não dar conflito (sandbox):
```bash
python -m venv .venv
source .venv/bin/activate       # No Linux/Mac
.venv\Scripts\activate          # No Windows (Powershell)
```

### 3. Instalando as Dependências
Com o ambiente ativado, instale as bibliotecas. O arquivo de requisitos possui as **versões exatas (pinned)** testadas em produção para garantir 100% de integridade no processamento dos scripts:
```bash
pip install -r requirements.txt
```

### 4. Configurando Credenciais (Neo4j AuraDB)
Nós usamos variáveis ocultas para conectar ao banco de Grafos. Renomeie o arquivo `.env.example` na raiz para `.env` e aplique as credenciais de leitura/escrita do banco Neo4j:
```env
NEO4J_URI=neo4j+s://seu-codigo-aqui.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=sua-senha-secreta-aqui
```
> *Nota:* Se o banco Neo4j cair, o motor possui um fallback automático acionando redes matemáticas locais em memória (*NetworkX*) para manter a esteira viva.

---

## ⚙️ Como Operar a Esteira (Como Usuário)

Existem duas formas de rodar este Motor. Você pode rodar em modo processamento pesado (Retreino Batch) ou plugar numa API Frontend ágil.

### Opção A: O Full-Pipeline (Retreino e Geração da Mesa)
Sempre que novos boletos caírem, você pode e *deve* mandar a IA re-estudar o universo executando:
```bash
python run_all.py
```
Esse master-script executará a Limpeza, sugará os juros do BACEN, extrairá contágio em Grafo, retreinará os modelos Random Forest, atualizará o YAML Macroprudencial e imprimirá no seu Console o Relatório FIDC.

### Opção B: Servidor API (Integração com Telas Web / Frontend)
Se quiser acoplar o MFS a um painel (React/Angular) para consultas instantâneas de Risco de Boleto Online, inicie o servidor **FastAPI**:
```bash
uvicorn backend.main_rest_api:app --host 0.0.0.0 --port 8080 --reload
```
Acesse `http://localhost:8080/docs` no seu navegador para utilizar o **Swagger UI** da ML API.

### ☁️ Produção e Nuvem (GCP)
O projeto está configurado para escalabilidade total no **Google Cloud Platform (GCP)** em arquitetura serverless:

*   🌐 **Live Dashboard:** [https://mfs-dashboard-243998235267.us-central1.run.app](https://mfs-dashboard-243998235267.us-central1.run.app)
*   ⚙️ **API de Produção:** [https://mfs-api-243998235267.us-central1.run.app/docs](https://mfs-api-243998235267.us-central1.run.app/docs)

Para gerenciar o deploy, utilize os arquivos `cloudbuild-frontend.yaml` e as rotinas de containerização descritas no capítulo de infraestrutura da `DOCUMENTACAO_MFS.md`.

---
*MFS - Inteligência de Crédito & Redes Complexas - v1.3.0*
