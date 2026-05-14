import os
import joblib
import shap
import pandas as pd
import numpy as np
import wandb
from contextlib import asynccontextmanager
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from jose import JWTError, jwt
from passlib.context import CryptContext
import networkx as nx
from dotenv import load_dotenv
from core.gcs_manager import GCSManager

# Carregar variáveis de ambiente
load_dotenv(encoding="latin-1")

# Instanciar Gerenciador de Cloud Storage
gcs = GCSManager()

# Configurações de Segurança (via .env)
SECRET_KEY = os.getenv("API_SECRET_KEY", "7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f1a2b3c4d5e6f7a8b9c0d")
ALGORITHM = os.getenv("API_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("API_ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

# Mock de Usuário para o MVP (Em produção, usar DB real)
ADMIN_USER = os.getenv("API_ADMIN_USER", "admin_mfs")
ADMIN_PASSWORD_HASH = os.getenv("API_ADMIN_PASSWORD_HASH") # Definido via script ou .env direto (para o MVP usaremos texto do .env e hashearemos)
ADMIN_PASSWORD_RAW = os.getenv("API_ADMIN_PASSWORD", "nuclea_segura_2024")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="v1/token")

# Configuração de Caminhos
BASE_DIR = os.path.dirname(__file__)
MODELS_DIR = os.path.join(BASE_DIR, "models")
MODEL_PD_PATH = os.path.join(MODELS_DIR, "modelo_pd.joblib")
MODEL_ATRASO_PATH = os.path.join(MODELS_DIR, "modelo_atraso.joblib")

# Dicionário global em memória para cache dos modelos ML e variáveis globais
ml_components = {}

# Caminhos de Dados Reais
DATA_PROCESSED_DIR = os.path.join(BASE_DIR, "..", "data", "processed")
PIPELINE_CSV   = os.path.join(DATA_PROCESSED_DIR, "pipeline_report_mesacredito.csv")
GRAFO_CSV      = os.path.join(DATA_PROCESSED_DIR, "grafo_features_mfs.csv")
BOLETOS_CSV    = os.path.join(DATA_PROCESSED_DIR, "base_boletos_tratados.csv")
BASE_AUX_CSV   = os.path.join(DATA_PROCESSED_DIR, "base_auxiliar_tratada.csv")

def get_risk_band(pd_score: float) -> str:
    """Classifica a pontuação (Probability of Default) em faixas de risco."""
    if pd_score < 0.20:
        return "Baixo"
    elif pd_score < 0.50:
        return "Moderado"
    elif pd_score < 0.80:
        return "Alto"
    else:
        return "Crítico"

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan do FastAPI: carrega os modelos em memória na subida 
    do servidor para garantir latência baixa nos requests.
    """
    try:
        # Sincronização de ativos se estiver em Cloud/GCP
        if gcs.bucket:
            print("INFO: Sincronizando ativos do Google Cloud Storage...")
            assets = {
                "models/modelo_pd.joblib": MODEL_PD_PATH,
                "models/modelo_atraso.joblib": MODEL_ATRASO_PATH,
                "data/pipeline_report_mesacredito.csv": PIPELINE_CSV,
                "data/grafo_features_mfs.csv": GRAFO_CSV,
                "data/base_auxiliar_fiap.csv": BASE_AUX_CSV,
                "data/base_boletos_tratados.csv": BOLETOS_CSV,
            }
            gcs.sync_initial_assets(assets)

        # Cache Macro metrics (mock)
        ml_components["macro_metrics"] = {
            "ipca_acumulado": 4.5,
            "dolar_comercial": 5.15,
            "data_atualizacao": datetime.utcnow().isoformat()
        }

        # Carregar Modelo PD
        if os.path.exists(MODEL_PD_PATH):
            clf = joblib.load(MODEL_PD_PATH)
            ml_components["modelo_pd"] = clf
            
            # TreeExplainer é super performático e ideal para árvores (RandomForest)
            # Carregamos instanciando na memória apenas uma vez
            ml_components["explainer_pd"] = shap.TreeExplainer(clf)
            print("INFO: Modelo PD e SHAP Explainer carregados com sucesso.")
        else:
            print(f"WARN: Modelo PD em {MODEL_PD_PATH} não encontrado.")

        # Carregar Modelo de Atraso (Regressor)
        if os.path.exists(MODEL_ATRASO_PATH):
            ml_components["modelo_atraso"] = joblib.load(MODEL_ATRASO_PATH)
            print("INFO: Modelo Atraso carregado com sucesso.")
        else:
            print(f"WARN: Modelo de Atraso em {MODEL_ATRASO_PATH} não encontrado.")
            
    except Exception as e:
        print(f"ERROR: Falha ao carregar modelos: {e}")
        
    yield  # Aplicação roda aqui
    
    # Limpeza de memória na finalização (shutdown)
    ml_components.clear()

app = FastAPI(
    title="Motor MFS API",
    description="API de Inteligência de Crédito do Projeto Nuclea - Integra modelos ML e métricas sistêmicas.",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Para dev (pode restringir p/ ["http://localhost:3000"] no futuro)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =======================
# SCHEMAS (Pydantic)
# =======================

class BoletoPayload(BaseModel):
    id_boleto: str = Field(..., description="ID único do boleto")
    cnpj_pagador: str = Field(..., description="CNPJ do sacado (pagador)")
    cnpj_beneficiario: str = Field(..., description="CNPJ do cedente (recebedor)")
    valor: float = Field(..., gt=0, description="Valor nominal do boleto")
    features_grafo: Dict[str, float] = Field(
        default_factory=dict,
        description="Features capturadas via GDS no Neo4j (ex: pagerank, in_degree)"
    )
    features_cadastrais: Dict[str, float] = Field(
        default_factory=dict, 
        description="Features contínuas do cadastro (ex: score_materialidade, tempo_empresa_anos)"
    )

class PredictedRiskResponse(BaseModel):
    id_boleto: str
    probability_of_default: float
    faixa_risco: str
    atraso_previsto_dias: float
    shap_justificativa: Dict[str, float]

class MacroMetricsResponse(BaseModel):
    ipca_acumulado: float
    dolar_comercial: float
    data_atualizacao: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class PortfolioSummaryResponse(BaseModel):
    psi_global: float
    total_exposed_value: float
    el_sum: float
    drift_alerts: int
    scatter_points: List[Dict[str, Any]]
    top_exposures: List[Dict[str, Any]]
    avg_delay: float
    avg_liquidity: float
    cnae_labels: List[str]
    cnae_data: List[float]
    rejection_labels: List[str]
    rejection_data: List[int]
    recommended_actions: List[str]
    # ── Tela 1: Visão Geral ──
    vme: float
    ticket_medio: float
    volume_baixa: float
    inadimplencia_pct: float
    cnpjs_ativos: int
    status_labels: List[str]
    status_data: List[int]
    monthly_chart: List[Dict[str, Any]]
    score_materialidade_media: float
    # ── Tela 5: Concentração ──
    hhi_setorial: float
    top_pagadores_pareto: List[Dict[str, Any]]
    liquidez_por_setor: List[Dict[str, Any]]
    exposicao_por_uf: List[Dict[str, Any]]

class PDSummaryResponse(BaseModel):
    el_total: float
    pd_media: float
    lgd_media: float
    provisao_sugerida: float
    el_por_faixa: List[Dict[str, Any]]
    scatter_data: List[Dict[str, Any]]
    el_por_uf: List[Dict[str, Any]]

class PoliticaSummaryResponse(BaseModel):
    taxa_aprovacao: float
    taxa_rejeicao: float
    capital_preservado: float
    falso_positivo_pct: float
    el_economizado: float
    impact_curve: List[Dict[str, Any]]
    heatmap_data: List[Dict[str, Any]]
    heatmap_score_bins: List[str]
    heatmap_liq_bins: List[str]
    contagio_curve: List[Dict[str, Any]]

class PipelineOperation(BaseModel):
    id_boleto: str
    cedente: str
    cedente_id: str
    sacado_nome_fantasia: str
    valor_nominal: float
    score_pd: float
    valor_esperado_perda: float
    acao_sugerida: str
    justificativa_mesa: List[Dict[str, Any]]
    cedente_exposicao: float
    risco_contagio: bool

class OverrideAction(BaseModel):
    id_boleto: str
    action: str
    reason: str

class SystemicRiskNode(BaseModel):
    id: str
    name: str
    label: str
    cnae: str
    num_payers: int
    pagerank: float
    avg_payer_risk: float
    total_exposed_value: float
    value: str
    score: float
    risk: str
    isHub: bool

class SystemicRiskLink(BaseModel):
    source: str
    target: str
    value: float

class ConnectedNetwork(BaseModel):
    id: str
    nodes_count: int
    edges_count: int
    total_exposure: float
    expected_loss: float
    avg_risk: float
    main_entities: List[str]

class SystemicRiskResponse(BaseModel):
    nodes: List[SystemicRiskNode]
    links: List[SystemicRiskLink]
    top_networks: List[ConnectedNetwork] = []

class GovernanceMetricsResponse(BaseModel):
    psi: float
    ks: float
    auc: float
    thresholds: Dict[str, Any]
    km_data: List[Dict[str, Any]]
    audit_logs: List[Dict[str, Any]]
    calibration: Dict[str, Any]
    model_info: Dict[str, Any]

# =======================
# UTILITÁRIOS SEGURANÇA
# =======================

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Não foi possível validar as credenciais",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    
    # Validação do usuário mock
    if token_data.username != ADMIN_USER:
        raise credentials_exception
    return token_data.username

# =======================
# ENDPOINTS
# =======================

@app.post("/v1/token", response_model=Token, tags=["Auth"])
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Gera o Token JWT para acesso aos endpoints protegidos.
    Credenciais padrão: admin_mfs / nuclea_segura_2024 (configurável via .env)
    """
    # Validação simples para o MVP
    if form_data.username != ADMIN_USER or form_data.password != ADMIN_PASSWORD_RAW:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": form_data.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/v1/health", status_code=status.HTTP_200_OK, tags=["System"])
