# Referência Técnica: Scripts & API Backend (Motor MFS)

> **Documentação de Engenharia — Motor ForeSig (MFS) v2.5**  
> Cobre todos os módulos, scripts operacionais, modelos preditivos e endpoints da API REST em `backend/`.

---

## 1. Índice de Componentes

| Arquivo | Camada | Papel no Sistema |
|---|---|---|
| `run_pipeline.py` | Orquestrador | Orquestrador Mestre — executa a esteira end-to-end de 6 etapas |
| `main_rest_api.py` | API REST | Servidor FastAPI de alta performance (12 endpoints, carregamento em RAM via `lifespan`) |
| `config/settings.py` | Configuração | Gestão centralizada de variáveis de ambiente via Pydantic BaseSettings |
| `config/logging_config.py` | Configuração | Logging padronizado com supressão de ruídos de bibliotecas externas |
| `config/politica_risco.yaml` | Governança | Regras macroprudenciais duras, thresholds de corte e listas dinâmicas |
| `core/model_trainer.py` | Machine Learning | Treina modelos Random Forest (PD e Regressão de Atraso) com tracking no W&B |
| `core/explicabilidade.py` | XAI | Tradutor de explicabilidade SHAP TreeExplainer para pareceres de negócio |
| `core/gcs_manager.py` | Infraestrutura | Integração com Google Cloud Storage para operação stateless na nuvem |
| `scripts/limpeza.py` | Pipeline (Etapa 1) | Sanitização, parsing temporal e criação do target de default |
| `scripts/extrair_metricas_grafo.py` | Pipeline (Etapa 2) | Extração de PageRank, Centralidade e Contágio Reverso (Neo4j GDS + NetworkX) |
| `scripts/montar_base_modelagem.py` | Pipeline (Etapa 3) | Consolidação 1:1 de dados transacionais, cadastrais e métricas de grafo |
| `scripts/atualizar_politicas_dinamicas.py` | Pipeline (Etapa 4) | Análise de toxidade setorial/cedentes e reescrita de `politica_risco.yaml` |
| `scripts/pipeline_operacional.py` | Pipeline (Etapa 6) | Aplicação em lote de regras duras + IA + SHAP ➔ `pipeline_report_mesacredito.csv` |
| `scripts/upload_neo4j.py` | Utilitário | Carga em lote no Neo4j para navegação visual e consultas Cypher |
| `scripts/backtest_suite.py` | Análise | Validação temporal *out-of-time* (80/20) e cálculo de perda evitada |
| `scripts/monitor_data_drift.py` | MLOps | Monitoramento de Population Stability Index (PSI) |
| `scripts/analise_sobrevivencia.py` | Atuarial | Estimador de sobrevivência Kaplan-Meier por coorte de risco |

---

## 2. Fluxo de Dados e Orquestração (`run_pipeline.py`)

O script `backend/run_pipeline.py` encadeia automaticamente **6 etapas sequenciais** via `subprocess`. Caso ocorra qualquer falha em uma das etapas, a esteira é abortada com código de erro diferente de zero para garantir a integridade analítica.

```
data/raw/ (base_boletos_fiap.csv + base_auxiliar_fiap.csv)
  │
  ▼
[Etapa 1: limpeza.py]
  │  Produz: base_boletos_tratados.csv e base_auxiliar_tratada.csv
  │
  ▼  [Smart Sync] Verifica se o Neo4j está ativo e sem dados
  ├──▶ (Se online e vazio) ──▶ Executa upload_neo4j.py automaticamente
  ├──▶ (Se online e populado) ➔ Pula upload para ganho de tempo
  └──▶ (Se offline) ──────────➔ Emite aviso e segue para fallback NetworkX
  │
  ▼
[Etapa 2: extrair_metricas_grafo.py] (Neo4j GDS Docker / Fallback NetworkX)
  │  Produz: grafo_features_mfs.csv (PageRank, Grau e Contágio Reverso)
  ▼
[Etapa 3: montar_base_modelagem.py]
  │  Produz: base_modelagem.csv
  ├──▶ [Etapa 4: atualizar_politicas_dinamicas.py] ──▶ backend/config/politica_risco.yaml
  └──▶ [Etapa 5: core/model_trainer.py] ─────────────▶ backend/models/*.joblib
          │
          ▼
     [Etapa 6: pipeline_operacional.py]
          │  Produz: data/processed/pipeline_report_mesacredito.csv
          ▼
     main_rest_api.py (FastAPI Gateway — Carrega dados e modelos em RAM via lifespan)
          │
          ▼
     Frontend Dashboard (React 19 + Vite + TailwindCSS)
```

