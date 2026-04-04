import os
import pandas as pd
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def limpar_dados():
    # Caminhos relativos à raiz do projeto
    raw_dir = os.path.join("data", "raw")
    processed_dir = os.path.join("data", "processed")
    os.makedirs(processed_dir, exist_ok=True)
    
    # 1. Base Boletos
    logger.info("Carregando base_boletos_fiap.csv")
    df_boletos = pd.read_csv(os.path.join(raw_dir, "base_boletos_fiap.csv"))
    
    logger.info("Ajustando datas")
    for col in ['dt_emissao', 'dt_vencimento', 'dt_pagamento']:
        df_boletos[col] = pd.to_datetime(df_boletos[col], errors='coerce')
        
    df_boletos = df_boletos.dropna(subset=['id_boleto', 'id_pagador', 'id_beneficiario'])
    
    # Flags e Cálculo de Atraso
    df_boletos['dias_atraso'] = (df_boletos['dt_pagamento'] - df_boletos['dt_vencimento']).dt.days
    
    # Para calcular o atraso de boletos em aberto, usamos a data máxima do dataset como referência (hj)
    data_ref = df_boletos[['dt_emissao', 'dt_vencimento', 'dt_pagamento']].max().max()
    mask_aberto = df_boletos['dt_pagamento'].isna()
    df_boletos.loc[mask_aberto, 'dias_atraso'] = (data_ref - df_boletos.loc[mask_aberto, 'dt_vencimento']).dt.days
    
    df_boletos['pagou'] = (~mask_aberto).astype(int)
    
    # Política de Default: mais de 60 dias de atraso
    df_boletos['default'] = (df_boletos['dias_atraso'] > 60).astype(int)
    
    output_boletos = os.path.join(processed_dir, "base_boletos_tratados.csv")
    df_boletos.to_csv(output_boletos, index=False)
    logger.info(f"Salvo {output_boletos} com {len(df_boletos)} registros.")
    
    # 2. Base Auxiliar
    logger.info("Carregando base_auxiliar_fiap.csv")
    df_auxiliar = pd.read_csv(os.path.join(raw_dir, "base_auxiliar_fiap.csv"))
    
    if 'liquidez' in df_auxiliar.columns:
        df_auxiliar['liquidez'] = df_auxiliar['liquidez'].fillna(df_auxiliar['liquidez'].median())
    if 'score_mercado' in df_auxiliar.columns:
        df_auxiliar['score_mercado'] = df_auxiliar['score_mercado'].fillna(df_auxiliar['score_mercado'].median())
        
    output_auxiliar = os.path.join(processed_dir, "base_auxiliar_tratada.csv")
    df_auxiliar.to_csv(output_auxiliar, index=False)
    logger.info(f"Salvo {output_auxiliar} com {len(df_auxiliar)} registros.")

if __name__ == "__main__":
    limpar_dados()
