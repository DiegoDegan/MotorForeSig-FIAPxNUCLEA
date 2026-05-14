# Backend — Descrição dos Scripts Python

> Gerado em 2026-05-13. Cobre todos os `.py` dentro de `backend/`.

---

## Índice

| Arquivo | Categoria | Resumo |
|---|---|---|
| `main_rest_api.py` | API | Servidor FastAPI principal — expõe todos os endpoints |
| `run_pipeline.py` | Orquestrador | Executa o pipeline de dados de ponta a ponta |
| `config/settings.py` | Config | Carrega variáveis de ambiente via Pydantic |
| `config/logging_config.py` | Config | Configura logging estruturado para todos os scripts |
| `core/gcs_manager.py` | Core | Wrapper para leitura/escrita no Google Cloud Storage |
| `core/model_trainer.py` | Core | Treina os modelos de PD e atraso e salva como `.joblib` |
| `core/explicabilidade.py` | Core | Gera explicações SHAP em linguagem de negócio |
| `scripts/limpeza.py` | Pipeline | Limpeza e feature engineering dos CSVs brutos |
| `scripts/extrair_metricas_grafo.py` | Pipeline | Calcula PageRank e centralidade via NetworkX / Neo4j |
| `scripts/montar_base_modelagem.py` | Pipeline | Consolida todas as fontes em `base_modelagem.csv` |
| `scripts/atualizar_politicas_dinamicas.py` | Pipeline | Atualiza `politica_risco.yaml` com thresholds baseados em dados |
| `scripts/pipeline_operacional.py` | Pipeline | Executa inferência e aplica regras de decisão de crédito |
| `scripts/upload_neo4j.py` | Utilitário | Carrega transações no banco de grafos Neo4j |
| `scripts/backtest_suite.py` | Análise | Backtest temporal out-of-time do modelo de PD |
| `scripts/monitor_data_drift.py` | Análise | Monitora drift de dados via PSI |
| `scripts/analise_sobrevivencia.py` | Análise | Análise de sobrevivência Kaplan-Meier por coorte de risco |

---

## Fluxo de Dados

```
data/raw/
  │
  ▼
[limpeza.py]
  │  base_boletos_tratados.csv
  │  base_auxiliar_tratada.csv
  ▼
[extrair_metricas_grafo.py]
  │  grafo_features_mfs.csv
  ▼
[montar_base_modelagem.py]
  │  base_modelagem.csv
  ├──▶ [atualizar_politicas_dinamicas.py] → backend/config/politica_risco.yaml
  └──▶ [model_trainer.py] → backend/models/*.joblib
          │
          ▼
     [pipeline_operacional.py]
          │  pipeline_report_mesacredito.csv
          ▼
     main_rest_api.py  (carrega tudo em memória via lifespan)
          │
          ▼
     Frontend Dashboard (React) — consome via HTTP/JWT
```

---

## Detalhamento por Arquivo

---

### `main_rest_api.py`

**Categoria:** API  
**Execução:** `uvicorn backend.main_rest_api:app --host 0.0.0.0 --port 8000`

Servidor FastAPI com 14 endpoints protegidos por JWT e 1 público. Todos os modelos ML e dados de portfólio são carregados **uma única vez** no startup via `lifespan` context manager — não há recarga por requisição.

**O que faz:**
- Autentica via `POST /v1/token` (usuário/senha definidos em `.env`)
- Serve KPIs de portfólio, fila de mesa de crédito, grafo de risco sistêmico, métricas de governança
- Executa scoring PD em tempo real com explicação SHAP via `POST /v1/predict`
- Se `GCP_BUCKET_NAME` estiver definido, sincroniza `.joblib` e CSVs do GCS antes de servir qualquer requisição (via `GCSManager.sync_initial_assets`)

**Endpoints principais:**

| Método | Rota | Consumidor |
|---|---|---|
| POST | `/v1/token` | Frontend — login inicial |
| GET | `/v1/health` | GCP health check (público) |
| GET | `/v1/portfolio/summary` | `CockpitScreen` |
| GET | `/v1/credit/pipeline` | `MesaCreditoScreen` |
| POST | `/v1/credit/operations/action` | `MesaCreditoScreen` (aprovar/bloquear) |
| GET | `/v1/systemic/risk` | `RiscoSistemicoScreen` (grafo force-directed) |
| GET | `/v1/governance/metrics` | `GovernancaScreen` (AUC, KS, PSI, Kaplan-Meier) |
| POST | `/v1/predict` | Uso direto via API / testes |
| GET | `/v1/pd/summary` | `GovernancaScreen` |
| GET | `/v1/politica/summary` | `GovernancaScreen` |
| GET | `/v1/pipeline/report` | `MesaCreditoScreen` |
| GET | `/v1/metrics/macro` | `CockpitScreen` |

