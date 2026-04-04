import pandas as pd
import numpy as np
import logging
import joblib
import os
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import roc_auc_score, confusion_matrix, classification_report
import matplotlib.pyplot as plt

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def run_backtest():
    logger.info("🚀 Iniciando Suite de Backtesting Cronológico (MFS)...")
    
    base_file = os.path.join('data', 'processed', 'base_modelagem.csv')
    if not os.path.exists(base_file):
        logger.error(f"Base de modelagem não encontrada: {base_file}")
        return

    df = pd.read_csv(base_file)
    df['dt_emissao'] = pd.to_datetime(df['dt_emissao'])
    
    # Ordenar por data para garantir o split temporal (não aleatório)
    df = df.sort_values('dt_emissao')
    
    # Split Temporal: 80% Treino (Passado), 20% Teste (Futuro/Out-of-Time)
    split_idx = int(len(df) * 0.8)
    df_train = df.iloc[:split_idx].copy()
    df_test = df.iloc[split_idx:].copy()
    
    logger.info(f"Janela de Treino: {df_train['dt_emissao'].min()} até {df_train['dt_emissao'].max()}")
    logger.info(f"Janela de Teste: {df_test['dt_emissao'].min()} até {df_test['dt_emissao'].max()}")

    # Preparação de Features
    remover = ['default', 'dias_atraso', 'id_boleto', 'id_pagador', 'id_beneficiario', 'dt_emissao']
    features = [c for c in df.columns if c not in remover]
    
    X_train = df_train[features]
    y_train = df_train['default']
    X_test = df_test[features]
    y_test = df_test['default']
    
    # 1. Simulação do Modelo no Passado
    logger.info("Treinando Modelo de Backtest (RandomForest)...")
    model = RandomForestClassifier(n_estimators=100, class_weight='balanced', random_state=42)
    model.fit(X_train, y_train)
    
    # 2. Avaliação de Performance
    probs = model.predict_proba(X_test)[:, 1]
    preds = (probs > 0.5).astype(int)
    auc = roc_auc_score(y_test, probs)
    
    logger.info(f"✅ AUC-ROC no Backtest: {auc:.4f}")
    
    # 3. Cálculo de Impacto Financeiro (A grande métrica de negócio)
    df_test['pred_prob'] = probs
    df_test['perda_esperada_real'] = df_test['vlr_nominal'] * df_test['default']
    
    # Se tivéssemos bloqueado quem a IA mandou (Prob > 0.5)
    bloqueados = df_test[df_test['pred_prob'] > 0.5]
    perda_evitada = (bloqueados['vlr_nominal'] * bloqueados['default']).sum()
    volume_bloqueado_total = bloqueados['vlr_nominal'].sum()
    
    print("\n" + "="*50)
    print("      RELATÓRIO DE IMPACTO FINANCEIRO (BACKTEST)")
    print("="*50)
    print(f"Período Analisado: {len(df_test)} títulos")
    print(f"Volume Financeiro Testado: R$ {df_test['vlr_nominal'].sum():,.2f}")
    print(f"Número de Defaults Reais: {y_test.sum()}")
    print("-" * 50)
    print(f"💰 PERDA EVITADA (Susto da IA): R$ {perda_evitada:,.2f}")
    print(f"📉 Eficiência do Filtro: {(perda_evitada / df_test['perda_esperada_real'].sum())*100:.1f}% do calote total evitado")
    print(f"🚫 Falsos Positivos (Bloqueios Indevidos): {len(bloqueados[bloqueados['default']==0])}")
    print("="*50)

if __name__ == "__main__":
    run_backtest()
