import os
import logging
import requests
import pandas as pd
from datetime import datetime, timedelta

# Configurando log
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

CACHE_DIR = "data/cache"
os.makedirs(CACHE_DIR, exist_ok=True)

def get_bacen_data(codigo_serie, nome_serie):
    """
    Função para consumir dados da API do Banco Central (SGS) com cache local.
    Séries comuns: 11 (Taxa SELIC Diária), 433 (IPCA Mensal)
    """
    cache_file = os.path.join(CACHE_DIR, f"{nome_serie}_cache.csv")
    
    # Lógica de cache simples (Timeout de 1 dia)
    if os.path.exists(cache_file):
        file_mod_time = datetime.fromtimestamp(os.path.getmtime(cache_file))
        if datetime.now() - file_mod_time < timedelta(days=1):
            logger.info(f"Usando cache local para {nome_serie}.")
            return pd.read_csv(cache_file, parse_dates=['data'])

    try:
        # Pega a data inicial da nossa base para não puxar séries inteiras na API e evitar Timeout e Falha de Paginação
        df_raw = pd.read_csv('data/raw/base_boletos_fiap.csv', usecols=['dt_emissao'])
        data_inicial = pd.to_datetime(df_raw['dt_emissao']).min().strftime('%d/%m/%Y')
        data_final = datetime.now().strftime('%d/%m/%Y')
    except Exception as e:
        logger.warning(f"Aviso ao ler emissões reais ({e}). Usando fallback estático de data.")
        data_inicial = "16/08/2019"
        data_final = datetime.now().strftime('%d/%m/%Y')

    logger.info(f"Baixando dados da série {codigo_serie} ({nome_serie}) do BACEN de {data_inicial} a {data_final}...")
    url = f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo_serie}/dados?formato=json&dataInicial={data_inicial}&dataFinal={data_final}"
    
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, timeout=30, headers=headers, verify=False)
        response.raise_for_status()
        
        data = response.json()
        df = pd.DataFrame(data)
        df['data'] = pd.to_datetime(df['data'], format='%d/%m/%Y')
        df['valor'] = pd.to_numeric(df['valor'])
        
        df.to_csv(cache_file, index=False)
        return df
        
    except Exception as e:
        logger.error(f"Erro ao conectar na API do BACEN: {e}")
        if os.path.exists(cache_file):
            logger.warning(f"Usando cache desatualizado para {nome_serie}.")
            return pd.read_csv(cache_file, parse_dates=['data'])
        else:
            logger.warning(f"Sem cache. Usando dados mockados para garantir o ciclo de vida do pipeline.")
            dates = pd.date_range(start="2023-01-01", end="2025-01-01", freq="D")
            df_mock = pd.DataFrame({'data': dates, 'valor': [10.5] * len(dates)})
            return df_mock

def process_bacen_data():
    """
    Processa e aplica transformações para a pipeline de modelagem.
    Retorna os dataframes e salva em csv processado.
    """
    try:
        # SELIC (Série 11) - Taxa de Juros (diária)
        df_selic = get_bacen_data(11, "selic")
        
        # IPCA (Série 433) - Inflação (mensal)
        df_ipca = get_bacen_data(433, "ipca")
        
        # --- Engenharia de features ---
        # Garantindo ordem cronológica
        df_selic = df_selic.sort_values('data').reset_index(drop=True)
        
        # Tendência da SELIC (diff_selic_30d)
        # Shift de 30 (dias) do valor atual para captar oscilações curtas da taxa
        df_selic['selic_lag_30d'] = df_selic['valor'].shift(30)
        df_selic['diff_selic_30d'] = df_selic['valor'] - df_selic['selic_lag_30d']
        
        logger.info("Dados BACEN sincronizados. Features de tendência da SELIC criadas.")
        
        # Merge/Export processado (Exemplo de gravação em disco)
        output_selic_path = os.path.join(CACHE_DIR, "selic_features_processed.csv")
        df_selic.to_csv(output_selic_path, index=False)
        logger.info(f"Dados processados da SELIC com lags salvos em: {output_selic_path}")
        
        return df_selic, df_ipca
        
    except Exception as e:
         logger.error(f"Erro crítico no pipeline do BACEN: {e}")
         raise

if __name__ == "__main__":
    process_bacen_data()
