import os
import joblib
import shap
import pandas as pd
from contextlib import asynccontextmanager
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from jose import JWTError, jwt
from passlib.context import CryptContext
from dotenv import load_dotenv

# Carregar variáveis de ambiente
load_dotenv()

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
        # Cache BACEN metrics (mock - pode ser substituído por consulta ao DB ou API real)
        ml_components["macro_metrics"] = {
            "selic": 10.75,
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
    selic: float
    ipca_acumulado: float
    dolar_comercial: float
    data_atualizacao: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

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
