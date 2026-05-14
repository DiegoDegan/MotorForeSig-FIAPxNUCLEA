# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Nuclea MFS** (Motor ForeSig) is a hybrid credit risk engine for a FIDC (Fundo de Investimento em Direitos Creditórios). It combines ML models, graph-based network analysis (Neo4j/NetworkX), and macroeconomic data (BACEN API) to score boletos before they are purchased.

The system has two deployable parts:
- **Backend**: FastAPI REST API (`backend/main_rest_api.py`) — deployed to GCP Cloud Run
- **Frontend**: React + Vite dashboard (`frontend_mvp/`) — deployed to GCP Cloud Run via Nginx

---

## Backend Commands

```bash
# Activate venv (Windows)
.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Run API locally (from repo root)
uvicorn backend.main_rest_api:app --host 0.0.0.0 --port 8000 --reload

# Run individual data pipeline scripts (from repo root)
python backend/scripts/limpeza.py
python backend/scripts/get_bacen_data.py
python backend/scripts/extrair_metricas_grafo.py
python backend/scripts/montar_base_modelagem.py
python backend/scripts/pipeline_operacional.py

# Train/retrain ML models (requires data/processed/base_modelagem.csv)
python backend/core/model_trainer.py

# Update dynamic risk policies (rewrites backend/config/politica_risco.yaml)
python backend/scripts/atualizar_politicas_dinamicas.py
```

## Frontend Commands

```bash
cd frontend_mvp

# Install dependencies
npm install

# Dev server (port 3000)
npm run dev

# Type-check (lint)
npm run lint

# Production build
npm run build
```

---

## Architecture

### Data Pipeline Flow

Scripts run in sequence to produce the credit pipeline output:

1. `limpeza.py` — cleans raw CSVs from `data/raw/` → `data/processed/`
2. `get_bacen_data.py` — fetches SELIC/IPCA from BACEN API → `data/cache/`
3. `extrair_metricas_grafo.py` — builds graph features (PageRank, degree) using NetworkX or Neo4j → `data/processed/grafo_features_mfs.csv`
4. `montar_base_modelagem.py` — merges all sources → `data/processed/base_modelagem.csv`
5. `atualizar_politicas_dinamicas.py` — analyzes defaults per CNAE sector and blocked cedentes, rewrites `backend/config/politica_risco.yaml`
6. `pipeline_operacional.py` — applies ML models + YAML hard rules to produce `data/processed/pipeline_report_mesacredito.csv` with one decision stamp per boleto (`APROVADO_AUTO`, `ANALISE_MESA`, `REPROVADO_*`)

### Backend (FastAPI)

`backend/main_rest_api.py` is the single-file API. Key design decisions:
- **ML models are loaded once at startup** via the `lifespan` context manager into the global `ml_components` dict. Do not reload them per-request.
- **GCS sync on boot**: If `GCP_BUCKET_NAME` is set, `GCSManager.sync_initial_assets()` downloads `.joblib` models and CSV files from Cloud Storage before serving any requests. This makes the container stateless.
- **SHAP explainer** (`shap.TreeExplainer`) is instantiated once at startup alongside the PD model and reused for every `/v1/predict` call.
- **Auth**: MVP uses a single hardcoded user (`admin_mfs`). All dashboard endpoints require a Bearer JWT obtained via `POST /v1/token`. The token secret is set via `API_SECRET_KEY` in `.env`.

### Risk Decision Logic

The hybrid engine in `pipeline_operacional.py` applies rules in this priority order:
1. Blocked CNAEs (`filtros_macroprudenciais.cnaes_bloqueados_tier1`) → `REPROVADO_SETORES_CRITICOS`
2. Blocked cedentes → `REPROVADO_CEDENTE_TOXICO`
3. PD score > `nota_corte_reprovacao_pd` (default 0.70) → `REPROVADO_AUTO`
4. PD score between `nota_encaminhamento_mesa_pd` (0.40) and 0.70, or alert-tier CNAE → `ANALISE_MESA`
5. Otherwise → `APROVADO_AUTO`

Risk thresholds live in `backend/config/politica_risco.yaml` and are hot-reloadable without code changes.

### Frontend (React + Vite)

Four screens wired in `src/App.tsx` via sidebar navigation:
- **CockpitScreen** (`modules/cockpit/`) — portfolio KPIs, sector distribution, rejection breakdown
- **MesaCreditoScreen** (`modules/mesa-credito/`) — credit operations queue with approve/block actions
- **RiscoSistemicoScreen** (`modules/risco-sistemico/`) — force-directed graph of beneficiary↔payer network
- **GovernancaScreen** (`modules/governanca/`) — model metrics (AUC, KS, PSI), Kaplan-Meier survival curve, audit log

All API calls go through `src/services/api.ts`, which manages token caching and auto-refresh on 401. The base URL is set via `VITE_API_URL` env var (defaults to `http://localhost:8000`).

### GCP Production

| Service | URL |
|---|---|
| Frontend Dashboard | `https://mfs-dashboard-243998235267.us-central1.run.app` |
| Backend API Docs | `https://mfs-api-243998235267.us-central1.run.app/docs` |
| Asset Bucket | `gs://nuclea-mfs-assets-8138/` |

To update models in production: upload new `.joblib` files to `gs://nuclea-mfs-assets-8138/models/`, then restart the `mfs-api` Cloud Run service so `lifespan` re-syncs.

---

## Environment Variables

Backend `.env` (root):
- `GCP_BUCKET_NAME` — enables GCS asset sync on boot; omit to run fully locally
- `API_SECRET_KEY`, `API_ADMIN_USER`, `API_ADMIN_PASSWORD` — JWT auth credentials
- `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` — only needed if running graph scripts against AuraDB
- `MAX_PD_THRESHOLD`, `DIAS_ATRASO_DEFAULT` — override default risk thresholds

Frontend `.env` (`frontend_mvp/.env`):
- `VITE_API_URL` — backend base URL (e.g. `http://localhost:8000` for local dev)
- `GEMINI_API_KEY` — for Gemini AI integration
