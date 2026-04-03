import pandas as pd
import numpy as np
import logging
import joblib
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, mean_squared_error
import os

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class CreditRiskTrainer:
    def __init__(self, output_dir=None):
        # Resolve o diretório relativo para salvar no backend/models do repositório
        if output_dir is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            self.output_dir = os.path.join(base_dir, 'models')
        else:
            self.output_dir = output_dir
            
        os.makedirs(self.output_dir, exist_ok=True)
        self.scaler = StandardScaler()
        # Tratamento de desbalanceamento (Chain-of-Thought 1)
        self.pd_model = RandomForestClassifier(n_estimators=100, class_weight='balanced', random_state=42)
        self.delay_model = RandomForestRegressor(n_estimators=100, random_state=42)
        
    def prepare_data(self, df):
        """
        Padroniza os dados e aplica as regras do projeto.
        """
        logger.info("Preparando dados...")
        
        # Regra do Default: Atraso > 60 dias
        if 'dias_atraso' not in df.columns:
            raise ValueError("A coluna 'dias_atraso' é exigida no DataFrame de treino.")
            
        df['default'] = (df['dias_atraso'] > 60).astype(int)
        logger.info(f"Taxa de default detectada: {df['default'].mean():.2%}")
        
        # Aplicar StandardScaler em valores numéricos associados a dinheiro ou taxas
        cols_to_scale = [col for col in df.columns if 'valor' in col.lower() or 'taxa' in col.lower() or 'vlr' in col.lower()]
        if cols_to_scale:
            logger.info(f"Normalizando colunas com StandardScaler: {cols_to_scale}")
            df[cols_to_scale] = self.scaler.fit_transform(df[cols_to_scale])
            
        return df, cols_to_scale

    def train(self, df):
        """
        Executa todas as etapas de treino em pipeline.
        """
        df_processed, scaled_cols = self.prepare_data(df)
        
        # Isolar as features (variáveis target e identificadores devem ficar de fora)
        remover_colunas = ['default', 'dias_atraso', 'id', 'cnpj', 'data', 'event', 'data_emissao', 'data_vencimento', 'pagou', 'id_boleto', 'id_pagador', 'id_beneficiario']
        features = [c for c in df_processed.columns if c not in remover_colunas]
        
        # Validar as amarras das features obrigatórias
        macro_graph_keywords = ['selic', 'ipca', 'pagerank', 'centrality', 'degree']
        encontradas = [f for f in features if any(k in f.lower() for k in macro_graph_keywords)]
        if not encontradas:
            logger.warning("Faltam variáveis macro ou de grafo obrigatórias! Verifique seu pipeline (falta: SELIC/PageRank).")
        else:
            logger.info(f"Features obrigatórias detectadas e integradas: {encontradas}")
            
        X = df_processed[features]
        y_pd = df_processed['default']
        y_delay = df_processed['dias_atraso']
        
        X_train, X_test, y_pd_train, y_pd_test, y_delay_train, y_delay_test = train_test_split(
            X, y_pd, y_delay, test_size=0.2, random_state=42
        )
        
        # 1. Pipeline de Classificação: Probabilidade de Default (PD)
        logger.info("Treinando Algoritmo RandomForestClassifier (Probabilidade de Default)...")
        self.pd_model.fit(X_train, y_pd_train)
        pd_preds = self.pd_model.predict_proba(X_test)[:, 1]
        auc_roc = roc_auc_score(y_pd_test, pd_preds)
        logger.info(f"*** Métrica de Sucesso (PD) -> AUC-ROC: {auc_roc:.4f} ***")
        
        # 2. Pipeline de Regressão: Previsão de dias de Atraso
        logger.info("Treinando Algoritmo RandomForestRegressor (Previsão de Atraso)...")
        self.delay_model.fit(X_train, y_delay_train)
        delay_preds = self.delay_model.predict(X_test)
        rmse = np.sqrt(mean_squared_error(y_delay_test, delay_preds))
        logger.info(f"*** Métrica de Sucesso (Atraso) -> RMSE: {rmse:.4f} dias ***")
        
        # Persistência de artefatos
        logger.info("Serializando modelos com joblib...")
        joblib.dump(self.pd_model, os.path.join(self.output_dir, 'modelo_pd.joblib'))
        joblib.dump(self.delay_model, os.path.join(self.output_dir, 'modelo_atraso.joblib'))
        joblib.dump(self.scaler, os.path.join(self.output_dir, 'scaler.joblib'))
        joblib.dump(features, os.path.join(self.output_dir, 'features.joblib'))
        logger.info(f"Artefatos salvos em: {self.output_dir}")
        
        return {'auc_roc': auc_roc, 'rmse': rmse}

if __name__ == "__main__":
    # Carregar dataset real do MFS consolidado no script anterior
    base_path = os.path.join("data", "processed", "base_modelagem.csv")
    if not os.path.exists(base_path):
        logger.error(f"Base não encontrada: {base_path}. Rode o pipeline primeiro.")
        exit(1)
        
    logger.info(f"Iniciando treinamento com a base consolidada: {base_path}")
    df_real = pd.read_csv(base_path)
    
    # Tratamento simples para missing se escaparam no merge
    df_real = df_real.select_dtypes(include=[np.number]).fillna(0)
    
    treinador = CreditRiskTrainer()
    treinador.train(df_real)