**Arquivos lidos em runtime:**
- `data/processed/pipeline_report_mesacredito.csv`
- `data/processed/base_boletos_tratados.csv`
- `data/processed/base_auxiliar_tratada.csv`
- `data/processed/grafo_features_mfs.csv`
- `backend/models/modelo_pd.joblib`, `modelo_atraso.joblib`, `scaler.joblib`, `features.joblib`

**Consumido por:** Frontend (React) — `src/services/api.ts` roteia todas as chamadas para este servidor.

---

### `run_pipeline.py`

**Categoria:** Orquestrador  
**Execução:** `python backend/run_pipeline.py`

Encadeia 5 scripts em sequência via `subprocess`, com verificação de código de retorno. Aborta na primeira falha.

**Sequência de execução:**

| Passo | Script |
|---|---|
| 1 | `scripts/limpeza.py` |
| 2 | `scripts/montar_base_modelagem.py` |
| 3 | `scripts/atualizar_politicas_dinamicas.py` |
| 4 | `core/model_trainer.py` |
| 5 | `scripts/pipeline_operacional.py` |

> Nota: `extrair_metricas_grafo.py` não está na sequência do orquestrador — deve ser executado manualmente antes de `montar_base_modelagem.py` quando os dados de grafo precisarem ser atualizados.

**Consumido por:** Execução manual ou CI/CD para atualizar toda a base antes de um novo ciclo de análise.

---

### `config/settings.py`

**Categoria:** Config

Carrega o arquivo `.env` da raiz e expõe as configurações como singleton via `get_settings()` (injetável via `Depends` no FastAPI).

**Variáveis gerenciadas:**
- Credenciais Neo4j (`NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`)
- Auth da API (`API_SECRET_KEY`, `API_ADMIN_USER`, `API_ADMIN_PASSWORD`)
- Thresholds de risco (`MAX_PD_THRESHOLD`, `DIAS_ATRASO_DEFAULT`)
- URL base do BACEN

**Consumido por:** `config/logging_config.py`, `run_pipeline.py`

---

### `config/logging_config.py`

**Categoria:** Config

Define um formatter padronizado (timestamp + nível + módulo) e suprime logs verbosos de bibliotecas externas (`urllib3`, `neo4j`, `requests`). Expõe `setup_logging()` que retorna um logger configurado.

**Consumido por:** Todos os scripts do pipeline de dados.

---

### `core/gcs_manager.py`

**Categoria:** Core

Wrapper sobre `google-cloud-storage`. Opera em **modo local** se `GCP_BUCKET_NAME` não estiver definido (sem erros).

**Funcionalidades:**
- `sync_initial_assets()` — baixa `.joblib` e CSVs do bucket para o container na inicialização
- `upload_report()` — envia `pipeline_report_mesacredito.csv` para `gs://bucket/reports/`
- `upload_decision_log()` — persiste logs de auditoria de crédito como JSON em `gs://bucket/decision_logs/YYYY-MM-DD/`

**Consumido por:** `main_rest_api.py` — instanciado no `lifespan` e reutilizado nos endpoints de ação de crédito.

---

### `core/model_trainer.py`

**Categoria:** Core  
**Execução:** `python backend/core/model_trainer.py`

Treina dois modelos RandomForest sobre `base_modelagem.csv`:
1. **Classificador PD** (`RandomForestClassifier`, `class_weight="balanced"`) — prediz probabilidade de inadimplência
2. **Regressor de atraso** (`RandomForestRegressor`) — prediz dias de atraso esperados

Calcula e loga métricas no Weights & Biases: AUC-ROC, KS statistic, PSI, RMSE.

**Produz:**
- `backend/models/modelo_pd.joblib`
- `backend/models/modelo_atraso.joblib`
- `backend/models/scaler.joblib`
- `backend/models/features.joblib`

**Consumido por:** `pipeline_operacional.py` (carrega os `.joblib`); `main_rest_api.py` (carrega no startup).