---

## 3. Detalhamento dos Scripts

---

### `run_pipeline.py`
* **Categoria:** Orquestrador Master (com Smart Sync de Grafos)
* **Como executar:** `python backend/run_pipeline.py`
* **Responsabilidade:**
  1. Detecta dinamicamente o executável Python do ambiente virtual (`.venv/Scripts/python.exe` no Windows ou `.venv/bin/python` no Linux/macOS).
  2. Executa a esteira determinística com verificação inteligente de banco de grafos:
     - Passo 1: `backend/scripts/limpeza.py`
     - **[Smart Sync]**: Avalia a conectividade do Neo4j. Se o banco estiver online e sem entidades, executa automaticamente `upload_neo4j.py`. Se já estiver populado, preserva o banco e pula a carga. Se o Neo4j estiver indisponível, emite aviso e prossegue para que o passo 2 ative o fallback em memória via NetworkX.
     - Passo 2: `backend/scripts/extrair_metricas_grafo.py`
     - Passo 3: `backend/scripts/montar_base_modelagem.py`
     - Passo 4: `backend/scripts/atualizar_politicas_dinamicas.py`
     - Passo 5: `backend/core/model_trainer.py`
     - Passo 6: `backend/scripts/pipeline_operacional.py`
  3. Garante que qualquer falha intermediária em etapas obrigatórias interrompa imediatamente o processo (`sys.exit(1)`).

---

### `main_rest_api.py`
* **Categoria:** API REST Gateway
* **Como executar:** `uvicorn backend.main_rest_api:app --host 0.0.0.0 --port 8000 --reload`
* **Arquitetura de Memória (`lifespan`):**
  - Carrega todos os modelos serializados (`.joblib`), explicadores SHAP (`TreeExplainer`) e bases tratadas **uma única vez na inicialização** dentro do dicionário global `ml_components`.
  - Se a variável `GCP_BUCKET_NAME` estiver preenchida, sincroniza automaticamente os ativos do Google Cloud Storage antes de abrir o socket de atendimento.
  - Provê métricas macroeconômicas cacheadas em memória (`ipca_acumulado`, `dolar_comercial`) com alta disponibilidade.

#### Catálogo Completo de Endpoints (12 Rotas):

| Método | Rota | Autenticação | Consumidor Frontend | Finalidade |
|---|---|---|---|---|
| **POST** | `/v1/token` | Pública | Login / `api.ts` | Autenticação via formulário OAuth2; retorna Bearer JWT |
| **GET** | `/v1/health` | Pública | Cloud Run / Health Check | Verificação de integridade e liveness do container |
| **GET** | `/v1/metrics/macro` | JWT | `CockpitScreen` | Indicadores macroeconômicos (IPCA, Dólar) |
| **POST** | `/v1/predict` | JWT | Mesa / Testes / Simulações | Scoring em tempo real de boleto individual com justificativa SHAP |
| **GET** | `/v1/systemic/risk` | JWT | `RiscoSistemicoScreen` | Grafo relacional D3 (nós, arestas, PageRank e clusters de contágio) |
| **GET** | `/v1/governance/metrics`| JWT | `GovernancaScreen` | Métricas de auditoria: AUC-ROC, KS, PSI e dados Kaplan-Meier |
| **GET** | `/v1/portfolio/summary` | JWT | `CockpitScreen` | KPIs consolidados: VME, inadimplência D+1, HHI, exposição setorial |
| **GET** | `/v1/credit/pipeline` | JWT | `PoliticaRejeicaoScreen` (Mesa) | Fila operacional com vereditos de crédito, valores e pareceres |
| **POST** | `/v1/credit/operations/action` | JWT | `PoliticaRejeicaoScreen` (Mesa) | Ação de operador humano (Aprovar / Bloquear boleto na mesa) |
| **GET** | `/v1/pd/summary` | JWT | `PDPerdaEstimadaScreen` | Distribuição de PD, provisão total ($EL$) e dispersão de atrasos |
| **GET** | `/v1/politica/summary` | JWT | `ConcentracaoScreen` | Estatísticas de enquadramento, cortes de política e limites |
| **GET** | `/v1/pipeline/report` | JWT | `PoliticaRejeicaoScreen` / Exportação | Relatório completo de pipeline com filtros avançados |

---

