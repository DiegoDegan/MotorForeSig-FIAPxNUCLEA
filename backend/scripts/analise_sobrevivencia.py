import pandas as pd
import matplotlib.pyplot as plt
from lifelines import KaplanMeierFitter
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def run_survival_analysis():
    logger.info("📈 Gerando Curvas de Sobrevivência (Kaplan-Meier) p/ o FIDC...")
    
    base_file = os.path.join('data', 'processed', 'base_modelagem.csv')
    if not os.path.exists(base_file):
        return

    df = pd.read_csv(base_file)
    
    # Criar grupos de risco (para comparação de curvas)
    # Grupo A: Risco IA Alto (usaremos a lógica de proxy - Ex: quem tem Pagerank alto ou Selic alta)
    # Para este MVP, vamos criar um 'Grupo de Risco' baseado no vlr_nominal e atraso historico
    df['grupo_risco'] = 'Baixo Risco'
    # Proxy: boletos de alto valor (exposição) ou setores ja marcados
    threshold = df['vlr_nominal'].quantile(0.8)
    df.loc[df['vlr_nominal'] > threshold, 'grupo_risco'] = 'Alto Risco'

    # Parâmetros Lifelines:
    # T = Duração (dias_atraso)
    # E = Evento (default - 1 se calote, 0 se pago)
    T = df['dias_atraso']
    E = df['default']

    kmf = KaplanMeierFitter()
    
    out_dir = "Planilhas MVP atual"
    os.makedirs(out_dir, exist_ok=True)

    plt.figure(figsize=(10, 6))
    
    for grupo in df['grupo_risco'].unique():
        idx = (df['grupo_risco'] == grupo)
        kmf.fit(T[idx], event_observed=E[idx], label=grupo)
        kmf.plot_survival_function()
        
        # Salvar dados numéricos da curva para o Frontend
        kmf.survival_function_.to_csv(os.path.join(out_dir, f"curva_sobrevivencia_{grupo.lower().replace(' ', '_')}.csv"))

    plt.title("Curva de Sobrevivência do Recebível (Probabilidade de Aduimplência)")
    plt.xlabel("Dias desde o Vencimento")
    plt.ylabel("Probabilidade de NÃO entrar em Default")
    plt.grid(True)
    
    plot_path = os.path.join(out_dir, "grafico_sobrevivencia_km.png")
    plt.savefig(plot_path)
    logger.info(f"✅ Gráfico e Dados de Sobrevivência salvos em: {out_dir}")

if __name__ == "__main__":
    run_survival_analysis()