---

### `core/explicabilidade.py`

**Categoria:** Core

Implementa `RiscoExplainer` — carrega o modelo PD e instancia `shap.TreeExplainer` para gerar explicações dos scores.

**O que faz por predição:**
- Computa os 3 maiores valores SHAP absolutos
- Mapeia features técnicas para fatores de negócio (conectividade, exposição, liquidez, setor, materialidade)
- Classifica risco em CRÍTICO / ALTO / MÉDIO / BAIXO
- Retorna texto em português para o campo `parecer_ia_shap`

**Consumido por:** `scripts/pipeline_operacional.py` — chamado para cada boleto na fase de inferência.

---

### `scripts/limpeza.py`

**Categoria:** Pipeline  
**Execução:** Passo 1 do `run_pipeline.py`

Carrega os CSVs brutos de `data/raw/`, realiza parsing de datas, calcula `dias_atraso`, cria flags `pagou` e `default` (atraso > 60 dias), e preenche valores ausentes na base auxiliar com medianas.

**Produz:**
- `data/processed/base_boletos_tratados.csv`
- `data/processed/base_auxiliar_tratada.csv`

**Consumido por:** `montar_base_modelagem.py`, `upload_neo4j.py`, `main_rest_api.py`.

---

### `scripts/extrair_metricas_grafo.py`

**Categoria:** Pipeline  
**Execução:** Manual (antes de `montar_base_modelagem.py`)

Tenta conexão com Neo4j GDS (AuraDB); em caso de falha, usa NetworkX localmente. Constrói um grafo dirigido `pagador → beneficiario` a partir das transações de boletos e calcula:
- **PageRank** de pagadores e beneficiários
- **Degree centrality**
- **Exposição de contágio reverso** (soma de exposição de pagadores arriscados por cedente)

**Produz:** `data/processed/grafo_features_mfs.csv`

**Consumido por:** `montar_base_modelagem.py` (merge na base de modelagem); `main_rest_api.py` endpoint `/v1/systemic/risk`.

---

### `scripts/montar_base_modelagem.py`

**Categoria:** Pipeline  
**Execução:** Passo 2 do `run_pipeline.py`

Faz três merges sequenciais:
1. `base_boletos_tratados.csv` + `base_auxiliar_tratada.csv` (por `id_pagador = id_cnpj`) → adiciona CNAE, materialidade, liquidez
2. Resultado + `grafo_features_mfs.csv` (por `id_pagador`) → adiciona features de rede

Remove colunas temporais e categóricas pesadas; preenche NaN com 0.

**Produz:** `data/processed/base_modelagem.csv`

**Consumido por:** `model_trainer.py`, `pipeline_operacional.py`, `atualizar_politicas_dinamicas.py`, `backtest_suite.py`, `monitor_data_drift.py`, `analise_sobrevivencia.py`.

---

### `scripts/atualizar_politicas_dinamicas.py`

**Categoria:** Pipeline  
**Execução:** Passo 3 do `run_pipeline.py`

Analisa `base_modelagem.csv` para derivar políticas de risco baseadas em dados históricos:

- **CNAEs bloqueados (Tier 1):** taxa de default > 50% e ≥ 5 operações → `REPROVADO_SETORES_CRITICOS`
- **CNAEs em alerta (Tier 2):** taxa de default entre 40-50% → `ANALISE_MESA`
- **Cedentes tóxicos:** taxa de default ≥ 30% e ≥ 10 operações → `REPROVADO_CEDENTE_TOXICO`

**Produz:** `backend/config/politica_risco.yaml` (sobrescreve)

**Consumido por:** `pipeline_operacional.py` (lê o YAML para aplicar as regras em cada boleto).

---

### `scripts/pipeline_operacional.py`

**Categoria:** Pipeline  
**Execução:** Passo 5 do `run_pipeline.py`

Aplica os modelos treinados sobre toda a base de modelagem e classifica cada boleto com uma decisão de política:

| Prioridade | Condição | Decisão |
|---|---|---|
| 1 | CNAE na lista Tier 1 | `REPROVADO_SETORES_CRITICOS` |
| 2 | Cedente na lista bloqueada | `REPROVADO_CEDENTE_TOXICO` |
| 3 | PD ≥ 0.70 | `REPROVADO_AUTO` |
| 4 | 0.40 ≤ PD < 0.70 ou CNAE Tier 2 | `ANALISE_MESA` |
| 5 | PD < 0.15 | `APROVADO_AUTO` |