### `scripts/limpeza.py`
* **Categoria:** Pipeline (Etapa 1 do `run_pipeline.py`)
* **Entradas:** `data/raw/base_boletos_fiap.csv`, `data/raw/base_auxiliar_fiap.csv`
* **Processamento:**
  - Parsing e coerção de datas (`dt_emissao`, `dt_vencimento`, `dt_pagamento`).
  - Cálculo de dias de atraso: para boletos já pagos, diferença real; para boletos em aberto, diferença em relação à data de referência máxima do dataset.
  - Definição da flag de inadimplência (Target): `default = 1` se `dias_atraso > 60`, senão `0`.
  - Imputação de dados faltantes na base cadastral auxiliar via mediana.
* **Saídas:**
  - `data/processed/base_boletos_tratados.csv`
  - `data/processed/base_auxiliar_tratada.csv`

---

### `scripts/extrair_metricas_grafo.py`
* **Categoria:** Pipeline (Etapa 2 do `run_pipeline.py`)
* **Entradas:** `data/processed/base_boletos_tratados.csv`, `data/processed/base_auxiliar_tratada.csv`
* **Processamento:**
  - Conecta primariamente no **Neo4j 5 com GDS** via Docker (`bolt://localhost:7687`).
  - Executa projeção em memória (`gds.graph.project`) e algoritmos nativos de **PageRank** ponderado e **Degree Centrality**.
  - **Fallback Automático:** Caso o Neo4j não esteja em execução, ativa imediatamente o motor in-memory em **NetworkX**, construindo o grafo dirigido `id_pagador -> id_beneficiario`.
  - **Cálculo de Contágio Reverso:** Calcula para cada cedente a sua exposição financeira agregada a sacados com histórico de atraso crítico e nota de materialidade fragilizada (`total_exposed_value`, `avg_payer_risk`, `num_payers`).
* **Saída:** `data/processed/grafo_features_mfs.csv`

---

### `scripts/montar_base_modelagem.py`
* **Categoria:** Pipeline (Etapa 3 do `run_pipeline.py`)
* **Entradas:** `base_boletos_tratados.csv`, `base_auxiliar_tratada.csv`, `grafo_features_mfs.csv`
* **Processamento:**
  - Merge relacional 1:1 por `id_boleto` e `id_pagador = id_cnpj`.
  - Incorpora CNAE, métricas cadastrais, PageRank e variáveis de contágio de rede.
  - Sanitização de NaNs e codificação de colunas para consumo por algoritmos de Machine Learning.
* **Saída:** `data/processed/base_modelagem.csv`

---

### `scripts/atualizar_politicas_dinamicas.py`
* **Categoria:** Pipeline (Etapa 4 do `run_pipeline.py`)
* **Entrada:** `data/processed/base_modelagem.csv`
* **Processamento:**
  - Audita taxas históricas de default agregadas por setor econômico (CNAE) e por cedente:
    - **CNAEs Tier 1 (Bloqueio Automático):** Setores com taxa de inadimplência $> 50\%$ e volume $\ge 5$ operações ➔ `REPROVADO_SETORES_CRITICOS`.
    - **CNAEs Tier 2 (Alerta de Mesa):** Setores com taxa entre $40\%$ e $50\%$ ➔ `ANALISE_MESA`.
    - **Cedentes Tóxicos:** Fornecedores reincidentes com taxa de default $\ge 30\%$ e volume $\ge 10$ operações ➔ `REPROVADO_CEDENTE_TOXICO`.
* **Saída:** Sobrescreve `backend/config/politica_risco.yaml`.

---

### `core/model_trainer.py`
* **Categoria:** Machine Learning (Etapa 5 do `run_pipeline.py`)
* **Entrada:** `data/processed/base_modelagem.csv`
* **Processamento:**
  - Treinamento dual com **Random Forest**:
    1. **Classificador de PD:** `RandomForestClassifier(class_weight='balanced')` — estima probabilidade de inadimplência $PD \in [0, 1]$.
    2. **Regressor de Atraso:** `RandomForestRegressor()` — estima dias esperados de atraso na liquidação.
  - Avaliação de acurácia, separação e calibração: AUC-ROC, estatística KS, RMSE e PSI.
  - Registro de telemetria e artefatos no Weights & Biases (caso autenticado).
* **Saídas:**
  - `backend/models/modelo_pd.joblib`
  - `backend/models/modelo_atraso.joblib`
  - `backend/models/scaler.joblib`
  - `backend/models/features.joblib`

---

### `core/explicabilidade.py`
* **Categoria:** XAI (Explainable AI)
* **Entrada:** Modelos treinados + vetores de features
* **Processamento:**
  - Instancia `shap.TreeExplainer` sobre a árvore de decisão do modelo PD.
  - Isola as 3 maiores contribuições marginais de features (valores de Shapley).
  - Traduz jargões técnicos para categorias executivas de negócio: conectividade de rede, exposição financeira, liquidez cadastral e risco setorial.
  - Sintetiza o parecer textual final para a mesa (ex.: *"Score penalizado por exposição severa a sacados tóxicos e baixa liquidez"*).
