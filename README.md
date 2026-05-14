# Motor ForeSig (MFS) - Núclea

Bem-vindo ao repositório do **Motor de Risco ForeSig (MFS)**. Este projeto é uma esteira de avaliação preditiva de risco de crédito de última geração, desenvolvida para analisar Operações de Antecipação de Recebíveis (FIDCs) de forma ponta a ponta.

O sistema integra **Inteligência Artificial (Machine Learning/SHAP)**, **Dinâmica das Redes (Graph DB/Neo4j AuraDB)** e **Políticas Macroprudenciais Dinâmicas** em um ecossistema Cloud Native.

---

## Documentação Detalhada
Para mergulhar nos detalhes técnicos e de negócio, consulte a pasta `/Documentação`:
- [Arquitetura Visual](Documentação/diagrama_arquitetura_mfs.md): Mapeamento dos pipelines e fluxo GCP.
- [Documentação de Negócio](Documentação/DOCUMENTACAO_MFS.md): O racional por trás dos scores e métricas.
- [Guia de Insights](Documentação/GUIA_DATA_INSIGHTS_MFS.md): Como interpretar os relatórios e gráficos gerados.
- [Guia de Configuração](Documentação/GUIA_CONFIGURACAO_MFS.md): Passo a passo para rodar o projeto do zero.

---

## Guia Rápido (Quickstart)

### 1. Pré-Requisitos
- **Python 3.13+** (Obrigatório para compatibilidade nativa).
- **Ambiente Virtual (.venv)** configurado.

### 2. Instalação
```bash
# Clone e entre na pasta
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Credenciais (.env)
Renomeie `.env.example` para `.env` e insira suas chaves do **Neo4j AuraDB** e as configurações do **Google Cloud**.

---

## Operação do Motor

### Opção A: O Pipeline Maestro (IA + Dados)
Para processar novos dados, extrair métricas de grafo e retreinar a IA:
```bash
python backend/run_pipeline.py
```
Esse comando orquestra toda a esteira e gera os relatórios em `data/processed/`.

### Opção B: Servidor API (Dashboard)
Para disponibilizar os dados para o Frontend React:
```bash
python backend/main_rest_api.py
```
Acesse `http://localhost:8000/docs` para ver a documentação interativa (Swagger).

---

## Produção (Google Cloud Platform)
O projeto está em produção via **Cloud Run**:

*   **Dashboard:** [https://mfs-backend-564952987470.us-central1.run.app](https://mfs-backend-564952987470.us-central1.run.app)
*   **API Gateway:** [https://mfs-backend-564952987470.us-central1.run.app/docs](https://mfs-backend-564952987470.us-central1.run.app/docs)

---
*MFS - Inteligência de Crédito & Redes Complexas - v2.0.0*
