import os
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, precision_score, recall_score
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')

def evaluate_selic_impact():
    base_file = 'data/processed/base_modelagem.csv'
    output_file = 'data/processed/avaliacao_impacto_selic.txt'
    
    if not os.path.exists(base_file):
        logging.error("A base_modelagem.csv não foi encontrada!")
        return
        
    df = pd.read_csv(base_file)
    
    # Isolar Features do treinamento
    colunas_exclusao = ['default', 'dias_atraso', 'id_boleto', 'id_pagador', 'id_beneficiario', 'pagou']
    features_todas = [c for c in df.columns if c not in colunas_exclusao]
    
    # Isolar as colunas da SELIC na nossa base
    colunas_selic = ['taxa_selic_emissao', 'diff_selic_30d']
    features_sem_selic = [c for c in features_todas if c not in colunas_selic]

    # Validação e Limpeza
    df.fillna(0, inplace=True)
    
    y = df['default']
    
    # ---------------------------------------------------------
    # Função para treinar e extrair score
    # ---------------------------------------------------------
    def train_and_eval(feature_list):
        X = df[feature_list]
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)
        
        clf = RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42, n_jobs=-1)
        clf.fit(X_train, y_train)
        
        y_pred = clf.predict(X_test)
        y_prob = clf.predict_proba(X_test)[:, 1]
        
        auc = roc_auc_score(y_test, y_prob)
        prec = precision_score(y_test, y_pred, zero_division=0)
        rec = recall_score(y_test, y_pred, zero_division=0)
        
        importances = {}
        if len(feature_list) == len(features_todas):
            for i, name in enumerate(feature_list):
                importances[name] = clf.feature_importances_[i]
                
        return auc, prec, rec, importances

    logging.info("Treinando Modelo 1: COM SELIC...")
    auc_c, prec_c, rec_c, importances_c = train_and_eval(features_todas)
    
    logging.info("Treinando Modelo 2: SEM SELIC...")
    auc_s, prec_s, rec_s, _ = train_and_eval(features_sem_selic)

    # ---------------------------------------------------------
    # Escrever Relatório Final
    # ---------------------------------------------------------
    razao_auc = ((auc_c - auc_s) / auc_s) * 100
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("="*60 + "\n")
        f.write("RELATÓRIO DE AVALIAÇÃO DE IMPACTO: CENÁRIO MACRO (SELIC)\n")
        f.write("="*60 + "\n\n")
        
        f.write("1. PERFORMANCE DO ALGORITMO (COM SELIC vs SEM SELIC):\n")
        f.write(f"   ► ROC-AUC (Grau de separação de risco):\n")
        f.write(f"      - COM Selic: {auc_c:.4f}\n")
        f.write(f"      - SEM Selic: {auc_s:.4f}\n")
        f.write(f"      - Aumento Preditivo da IA na confiança global: {razao_auc:+.2f}%\n\n")
        
        f.write(f"   ► PRECISION (Acertos ao apontar Default crítico):\n")
        f.write(f"      - COM Selic: {prec_c:.4f}\n")
        f.write(f"      - SEM Selic: {prec_s:.4f}\n\n")

        f.write(f"   ► RECALL (Detecção de todos os possíveis Defaults):\n")
        f.write(f"      - COM Selic: {rec_c:.4f}\n")
        f.write(f"      - SEM Selic: {rec_s:.4f}\n\n")

        f.write("2. PESO ESTRUTURAL DAS VARIÁVEIS DO BACEN DENTRO DO MOTOR:\n")
        if importances_c:
            selic_emissao_imp = importances_c.get('taxa_selic_emissao', 0)
            selic_diff_imp = importances_c.get('diff_selic_30d', 0)
            f.write(f"   - Peso Relativo da 'taxa_selic_emissao': {selic_emissao_imp*100:.2f}% de importância decisória\n")
            f.write(f"   - Peso Relativo da 'diff_selic_30d': {selic_diff_imp*100:.2f}% de importância decisória\n")
            f.write(f"   - O Contexto Brasil representa no total { (selic_emissao_imp + selic_diff_imp)*100 :.2f}% do julgamento da IA.\n\n")
            
        f.write("="*60 + "\n")
        f.write("Nota: O Random Forest é não linear, pequenas mudanças no AUC já podem representar centenas de milhares de reais economizados na calibração fina para aceitação de lotes complexos de FIDCs.\n")
        f.write("="*60 + "\n")

    logging.info(f"Relatório gerado em: {output_file}")
    
if __name__ == "__main__":
    evaluate_selic_impact()