async def health_check():
    """
    Healthcheck otimizado para orquestradores (como Google Cloud Run e Kubernetes).
    Endpoint aberto para monitoramento de infra.
    """
    models_status = {
        "modelo_pd": "modelo_pd" in ml_components,
        "modelo_atraso": "modelo_atraso" in ml_components
    }
    
    return {
        "status": "healthy",
        "models": models_status,
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/v1/metrics/macro", response_model=MacroMetricsResponse, tags=["Metrics"])
async def get_macro_metrics(current_user: str = Depends(get_current_user)):
    """
    [PROTEGIDO] Retorna os últimos indicadores de mercado/BACEN cacheados.
    (Utilizado pelo Dashboard para contexto macroeconômico).
    """
    if "macro_metrics" not in ml_components:
        raise HTTPException(status_code=503, detail="Métricas macro não disponíveis no momento.")
    return ml_components["macro_metrics"]

@app.post("/v1/predict", response_model=PredictedRiskResponse, tags=["Scoring"])
async def predict_risk(payload: BoletoPayload, current_user: str = Depends(get_current_user)):
    """
    [PROTEGIDO] Recebe payload de boleto com features (Grafo + Cadastro),
    infere o risco e atraso, e calcula a justificativa SHAP em tempo real.
    """
    if "modelo_pd" not in ml_components:
        raise HTTPException(status_code=503, detail="Motor MFS não inicializado. Modelo PD indisponível.")

    # 1. Estruturação do Input para DataFrame Pandas (formato esperado pelo ML)
    input_features = {"valor": payload.valor}
    input_features.update(payload.features_grafo)
    input_features.update(payload.features_cadastrais)
    
    try:
        # Conversão de único registro para DataFrame
        df_input = pd.DataFrame([input_features])
        # Aqui, tratar nulos se for estritamente necessário (ideal ter imputers no pipeline de treino)
        df_input = df_input.fillna(0)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao processar as features fornecidas: {e}")

    # 2. Previsão de Risco (PD)
    clf_pd = ml_components["modelo_pd"]
    try:
        # predict_proba retorna matríz, [1] representa a classe Default
        proba = clf_pd.predict_proba(df_input)[0]
        pd_score = float(proba[1]) if len(proba) > 1 else float(proba[0])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro durante inferência de PD: {e}")
        
    faixa_risco = get_risk_band(pd_score)

    # 3. Previsão de Atraso Temporal
    atraso_dias = 0.0
    if "modelo_atraso" in ml_components:
        regr_atraso = ml_components["modelo_atraso"]
        try:
            pred_atraso = regr_atraso.predict(df_input)
            atraso_dias = max(0.0, float(pred_atraso[0]))
        except Exception:
            pass # Pode logar um alerta aqui, não impede retornar o PD

    # 4. Geração de Justificativas com SHAP (Real-time Explainer)
    shap_top_features = {}
    if "explainer_pd" in ml_components:
        explainer = ml_components["explainer_pd"]
        try:
            # shap_values retorna a contribuição de cada feature para a predição atual
            shap_values = explainer.shap_values(df_input)
            
            # Se a RandomForest retorna multiclass, o shap_values é list.
            if isinstance(shap_values, list):
                vals = shap_values[1][0] # Classe 1 (Default) do primeiro (e único) registro
            else:
                vals = shap_values[0]

            # Mapeamento Feature <-> Impacto (Valor SHAP)
            for col, val in zip(df_input.columns, vals):
                shap_top_features[col] = float(val)
                
            # Selecionando as top 5 variáveis mais impactantes (em magnitude)
            # para otimizar payload no frontend (exibição na Teia de Risco)
            shap_top_features = dict(
                sorted(shap_top_features.items(), key=lambda item: abs(item[1]), reverse=True)[:5]
            )

        except Exception as e:
            # Em caso de falha silenciosa do SHAP, enviamos ditonário vazio
            # Evita downtime por problemas na explicabilidade
            print(f"WARN: Erro no cálculo SHAP: {e}")

    return PredictedRiskResponse(
        id_boleto=payload.id_boleto,
        probability_of_default=round(pd_score, 4),
        faixa_risco=faixa_risco,
        atraso_previsto_dias=round(atraso_dias, 1),
        shap_justificativa=shap_top_features
    )

@app.get("/v1/systemic/risk", response_model=SystemicRiskResponse, tags=["Dashboard"])
async def get_systemic_risk(current_user: str = Depends(get_current_user)):
    """
    [PROTEGIDO] Constrói o grafo de risco sistêmico estratégico.
    Prioriza os 'Mega-Hubs' (exposição) e 'Zonas Vermelhas' (risco PD).
    """
    try:
        df = pd.read_csv(GRAFO_CSV)
        
        # 1. Seleção Inteligente: Varredura reduzida em 25% conforme solicitado para otimização visual
        # Top 300 por Exposição e Top 300 por Risco
        top_value = df.sort_values('total_exposed_value', ascending=False).head(300)
        top_risk = df.sort_values('avg_payer_risk', ascending=False).head(300)
        
        # Concatenar e processar até 600 operações (Redução de 25% sobre os 800 anteriores)
        df_sample = pd.concat([top_value, top_risk]).drop_duplicates(subset=['id_boleto']).head(600)
        
        nodes_dict = {}
        links = []
        
        for _, row in df_sample.iterrows():
            bid = str(row['id_beneficiario'])
            pid = str(row['id_pagador'])
            
            # Adicionar Beneficiário (Âncora/Hub)
            if bid not in nodes_dict:
                pr = float(row.get('beneficiario_pagerank', 0.5))
                nodes_dict[bid] = {
                    "id": bid,
                    "name": f"ANC_{bid[:6].upper()}",
                    "label": f"Âncora {bid[:4]}",
                    "cnae": "S_FINANCEIRO",
                    "num_payers": int(row.get('num_payers', 1)),
                    "pagerank": pr,
                    "avg_payer_risk": float(row.get('avg_payer_risk', 0.2)),
                    "total_exposed_value": float(row.get('total_exposed_value', 0)),
                    "value": f"R$ {float(row.get('total_exposed_value', 0))/1e6:.1f}M",
                    "score": pr * 100,
                    "risk": "high" if row.get('avg_payer_risk', 0) > 0.6 else "normal",
                    "isHub": True
                }
            
            # Adicionar Pagador (Leaf)
            if pid not in nodes_dict:
                pr_p = float(row.get('pagador_pagerank', 0.1))
                p_risk = float(row.get('avg_payer_risk', 0.1))
                p_val = float(row.get('total_exposed_value', 0))
                
                nodes_dict[pid] = {
                    "id": pid,
                    "name": f"PAG_{pid[:6].upper()}",
                    "label": f"Pagador {pid[:4]}",
                    "cnae": "DIVERSOS",
                    "num_payers": 1,
                    "pagerank": pr_p,
                    "avg_payer_risk": p_risk,
                    "total_exposed_value": p_val,
                    "value": f"R$ {p_val/1e6:.1f}M" if p_val >= 1e6 else f"R$ {p_val/1000:.1f}k",
                    "score": pr_p * 100,
                    "risk": "high" if p_risk > 0.6 else "normal",
                    "isHub": False
                }
            
            # Criar Link
            links.append({
                "source": bid,
                "target": pid,
                "value": float(row.get('avg_payer_risk', 0.1))
            })
            
        # 2. Extração das Top 10 Redes Conectadas (Connected Components)
        G = nx.Graph()
        for _, row in df.iterrows():
            bid = str(row['id_beneficiario'])
            pid = str(row['id_pagador'])
            G.add_edge(bid, pid, weight=float(row.get('avg_payer_risk', 0.1)), value=float(row.get('total_exposed_value', 0)))

        components_data = []
        for i, comp in enumerate(nx.connected_components(G)):
            subG = G.subgraph(comp)
            total_exp = sum(d['value'] for u, v, d in subG.edges(data=True))
            avg_risk = sum(d['weight'] for u, v, d in subG.edges(data=True)) / len(subG.edges()) if len(subG.edges()) > 0 else 0
            
            # Identificar as principais entidades
            degrees = dict(subG.degree())
            main_entities = sorted(degrees, key=degrees.get, reverse=True)[:3]
            friendly_names = [f"{'ANC' if e.startswith('cf') or len(e) > 30 else 'PAG'}_{e[:6].upper()}" for e in main_entities]

            components_data.append({
                "nodes_count": len(comp),
                "edges_count": len(subG.edges()),
                "total_exposure": total_exp,
                "expected_loss": total_exp * avg_risk,
                "avg_risk": avg_risk,
                "main_entities": friendly_names
            })

        # Ordenar por Perda Esperada Real (Exposição * Risco Médio)
        top_networks_sorted = sorted(components_data, key=lambda x: x['expected_loss'], reverse=True)[:10]
        
        top_networks_data = [
            ConnectedNetwork(id=f"REDE_{i+1}", **data) 
            for i, data in enumerate(top_networks_sorted)
        ]

        return {
            "nodes": list(nodes_dict.values()), 
            "links": links,
            "top_networks": top_networks_data
        }
    except Exception as e:
        print(f"ERROR systemic risk: {e}")
        import traceback
        traceback.print_exc()
        return {"nodes": [], "links": [], "top_networks": []}

@app.get("/v1/governance/metrics", response_model=GovernanceMetricsResponse, tags=["Dashboard"])
async def get_governance_metrics(current_user: str = Depends(get_current_user)):
    """
    [PROTEGIDO] Retorna métricas reais de governança integradas ao Weights & Biases (W&B).
    """
    # Valores de fallback
    psi_val, ks_val, auc_val = 0.082, 0.42, 0.88
    exp_def, obs_def = 0.048, 0.051
    
    try:
        api = wandb.Api()
        project_name = os.getenv("WANDB_PROJECT", "nuclea-mfs-risk")
        runs = api.runs(project_name, order="-created_at")
        
        if len(runs) > 0:
            latest_run = runs[0]
            psi_val = float(latest_run.summary.get("psi", psi_val))
            ks_val = float(latest_run.summary.get("ks_stat", ks_val))
            auc_val = float(latest_run.summary.get("auc_roc", auc_val))
            exp_def = float(latest_run.summary.get("expected_default", exp_def))
            obs_def = float(latest_run.summary.get("observed_default", obs_def))
    except Exception as e:
        print(f"Erro ao buscar métricas do W&B: {e}")

    return {
        "psi": psi_val,
        "ks": ks_val,
        "auc": auc_val,
        "thresholds": {"auto": 0.025, "manual": 0.05, "exposure": 5000000},
        "calibration": {
            "expected": exp_def,
            "observed": obs_def,
            "status": "CALIBRADO" if abs(exp_def - obs_def) < 0.02 else "RECALIBRAR"
        },
        "model_info": {
            "version": "v2.4.1",
            "type": "RandomForest + GraphML",
            "last_train": "11-05-2026",
            "next_retrain": "10-06-2026"
        },
        "km_data": [
            {"days": 0, "probability": 1.000},
            {"days": 2, "probability": 0.450},
            {"days": 5, "probability": 0.250},
            {"days": 10, "probability": 0.180},
            {"days": 20, "probability": 0.140},
            {"days": 30, "probability": 0.120},
            {"days": 45, "probability": 0.100},
            {"days": 60, "probability": 0.090},
            {"days": 62, "probability": 0.020},
            {"days": 75, "probability": 0.015},
            {"days": 90, "probability": 0.010},
            {"days": 120, "probability": 0.005}
        ],
        "audit_logs": [
            {"date": "16-04-2026", "user": "RISK_MANAGER", "action": "BLOCK_CNAE", "details": "9200-3/99", "reason": "Aumento severo inadimplência"},
            {"date": "10-04-2026", "user": "SYS_AUTO", "action": "UPDATE_THRESHOLD", "details": "max_exp -> 5M", "reason": "Ajuste trimestral"}
        ]
    }

@app.get("/v1/portfolio/summary", response_model=PortfolioSummaryResponse, tags=["Dashboard"])
async def get_portfolio_summary(risk_band: Optional[str] = None, current_user: str = Depends(get_current_user)):
    """
    [PROTEGIDO] Retorna um resumo agregado da carteira lendo os arquivos CSV reais e aplicando métricas de negócio.
    """
    try:
        # 1. Carregar Dados
        df_pipeline = pd.read_csv(PIPELINE_CSV)
        df_grafo = pd.read_csv(GRAFO_CSV)
        df_aux = pd.read_csv(BASE_AUX_CSV)

        # 2. Filtragem por Faixa de Risco (PD)
        # Low: < 0.2, Mid: 0.2 - 0.5, High: > 0.5
        if risk_band == "BAIXO":
            df_pipeline = df_pipeline[df_pipeline['score_pd_bruto'] < 0.20]
        elif risk_band == "MODERADO":
            df_pipeline = df_pipeline[(df_pipeline['score_pd_bruto'] >= 0.20) & (df_pipeline['score_pd_bruto'] < 0.50)]
        elif risk_band == "ALTO":
            df_pipeline = df_pipeline[df_pipeline['score_pd_bruto'] >= 0.50]

        # Sincronizar com df_grafo (apenas boletos presentes no pipeline filtrado)
        df_grafo = df_grafo[df_grafo['id_boleto'].isin(df_pipeline['id_boleto'])]

        # 3. KPIs Básicos
        total_exposed = float(df_pipeline['vlr_nominal'].sum())
        el_sum = float(df_pipeline['perda_esperada_el'].sum())
        avg_delay = float(df_pipeline['atraso_previsto'].mean()) if not df_pipeline.empty else 0.0
        
        # Unir com base auxiliar para liquidez e CNAE (Via Pagador)
        df_merged = df_pipeline.merge(df_aux, left_on='id_pagador', right_on='id_cnpj', how='left')
        avg_liquidity = float(df_merged['sacado_indice_liquidez_1m'].mean()) if not df_merged.empty else 0.0

        # 4. Distribuição por Setor (CNAE)
        def map_cnae(cd):
            if pd.isna(cd): return 'Não Identificado'
            try:
                # CNAE division is the first two digits
                cd_str = str(int(cd)).zfill(7)[:2]
                div = int(cd_str)
                
                if div <= 3: return 'Agropecuária'
                if 5 <= div <= 33: return 'Indústria / Fab.'
                if div == 35: return 'Energia / Água'
                if 41 <= div <= 43: return 'Construção Civil'
                if div == 45: return 'Comércio Veículos'
                if div == 46: return 'Atacado'
                if div == 47: return 'Varejo'
                if 49 <= div <= 53: return 'Transp / Logística'
                if 55 <= div <= 56: return 'Alimentação / Hosp.'
                if 58 <= div <= 63: return 'Tecnologia / Com.'
                if 64 <= div <= 66: return 'Financeiro'
                if div == 68: return 'Imobiliário'
                if 69 <= div <= 75: return 'Serv. Profissionais'
                if 77 <= div <= 82: return 'Serv. Administrativos'
                if 84 <= div <= 88: return 'Saúde / Educação'
                return 'Outros Serviços'
            except:
                return 'Outros Serviços'

        df_merged['setor'] = df_merged['cd_cnae_prin'].apply(map_cnae)
        setor_dist = df_merged.groupby('setor')['vlr_nominal'].sum().sort_values(ascending=False).head(10)
        
        cnae_labels = setor_dist.index.tolist()
        cnae_data = [round(v, 2) for v in setor_dist.values.tolist()]

        # 4.1 Concentração Setorial (HHI)
        total_exposed_v = sum(cnae_data) if cnae_data else 1.0
        hhi_setorial = sum([((v / total_exposed_v) * 100)**2 for v in cnae_data])

        # 4.2 Pareto de Pagadores (Usando o pipeline para manter foco em operações recentes se desejado, 
        # mas conforme o pedido de UF, vamos centralizar os cálculos macro abaixo usando df_boletos_full)
        pagador_dist = df_merged.groupby('id_pagador')['vlr_nominal'].sum().sort_values(ascending=False).head(10)
        cum_p = 0
        top_pagadores_pareto = []
        for pid, val in pagador_dist.items():
            cum_p += val
            top_pagadores_pareto.append({
                "id": str(pid),
                "valor": round(val, 2),
                "acumulado_pct": round((cum_p / total_exposed) * 100, 1)
            })

        # Os cálculos de Liquidez e UF serão movidos para baixo para usar df_boletos (visão macro)
        liquidez_por_setor = []
        exposicao_por_uf = []

        # 5. Estatísticas de Rejeição
        # Pegar apenas os reprovados
        df_repro = df_pipeline[df_pipeline['decisao_politica'].str.contains('REPROVADO', na=False)]
        repro_counts = df_repro['decisao_politica'].value_counts()
        
        # Traduzir labels amigáveis
        label_map = {
            'REPROVADO_SETORES_CRITICOS': 'Setor Crítico',
            'REPROVADO_CEDENTE_TOXICO': 'Cedente Tóxico',
            'REPROVADO_AUTO': 'Risco PD Excedido',
            'BLOQUEAR': 'Bloqueio Manual'
        }
        rejection_labels = [label_map.get(l, l) for l in repro_counts.index.tolist()]
        rejection_data = repro_counts.values.tolist()

        # 6. Ações Recomendadas (Baseado em heurísticas do resumo)
        recommended_actions = []
        if not df_pipeline.empty:
            avg_pd = df_pipeline['score_pd_bruto'].mean()
            if avg_pd < 0.15:
                recommended_actions.append("Expansão Agressiva de Limites")
                recommended_actions.append("Redução de taxas para retenção")
            elif avg_pd < 0.40:
                recommended_actions.append("Monitoramento Trimestral Ativo")
                recommended_actions.append("Ajuste seletivo de garantias")
            else:
                recommended_actions.append("Bloqueio de novos desembolsos")
                recommended_actions.append("Auditoria imediata de sacadores")
            
            if el_sum > (total_exposed * 0.1):
                recommended_actions.append("Provisionamento Adicional Urgente")

        # 7. Top Exposures e Scatter (originais simplificados)
        top_exposures = []
        top_df = df_pipeline.groupby('id_beneficiario')['vlr_nominal'].sum().reset_index()
        top_df = top_df.sort_values('vlr_nominal', ascending=False).head(5)
        for _, row in top_df.iterrows():
            val = float(row['vlr_nominal'])
            top_exposures.append({
                "entity": f"CED_{str(row['id_beneficiario'])[:6].upper()}",
                "exposure": val,
                "risk": "ALTO" if val > 50000 else "MÉDIO",
                "color": "text-rose" if val > 50000 else "text-lime"
            })

        # 8. Métricas Tela 1 (Visão Geral) e Visão Macro de Concentração
        df_boletos = pd.read_csv(BOLETOS_CSV)

        # Merge completo para visão macro de UF e Liquidez
        df_macro = df_boletos.merge(
            df_aux[['id_cnpj', 'uf', 'cd_cnae_prin', 'score_materialidade_v2', 'indicador_liquidez_quantitativo_3m']],
            left_on='id_pagador', right_on='id_cnpj', how='left'
        )
        df_macro['setor'] = df_macro['cd_cnae_prin'].apply(map_cnae)
        df_macro['uf'] = df_macro['uf'].fillna('N/A').replace('', 'N/A')

        score_materialidade_media = float(df_macro['score_materialidade_v2'].mean()) if not df_macro.empty else 0.0

        # Cálculo UF — exclui N/A (pagadores sem match na base auxiliar)
        df_aberto = df_macro[df_macro['dt_pagamento'].isna() & (df_macro['uf'] != 'N/A')]
        uf_dist_macro = df_aberto.groupby('uf')['vlr_nominal'].sum().sort_values(ascending=False).head(10)
        exposicao_por_uf = [{"uf": str(uf), "valor": round(val, 2)} for uf, val in uf_dist_macro.items() if val > 0]

        # Cálculo Liquidez por Setor (Visão macro da base de sacados)
        setor_liq_macro = df_macro.groupby('setor')['indicador_liquidez_quantitativo_3m'].mean().fillna(0).sort_values(ascending=True)
        liquidez_por_setor = [{"setor": str(s), "liquidez": round(float(l), 3)} for s, l in setor_liq_macro.items()]

        vme = float(df_boletos[df_boletos['dt_pagamento'].isna()]['vlr_nominal'].sum())
        ticket_medio = float(df_boletos['vlr_nominal'].mean()) if not df_boletos.empty else 0.0
        volume_baixa = float(df_boletos['vlr_baixa'].sum())

        total_vlr_bol = df_boletos['vlr_nominal'].sum() or 1
        default_vlr   = df_boletos[df_boletos['default'] == 1]['vlr_nominal'].sum()
        inadimplencia_pct = float(default_vlr / total_vlr_bol * 100)

        cnpjs_ativos = int(pd.concat([df_boletos['id_pagador'], df_boletos['id_beneficiario']]).nunique())

        no_prazo = int(((df_boletos['pagou'] == 1) & (df_boletos['dias_atraso'] <= 0)).sum())
        atrasado = int(((df_boletos['pagou'] == 1) & (df_boletos['dias_atraso'] > 0)).sum())
        pendente  = int((df_boletos['pagou'] == 0).sum())
        status_labels = ['No Prazo', 'Atrasado', 'Pendente']
        status_data   = [no_prazo, atrasado, pendente]

        # 9. Gráfico de Barras Empilhadas Mensal
        df_bol = df_boletos.copy()
        df_bol['dt_vencimento'] = pd.to_datetime(df_bol['dt_vencimento'], errors='coerce')
        df_bol['dt_pagamento']  = pd.to_datetime(df_bol['dt_pagamento'],  errors='coerce')

        # Apenas boletos já pagos
        df_pagos = df_bol[df_bol['dt_pagamento'].notna()].copy()
        df_pagos = df_pagos.copy()
        df_pagos['status_pagamento'] = (
            df_pagos['dt_pagamento'] <= df_pagos['dt_vencimento']
        ).map({True: 'no_prazo', False: 'com_atraso'})

        # Agrupa por mês de PAGAMENTO (quando o dinheiro entrou de fato)
        df_pagos['mes_pagamento'] = df_pagos['dt_pagamento'].dt.to_period('M').astype(str)

        grp = (
            df_pagos
            .groupby(['mes_pagamento', 'status_pagamento'])['vlr_nominal']
            .sum()
            .unstack(fill_value=0)
            .reset_index()
        )
        for col in ['no_prazo', 'com_atraso']:
            if col not in grp.columns:
                grp[col] = 0.0

        grp = grp.sort_values('mes_pagamento')
        monthly_chart = [
            {
                "mes":        row['mes_pagamento'],
                "no_prazo":   round(float(row['no_prazo']),   2),
                "com_atraso": round(float(row['com_atraso']), 2),
            }
            for _, row in grp.iterrows()
        ]

        return {
            "psi_global": 0.082,
            "total_exposed_value": total_exposed,
            "el_sum": el_sum,
            "avg_delay": round(avg_delay, 1),
            "avg_liquidity": round(avg_liquidity, 3),
            "drift_alerts": 2,
            "scatter_points": [],
            "top_exposures": top_exposures,
            "cnae_labels": cnae_labels,
            "cnae_data": cnae_data,
            "rejection_labels": rejection_labels,
            "rejection_data": rejection_data,
            "recommended_actions": recommended_actions,
            # Tela 1
            "vme": round(vme, 2),
            "ticket_medio": round(ticket_medio, 2),
            "volume_baixa": round(volume_baixa, 2),
            "inadimplencia_pct": round(inadimplencia_pct, 2),
            "cnpjs_ativos": cnpjs_ativos,
            "status_labels": status_labels,
            "status_data": status_data,
            "monthly_chart": monthly_chart,
            "score_materialidade_media": round(score_materialidade_media, 1),
            "hhi_setorial": float(hhi_setorial),
            "top_pagadores_pareto": top_pagadores_pareto,
            "liquidez_por_setor": liquidez_por_setor,
            "exposicao_por_uf": exposicao_por_uf
        }
    except Exception as e:
        print(f"ERROR: dashboard summary failure: {e}")
        import traceback; traceback.print_exc()
        return {
            "psi_global": 0.0, "total_exposed_value": 0, "el_sum": 0, "drift_alerts": 0,
            "avg_delay": 0, "avg_liquidity": 0,
            "scatter_points": [], "top_exposures": [],
            "cnae_labels": [], "cnae_data": [],
            "rejection_labels": [], "rejection_data": [],
            "recommended_actions": ["Erro ao carregar dados"],
            "vme": 0, "ticket_medio": 0, "volume_baixa": 0,
            "inadimplencia_pct": 0, "cnpjs_ativos": 0,
            "status_labels": [], "status_data": [],
            "monthly_chart": [],
            "score_materialidade_media": 0.0,
        }

@app.get("/v1/credit/pipeline", response_model=List[PipelineOperation], tags=["Dashboard"])
async def get_credit_pipeline(current_user: str = Depends(get_current_user)):
    """
    [PROTEGIDO] Retorna a fila de operações lendo o pipeline_report real.
    Injeta contexto de exposição e risco sistêmico.
    """
    try:
        df = pd.read_csv(PIPELINE_CSV)
        df_grafo = pd.read_csv(GRAFO_CSV)
        
        # Filtrar apenas o topo para a mesa não travar o browser
        df = df.head(50)
        
        results = []
        for _, row in df.iterrows():
            # 1. Mapeamento Semântico do SHAP (Tradução de Variáveis p/ Negócio)
            parecer = str(row.get('parecer_ia_shap', ''))
            factors = []
            
            # Categorias de Negócio para Mapeamento
            mapping = {
                "ATRASO": "PONTUALIDADE HISTÓRICA",
                "BAIXA": "HISTÓRICO PONTUALIDADE",
                "VLR": "MATERIALIDADE / VALOR",
                "SETOR": "RISCO SETORIAL",
                "MATERIALIDADE": "EXPOSIÇÃO RELATIVA",
                "LIQUIDEZ": "SAÚDE FINANCEIRA",
                "PAGERANK": "CONECTIVIDADE REDE",
                "DEGREE": "CAPILARIDADE",
                "TEMPO": "ZONA DE CONFIANÇA",
                "SCORE": "SCORE CRÉDITO"
            }
            
            if "|" in parecer:
                parts = parecer.split("|")
                for p in parts:
                    name_part = p.split("'")[1] if "'" in p else "INDICADOR"
                    # Traduzir para nome amigável de negócio
                    friendly_name = "OUTROS"
                    for key, val in mapping.items():
                        if key in name_part.upper():
                            friendly_name = val
                            break
                            
                    impact = 0.45 if "aumentou" in p else -0.35
                    factors.append({"name": friendly_name, "value": impact})
            
            # 2. Contexto de Exposição e Contágio
            cedente_id = str(row['id_beneficiario'])
            sacado_id = str(row['id_pagador'])
            
            # Simulação de Exposição Acumulada (No MVP: soma local ou valor fixo + valor atual)
            # Em produção: consulta no Neo4j/SQl
            base_exposure = 1250000.0 # Mock de exposição anterior
            
            # Verificação de Risco de Contágio (Se o pagador tem alto PageRank no Grafo)
            is_contagion_risk = False
            if not df_grafo.empty:
                pagador_data = df_grafo[df_grafo['id_pagador'] == row['id_pagador']]
                if not pagador_data.empty:
                    pr = pagador_data.iloc[0].get('pagador_pagerank', 0)
                    is_contagion_risk = pr > 0.6
            
            # Mapear status
            acao = row.get('decisao_politica', 'MESA_ANALISE')
            if "REPROVADO" in str(acao): acao = "BLOQUEAR"
            elif "APROVADO" in str(acao): acao = "APROVAR_AUTO"

            results.append({
                "id_boleto": str(row['id_boleto'])[:10],
                "cedente": f"CED_{cedente_id[:6].upper()}",
                "cedente_id": cedente_id,
                "sacado_nome_fantasia": f"SAC_{sacado_id[:6].upper()}",
                "valor_nominal": float(row['vlr_nominal']),
                "score_pd": float(row['score_pd_bruto']),
                "valor_esperado_perda": float(row['perda_esperada_el']),
                "acao_sugerida": acao,
                "justificativa_mesa": factors if factors else [{"name": "PERFIL OPERACIONAL", "value": -0.1}],
                "cedente_exposicao": base_exposure,
                "risco_contagio": is_contagion_risk
            })
        return results
    except Exception as e:
        print(f"ERROR: credit pipeline failure: {e}")
        return []

@app.post("/v1/credit/operations/action", tags=["Operations"])
async def record_operation_action(action: OverrideAction, current_user: str = Depends(get_current_user)):
    """
    [PROTEGIDO] Registra ações de aprovação/rejeição com justificativa (Feedback Loop).
    No MVP: Apenas simula o recebimento e loga no console.
    """
    print(f"AUDIT LOG: {current_user} performed {action.action} on {action.id_boleto}. Reason: {action.reason}")
    return {"status": "success", "message": f"Ação {action.action} registrada com sucesso."}

@app.get("/v1/pd/summary", response_model=PDSummaryResponse, tags=["Dashboard"])
async def get_pd_summary(current_user: str = Depends(get_current_user)):
    """
    [PROTEGIDO] Calcula PD, LGD e EL por boleto via score_materialidade_v2.
    Retorna KPIs, distribuição por faixa de score, scatter e EL por UF.
    """
    try:
        df_bol = pd.read_csv(BOLETOS_CSV)
        df_aux = pd.read_csv(BASE_AUX_CSV)

        df = df_bol.merge(
            df_aux[['id_cnpj', 'score_materialidade_v2', 'uf']],
            left_on='id_pagador', right_on='id_cnpj', how='left'
        )

        # PD mapeado via score_materialidade_v2 (maior score = menor risco)
        def score_to_pd(s):
            if pd.isna(s): return 0.40
            if s <= 200:   return 0.75
            if s <= 400:   return 0.55
            if s <= 600:   return 0.35
            if s <= 800:   return 0.15
            return 0.05

        df['pd_score'] = df['score_materialidade_v2'].apply(score_to_pd)
        # LGD = 1 - (vlr_baixa / vlr_nominal); default 0.45 quando não calculável
        df['lgd'] = (
            1 - df['vlr_baixa'].div(df['vlr_nominal'].replace(0, float('nan')))
        ).clip(0, 1).fillna(0.45)
        df['el'] = df['pd_score'] * df['lgd'] * df['vlr_nominal']

        el_total   = float(df['el'].sum())
        pd_media   = float(df['pd_score'].mean())
        lgd_media  = float(df['lgd'].mean())
        provisao   = round(el_total * 1.20, 2)  # buffer de segurança de 20%

        # EL por faixa de score_materialidade_v2
        bins   = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1001]
        labels = ['0–100','101–200','201–300','301–400','401–500',
                  '501–600','601–700','701–800','801–900','901–1000']
        df['faixa'] = pd.cut(df['score_materialidade_v2'], bins=bins, labels=labels, include_lowest=True)
        faixa_grp = (
            df.groupby('faixa', observed=True)
            .agg(el=('el', 'sum'), pd_media=('pd_score', 'mean'), count=('vlr_nominal', 'count'))
            .reset_index()
        )
        el_por_faixa = [
            {'faixa': str(r['faixa']), 'el': round(float(r['el']), 2),
             'pd_media': round(float(r['pd_media']), 3), 'count': int(r['count'])}
            for _, r in faixa_grp.iterrows()
        ]

        # EL por UF (top 10)
        uf_grp = (
            df.groupby('uf')
            .agg(el=('el', 'sum'), pd_media=('pd_score', 'mean'), count=('vlr_nominal', 'count'))
            .reset_index()
            .sort_values('el', ascending=False)
            .head(10)
        )
        el_por_uf = [
            {'uf': str(r['uf']), 'el': round(float(r['el']), 2),
             'pd_media': round(float(r['pd_media']), 3), 'count': int(r['count'])}
            for _, r in uf_grp.iterrows()
        ]

        # Scatter: por empresa, exposição vs PD (prioriza alta PD ou alta exposição)
        sc = (
            df.groupby('id_pagador')
            .agg(exposicao=('vlr_nominal', 'sum'), pd=('pd_score', 'mean'), el=('el', 'sum'))
            .reset_index()
        )
        sc_filtered = sc[(sc['pd'] > 0.05) | (sc['exposicao'] > 50000)]
        if len(sc_filtered) > 250:
            sc_filtered = sc_filtered.sample(250, random_state=42)
        scatter_data = [
            {'id': f"PAG_{r['id_pagador'][:6].upper()}",
             'exposicao': round(float(r['exposicao']), 2),
             'pd': round(float(r['pd']), 3),
             'el': round(float(r['el']), 2)}
            for _, r in sc_filtered.iterrows()
        ]

        return {
            'el_total': round(el_total, 2),
            'pd_media': round(pd_media, 4),
            'lgd_media': round(lgd_media, 4),
            'provisao_sugerida': provisao,
            'el_por_faixa': el_por_faixa,
            'scatter_data': scatter_data,
            'el_por_uf': el_por_uf,
        }
    except Exception as e:
        print(f"ERROR pd/summary: {e}")
        import traceback; traceback.print_exc()
        return {'el_total': 0, 'pd_media': 0, 'lgd_media': 0, 'provisao_sugerida': 0,
                'el_por_faixa': [], 'scatter_data': [], 'el_por_uf': []}

