import pandas as pd
import numpy as np
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def calculate_psi(expected, actual, buckets=10):
    """
    Calcula o Population Stability Index (PSI).
    PSI < 0.1: Sem mudança significativa.
    PSI < 0.25: Mudança moderada.
    PSI >= 0.25: Mudança significativa (requer retreino).
    """
    def scale_range(data, buckets):
        # Quebra em decis
        breakpoints = np.arange(0, buckets + 1) / buckets * 100
        return np.percentile(data, breakpoints)

    # Evitar divisão por zero (laplace smoothing)
    def calculate_probs(data, points):
        count = np.histogram(data, bins=points)[0]
        return (count + 0.0001) / (len(data) + 0.0001)

    breakpoints = scale_range(expected, buckets)
    expected_probs = calculate_probs(expected, breakpoints)
    actual_probs = calculate_probs(actual, breakpoints)

    psi_values = (expected_probs - actual_probs) * np.log(expected_probs / actual_probs)
    return np.sum(psi_values)

def run_drift_monitoring():
    logger.info("🕵️ Verificando integridade e Data Drift do Motor MFS...")
    
    base_file = os.path.join('data', 'processed', 'base_modelagem.csv')
    if not os.path.exists(base_file):
        return

    df = pd.read_csv(base_file)
    
    # Features sensíveis que costumam 'drifar' e quebrar o modelo
    features_monitoramento = ['vlr_nominal', 'pagerank_vizinhanca']
    
    # Para o MVP, simularemos o 'Treino' como a primeira metade da base e o 'Atual' como a segunda
    split = len(df) // 2
    df_treino = df.iloc[:split]
    df_atual = df.iloc[split:]
    
    results = []
    logger.info("-" * 40)
    for feat in features_monitoramento:
        if feat in df.columns:
            psi = calculate_psi(df_treino[feat], df_atual[feat])
            status = "✅ ESTÁVEL" if psi < 0.1 else ("⚠️ ALERTA" if psi < 0.25 else "🚨 DRIFT CRÍTICO")
            logger.info(f"Feature: {feat:<20} | PSI: {psi:.4f} | Status: {status}")
            results.append({"feature": feat, "psi": psi, "status": status})

    # Salvar relatório de auditoria de drift
    out_dir = "Planilhas MVP atual"
    pd.DataFrame(results).to_csv(os.path.join(out_dir, "auditoria_drift.csv"), index=False)
    logger.info("-" * 40)
    logger.info(f"✅ Monitoramento concluído. Relatório em: {out_dir}/auditoria_drift.csv")

if __name__ == "__main__":
    run_drift_monitoring()