Para cada boleto, aciona `RiscoExplainer` (SHAP) para preencher `parecer_ia_shap`.

**Produz:** `data/processed/pipeline_report_mesacredito.csv`  
Colunas: `id_boleto`, `id_pagador`, `id_beneficiario`, `vlr_nominal`, `score_pd_bruto`, `perda_esperada_el`, `atraso_previsto`, `decisao_politica`, `parecer_ia_shap`

**Consumido por:** `main_rest_api.py` — base de todos os endpoints de crédito e portfólio do frontend.

---

### `scripts/upload_neo4j.py`

**Categoria:** Utilitário  
**Execução:** Manual (opcional)

Carrega `base_boletos_tratados.csv` no Neo4j via Cypher `MERGE`, criando nós `Empresa` e relacionamentos `PAGOU_PARA` com metadados de transação (valor nominal, datas, inadimplência, dias de atraso). Opera em lotes de 1.000 registros.

**Requer:** Variáveis de ambiente `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`.

**Consumido por:** `extrair_metricas_grafo.py` — quando a opção Neo4j GDS está disponível, consome o grafo criado por este script para computar PageRank com algoritmos distribuídos.

---

### `scripts/backtest_suite.py`

**Categoria:** Análise  
**Execução:** Manual (`python backend/scripts/backtest_suite.py`)

Realiza validação out-of-time do modelo PD: separa a base cronologicamente (80% treino / 20% teste), treina um classificador no coorte histórico e avalia no coorte futuro. Gera relatório de impacto financeiro:
- Volume de boletos e defaults no período de teste
- Perda evitada caso os boletos de alto risco fossem bloqueados
- Taxa de falsos positivos (bons pagadores bloqueados)

**Produz:** Relatório no console (sem arquivo de saída).

**Não é consumido pela API ou frontend** — ferramenta de análise para o time de modelagem.

---

### `scripts/monitor_data_drift.py`

**Categoria:** Análise  
**Execução:** Manual (`python backend/scripts/monitor_data_drift.py`)

Calcula o PSI (Population Stability Index) para as features monitoradas (`vlr_nominal`, `pagerank_vizinhanca`), comparando a primeira metade da base (treino) com a segunda (atual). Classifica o status:

| PSI | Status |
|---|---|
| < 0.10 | ESTÁVEL |
| 0.10 – 0.25 | ALERTA |
| ≥ 0.25 | DRIFT CRÍTICO |

**Produz:** `auditoria_drift.csv`

**Não é consumido pela API ou frontend** — ferramenta MLOps para monitoramento periódico.

---

### `scripts/analise_sobrevivencia.py`

**Categoria:** Análise  
**Execução:** Manual (`python backend/scripts/analise_sobrevivencia.py`)

Ajusta curvas de Kaplan-Meier estratificadas por grupo de risco (baixo vs. alto, baseado em percentis de `vlr_nominal`). Gera a curva de sobrevivência: probabilidade de não inadimplência ao longo dos dias de atraso.

**Produz:**
- `grafico_sobrevivencia_km.png`
- `curva_sobrevivencia_baixo_risco.csv` / `curva_sobrevivencia_alto_risco.csv`

**Consumido por:** `main_rest_api.py` — endpoint `GET /v1/governance/metrics` lê os CSVs para alimentar o componente Kaplan-Meier na tela `GovernancaScreen` do frontend.

---

## Dependências entre Scripts

```
limpeza.py
  └──▶ montar_base_modelagem.py
         └──▶ atualizar_politicas_dinamicas.py ──▶ politica_risco.yaml
         └──▶ model_trainer.py ──▶ *.joblib
         └──▶ pipeline_operacional.py ──▶ pipeline_report_mesacredito.csv
         └──▶ backtest_suite.py (análise independente)
         └──▶ monitor_data_drift.py (análise independente)
         └──▶ analise_sobrevivencia.py (análise independente)

extrair_metricas_grafo.py ──▶ grafo_features_mfs.csv
  (entrada para montar_base_modelagem.py)

upload_neo4j.py ──▶ Neo4j AuraDB
  (entrada para extrair_metricas_grafo.py quando Neo4j GDS disponível)

main_rest_api.py (consome tudo, serve para o frontend)
```