* **Consumido por:** `pipeline_operacional.py` e endpoint `/v1/predict` da API.

---

### `scripts/pipeline_operacional.py`
* **Categoria:** Pipeline (Etapa 6 do `run_pipeline.py`)
* **Entradas:** `base_modelagem.csv`, modelos `.joblib`, `politica_risco.yaml`
* **Processamento:**
  - Aplica a cascata hierárquica de decisão em cada operação:
    1. Filtro Setorial Tier 1 ➔ `REPROVADO_SETORES_CRITICOS`
    2. Cedente na Lista Bloqueada ➔ `REPROVADO_CEDENTE_TOXICO`
    3. $PD \ge 0.70$ ➔ `REPROVADO_AUTO`
    4. $0.40 \le PD < 0.70$, atraso previsto $> 30$d ou CNAE Tier 2 ➔ `ANALISE_MESA`
    5. $PD < 0.15$ e atraso previsto $< 15$d ➔ `APROVADO_AUTO`
  - Calcula a Perda Esperada ($EL = PD \times LGD \times EAD$).
  - Invoca o `RiscoExplainer` para preencher o parecer explicável de cada ativo.
* **Saída:** `data/processed/pipeline_report_mesacredito.csv`

---

### `scripts/upload_neo4j.py`
* **Categoria:** Ingestão de Grafos / Smart Sync
* **Como executar:** `python backend/scripts/upload_neo4j.py` (ou acionado automaticamente pelo `run_pipeline.py` via Smart Sync caso o Neo4j esteja online e vazio)
* **Processamento:** Injeta em lote (batches de 1.000) as entidades `(:Empresa)` e os relacionamentos `[:PAGOU_PARA]` no Neo4j com propriedades transacionais (`vlr_nominal`, datas, default). Utilizado para permitir inspeção visual via Neo4j Browser (`http://localhost:7474`) e alimentar o cálculo nativo de GDS.

---

### `scripts/backtest_suite.py`
* **Categoria:** Análise Quantitativa
* **Como executar:** `python backend/scripts/backtest_suite.py`
* **Processamento:** Separação cronológica *out-of-time* (80% inicial para treino e 20% mais recente para teste cego). Quantifica o volume financeiro protegido contra inadimplência e taxa de falsos positivos na carteira futura.

---

### `scripts/monitor_data_drift.py`
* **Categoria:** Governança e MLOps
* **Como executar:** `python backend/scripts/monitor_data_drift.py`
* **Processamento:** Computa o Population Stability Index (PSI) das variáveis preditivas comparando distribuição de treino vs. produção.
* **Saída:** `Planilhas MVP atual/auditoria_drift.csv`

---

### `scripts/analise_sobrevivencia.py`
* **Categoria:** Modelagem Atuarial
* **Como executar:** `python backend/scripts/analise_sobrevivencia.py`
* **Processamento:** Ajusta estimadores Kaplan-Meier estratificados por faixas de risco (baixo vs. alto), estimando a probabilidade de liquidação temporal do boleto após $t$ dias de atraso.
* **Saídas:**
  - `data/processed/curva_sobrevivencia_baixo_risco.csv`
  - `data/processed/curva_sobrevivencia_alto_risco.csv`
  - `data/processed/grafico_sobrevivencia_km.png`
* **Consumido por:** Endpoint `/v1/governance/metrics` da API.

---

### `config/settings.py` e `config/logging_config.py`
* **`settings.py`:** Carrega parâmetros do `.env` na raiz via `pydantic-settings` e disponibiliza a instância singleton `settings` com injeção via `get_settings()`.
* **`logging_config.py`:** Formata logs com `[timestamp] [level] [modulo] [mensagem]` e silencia bibliotecas verbosas (`neo4j`, `urllib3`).

---

### `core/gcs_manager.py`
* **Categoria:** Cloud Storage
* **Processamento:** Gerencia a persistência de artefatos no Google Cloud Storage quando `GCP_BUCKET_NAME` está ativo:
  - `sync_initial_assets()`: Baixa modelos `.joblib` e bases processadas para o container na subida do Cloud Run.
  - `upload_report()`: Faz upload do relatório diário da mesa para `gs://<bucket>/reports/`.
  - `upload_decision_log()`: Armazena registros de auditoria em JSON para governança e compliance.
  - Em ambiente local sem bucket configurado, entra em modo no-op transparente sem interromper a execução.