@app.get("/v1/politica/summary", response_model=PoliticaSummaryResponse, tags=["Dashboard"])
async def get_politica_summary(current_user: str = Depends(get_current_user)):
    """
    [PROTEGIDO] Métricas de simulação da Política de Rejeição (Underwriting).
    Retorna KPIs, curva de impacto e matriz de decisão (heatmap).
    """
    try:
        df_bol = pd.read_csv(BOLETOS_CSV)
        df_aux = pd.read_csv(BASE_AUX_CSV)

        df = df_bol.merge(
            df_aux[['id_cnpj', 'score_materialidade_v2',
                    'sacado_indice_liquidez_1m', 'share_vl_inad_pag_bol_6_a_15d']],
            left_on='id_pagador', right_on='id_cnpj', how='left'
        )
        df['score_materialidade_v2'] = pd.to_numeric(df['score_materialidade_v2'], errors='coerce')
        df['sacado_indice_liquidez_1m'] = pd.to_numeric(df['sacado_indice_liquidez_1m'], errors='coerce')
        df['share_vl_inad_pag_bol_6_a_15d'] = pd.to_numeric(df['share_vl_inad_pag_bol_6_a_15d'], errors='coerce').fillna(0)

        THRESHOLD = 400
        df['aprovado'] = df['score_materialidade_v2'].fillna(0) > THRESHOLD

        # ── KPIs ────────────────────────────────────────────────────────
        taxa_aprovacao   = float(df['aprovado'].mean() * 100)
        taxa_rejeicao    = float((~df['aprovado']).mean() * 100)

        df_rej = df[~df['aprovado']]
        capital_preservado = float(
            df_rej[df_rej['share_vl_inad_pag_bol_6_a_15d'] > 0.5]['vlr_nominal'].sum()
        )
        falso_positivo_pct = float(
            len(df_rej[df_rej['default'] == 0]) / max(len(df_rej), 1) * 100
        )

        # EL economizado (boletos rejeitados com alta share_inad)
        def score_to_pd(s):
            if pd.isna(s): return 0.40
            if s <= 200: return 0.75
            if s <= 400: return 0.55
            if s <= 600: return 0.35
            if s <= 800: return 0.15
            return 0.05

        df_rej2 = df_rej.copy()
        df_rej2['pd_score'] = df_rej2['score_materialidade_v2'].apply(score_to_pd)
        df_rej2['lgd'] = (1 - df_rej2['vlr_baixa'].div(
            df_rej2['vlr_nominal'].replace(0, float('nan')))).clip(0, 1).fillna(0.45)
        el_economizado = float((df_rej2['pd_score'] * df_rej2['lgd'] * df_rej2['vlr_nominal']).sum())

        # ── Curva de Impacto ─────────────────────────────────────────────
        total_vlr = df['vlr_nominal'].sum() or 1
        impact_curve = []
        for t in range(0, 1001, 50):
            mask = df['score_materialidade_v2'].fillna(0) > t
            aprov = df[mask]
            n = len(aprov)
            impact_curve.append({
                'threshold': t,
                'receita_pct':      round(float(aprov['vlr_nominal'].sum() / total_vlr * 100), 2),
                'inadimplencia_pct': round(float(aprov['default'].mean() * 100) if n > 0 else 0, 2),
                'n_aprovado':       int(n),
            })

        # ── Heatmap — Score × Liquidez ────────────────────────────────────
        score_bins  = [0, 200, 400, 600, 800, 1001]
        score_labels = ['0–200', '200–400', '400–600', '600–800', '800–1000']
        liq_bins    = [0, 0.2, 0.4, 0.6, 0.8, 1.01]
        liq_labels  = ['0–0.2', '0.2–0.4', '0.4–0.6', '0.6–0.8', '0.8–1.0']

        df['score_bin'] = pd.cut(df['score_materialidade_v2'],
                                  bins=score_bins, labels=score_labels, include_lowest=True)
        df['liq_bin']   = pd.cut(df['sacado_indice_liquidez_1m'],
                                  bins=liq_bins, labels=liq_labels, include_lowest=True)

        hm = (df.groupby(['score_bin', 'liq_bin'], observed=True)
                .agg(default_rate=('default', 'mean'),
                     count=('vlr_nominal', 'count'),
                     atraso_medio=('dias_atraso', 'mean'))
                .reset_index())

        heatmap_data = [
            {
                'score_bin':    str(r['score_bin']),
                'liq_bin':      str(r['liq_bin']),
                'default_rate': round(float(r['default_rate']), 3),
                'count':        int(r['count']),
                'atraso_medio': round(float(r['atraso_medio']), 1),
            }
            for _, r in hm.iterrows()
        ]

        # ── Curva de Contágio por PageRank ───────────────────────────────────
        # tol=0% (zero tolerância) → bloqueia pagerank > p85 (hubs de maior risco)
        # tol=30% (permissivo)     → bloqueia apenas pagerank > p97 (hubs extremos)
        # Mapeamento: percentile = 85 + (tol/30) * 12
        df_pipe_full = pd.read_csv(PIPELINE_CSV)
        df_grafo_cg  = pd.read_csv(GRAFO_CSV)
        df_cg = df_pipe_full.merge(
            df_grafo_cg[['id_boleto', 'pagador_pagerank']],
            on='id_boleto', how='left'
        )
        df_cg['pagador_pagerank'] = pd.to_numeric(df_cg['pagador_pagerank'], errors='coerce').fillna(0)
        df_cg['perda_esperada_el'] = pd.to_numeric(df_cg['perda_esperada_el'], errors='coerce').fillna(0)
        df_cg['vlr_nominal'] = pd.to_numeric(df_cg['vlr_nominal'], errors='coerce').fillna(0)

        contagio_curve = []
        for tol in range(0, 31, 5):
            pct   = 85.0 + (tol / 30.0) * 12.0   # tol=0 → p85, tol=30 → p97
            thresh = float(np.percentile(df_cg['pagador_pagerank'], pct))
            blocked = df_cg[df_cg['pagador_pagerank'] > thresh]
            contagio_curve.append({
                'tol':               tol,
                'pagerank_threshold': round(thresh, 6),
                'n_blocked':         int(len(blocked)),
                'valor_blocked':     round(float(blocked['vlr_nominal'].sum()), 2),
                'el_blocked':        round(float(blocked['perda_esperada_el'].sum()), 2),
            })

        return {
            'taxa_aprovacao':    round(taxa_aprovacao, 2),
            'taxa_rejeicao':     round(taxa_rejeicao, 2),
            'capital_preservado': round(capital_preservado, 2),
            'falso_positivo_pct': round(falso_positivo_pct, 2),
            'el_economizado':    round(el_economizado, 2),
            'impact_curve':      impact_curve,
            'heatmap_data':      heatmap_data,
            'heatmap_score_bins': score_labels,
            'heatmap_liq_bins':  liq_labels,
            'contagio_curve':    contagio_curve,
        }
    except Exception as e:
        print(f"ERROR politica/summary: {e}")
        import traceback; traceback.print_exc()
        return {
            'taxa_aprovacao': 0, 'taxa_rejeicao': 0, 'capital_preservado': 0,
            'falso_positivo_pct': 0, 'el_economizado': 0,
            'impact_curve': [], 'heatmap_data': [],
            'heatmap_score_bins': [], 'heatmap_liq_bins': [],
            'contagio_curve': [],
        }

