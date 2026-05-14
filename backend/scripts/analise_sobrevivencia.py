import pandas as pd
import matplotlib.pyplot as plt
from lifelines import KaplanMeierFitter
import os
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def run_survival_analysis():
    logger.info("📈 Gerando Curvas de Sobrevivência (Kaplan-Meier) p/ o Dashboard...")
    
    # Caminhos relativos ao root do projeto
    base_file = os.path.join('data', 'processed', 'base_modelagem.csv')
    out_dir = os.path.join('data', 'processed')
    
    if not os.path.exists(base_file):
        logger.warning(f"Arquivo base não encontrado: {base_file}. Abortando análise.")
        return

    df = pd.read_csv(base_file)
    
    # Validação de colunas necessárias
    required_cols = ['vlr_nominal', 'dias_atraso', 'default']
    if not all(col in df.columns for col in required_cols):
        logger.error(f"Colunas necessárias {required_cols} não encontradas no CSV.")
        return
    
    # Criar grupos de risco (para comparação de curvas)
    # Grupo A: Risco IA Alto (Proxy baseado no percentil de valor nominal)
    df['grupo_risco'] = 'Baixo Risco'
    threshold = df['vlr_nominal'].quantile(0.8)
    df.loc[df['vlr_nominal'] > threshold, 'grupo_risco'] = 'Alto Risco'

    # Parâmetros Lifelines:
    # T = Duração (dias_atraso)
    # E = Evento (default - 1 se calote, 0 se pago)
    T = df['dias_atraso']
    E = df['default']

    kmf = KaplanMeierFitter()
    os.makedirs(out_dir, exist_ok=True)

    plt.figure(figsize=(10, 6))
    
    for grupo in df['grupo_risco'].unique():
        idx = (df['grupo_risco'] == grupo)
        if idx.sum() == 0: continue
        
        kmf.fit(T[idx], event_observed=E[idx], label=grupo)
        kmf.plot_survival_function()
        
        # Salvar dados numéricos da curva para o Dashboard (JSON/CSV)
        csv_name = f"curva_sobrevivencia_{grupo.lower().replace(' ', '_')}.csv"
        kmf.survival_function_.to_csv(os.path.join(out_dir, csv_name))

    plt.title("Probabilidade de Recebimento (Sobrevivência do Recebível)")
    plt.xlabel("Dias de Atraso (após vencimento)")
    plt.ylabel("Probabilidade de NÃO entrar em Default")
    plt.grid(True, linestyle='--', alpha=0.7)
    
    plot_path = os.path.join(out_dir, "grafico_sobrevivencia_km.png")
    plt.savefig(plot_path)
    plt.close() # Fecha a figura para não consumir memória
    
    logger.info(f"✅ Análise de Sobrevivência concluída. Arquivos em: {out_dir}")

if __name__ == "__main__":
    run_survival_analysis()