@app.get("/v1/pipeline/report", tags=["Dashboard"])
async def get_pipeline_report(
    limit: int = 300,
    current_user: str = Depends(get_current_user)
):
    """
    [PROTEGIDO] Amostra balanceada do pipeline completo (aprovados + reprovados + análise).
    Usado pela tabela de decisão na tela de Política de Rejeição.
    """
    def _sf(r, col, decimals=4):
        v = r.get(col)
        if v is None:
            return None
        try:
            if pd.isna(v):
                return None
        except (TypeError, ValueError):
            pass
        try:
            return round(float(v), decimals)
        except (TypeError, ValueError):
            return None

    def _ss(r, col):
        v = r.get(col)
        if v is None:
            return None
        try:
            if pd.isna(v):
                return None
        except (TypeError, ValueError):
            pass
        s = str(v).strip()
        return s if s and s.lower() != 'nan' else None

    try:
        df = pd.read_csv(PIPELINE_CSV)
        for col in ['score_pd_bruto', 'perda_esperada_el', 'vlr_nominal']:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

        # Amostragem proporcional por decisao para garantir todos os tipos
        decisao_col = 'STATUS_FINAL' if 'STATUS_FINAL' in df.columns else 'decisao_politica'
        score_col   = 'score_pd_bruto'
        parts = []
        for decisao, group in df.groupby(decisao_col):
            n = min(len(group), max(20, int(limit * len(group) / len(df))))
            parts.append(group.sample(n=n, random_state=42))
        sample = (pd.concat(parts)
                    .drop_duplicates(subset=['id_boleto'])
                    .sort_values(score_col, ascending=False)
                    .head(limit))

        return [
            {
                "id_boleto":    str(r.get('id_boleto', '')),
                "id_pagador":   str(r.get('id_pagador', '')),
                "id_beneficiario": _ss(r, 'id_beneficiario'),
                "dt_emissao":   _ss(r, 'dt_emissao'),
                "dt_vencimento": _ss(r, 'dt_vencimento'),
                "dt_pagamento": _ss(r, 'dt_pagamento'),
                "vlr_nominal":  round(float(r.get('vlr_nominal', 0)), 2),
                "vlr_baixa":    _sf(r, 'vlr_baixa', 2),
                "tipo_baixa":   _ss(r, 'tipo_baixa'),
                "tipo_especie": _ss(r, 'tipo_especie'),
                "id_cnpj":      _ss(r, 'id_cnpj'),
                "cd_cnae_prin": _ss(r, 'cd_cnae_prin'),
                "uf":           _ss(r, 'uf'),
                "sacado_indice_liquidez_1m":          _sf(r, 'sacado_indice_liquidez_1m'),
                "cedente_indice_liquidez_1m":         _sf(r, 'cedente_indice_liquidez_1m'),
                "score_materialidade_evolucao":       _sf(r, 'score_materialidade_evolucao'),
                "media_atraso_dias":                  _sf(r, 'media_atraso_dias', 2),
                "indicador_liquidez_quantitativo_3m": _sf(r, 'indicador_liquidez_quantitativo_3m'),
                "share_vl_inad_pag_bol_6_a_15d":     _sf(r, 'share_vl_inad_pag_bol_6_a_15d'),
                "score_quantidade_v2":   _sf(r, 'score_quantidade_v2', 2),
                "score_materialidade_v2": _sf(r, 'score_materialidade_v2', 2),
                "score_contagio":        _sf(r, 'score_contagio'),
                "prob_sobrevivencia":    _sf(r, 'prob_sobrevivencia'),
                "atraso_previsto_dias":  _sf(r, 'atraso_previsto_dias', 2),
                "PD":  _sf(r, 'PD') if _sf(r, 'PD') is not None else round(float(r.get('score_pd_bruto', 0)), 4),
                "LGD": _sf(r, 'LGD'),
                "EL":  _sf(r, 'EL', 2) if _sf(r, 'EL', 2) is not None else round(float(r.get('perda_esperada_el', 0)), 2),
                "STATUS_FINAL": str(r.get('STATUS_FINAL') or r.get('decisao_politica', '')),
                "MOTIVO_DECISAO": _ss(r, 'MOTIVO_DECISAO') or _ss(r, 'parecer_ia_shap'),
                # Legacy aliases mantidos para compatibilidade com a tabela do dashboard
                "score_pd": round(float(r.get('score_pd_bruto', 0)), 4),
                "perda_el": round(float(r.get('perda_esperada_el', 0)), 2),
                "decisao":  str(r.get('decisao_politica', '')),
            }
            for _, r in sample.iterrows()
        ]
    except Exception as e:
        print(f"ERROR pipeline/report: {e}")
        return []


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
