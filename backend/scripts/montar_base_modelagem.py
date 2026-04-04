import os
import logging
import pandas as pd
import sys

# Ajustar path para importar módulos paralelos
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
from backend.scripts.get_bacen_data import process_bacen_data

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def montar_base_modelagem():
    try:
        processed_dir = os.path.join("data", "processed")
        
        # 1. Carregar Base Boletos
        logger.info("Carregando base_boletos_tratados.csv...")
        path_boletos = os.path.join(processed_dir, "base_boletos_tratados.csv")
        df_boletos = pd.read_csv(path_boletos)
        df_boletos['dt_emissao'] = pd.to_datetime(df_boletos['dt_emissao'])
        
        # 2. Carregar Base Auxiliar
        logger.info("Carregando base_auxiliar_tratada.csv...")
        path_auxiliar = os.path.join(processed_dir, "base_auxiliar_tratada.csv")
        df_aux = pd.read_csv(path_auxiliar)
        
        # 3. Carregar Grafo Features (Cuidado para caso não existir se ocorreu erro no Neo4j)
        logger.info("Carregando grafo_features_mfs.csv...")
        path_grafo = os.path.join(processed_dir, "grafo_features_mfs.csv")
        if os.path.exists(path_grafo):
            df_grafo = pd.read_csv(path_grafo)
        else:
            logger.warning("grafo_features_mfs.csv não encontrado. Merge será feito sem features de rede.")
            df_grafo = pd.DataFrame()
            
        # 4. Obter Dados Macro BACEN
        logger.info("Obtendo dados atualizados do BACEN...")
        df_selic, df_ipca = process_bacen_data()
        
        # --- MERGES ---
        logger.info("Iniciando merges...")
        
        # Merge 1: Boletos + Auxiliar (Focado no Pagador)
        df_modelo = pd.merge(
            df_boletos, 
            df_aux, 
            left_on="id_pagador", 
            right_on="id_cnpj", 
            how="left"
        )
        df_modelo.drop(columns=["id_cnpj"], inplace=True, errors="ignore")
        
        # Merge 2: Boletos + Features de Grafo
        if not df_grafo.empty:
            # Seleciona apenas as colunas que vieram do grafo, se preocupando em não duplicar ids
            colunas_grafo = [col for col in df_grafo.columns if col not in ['id_pagador', 'id_beneficiario']]
            df_modelo = pd.merge(
                df_modelo,
                df_grafo[colunas_grafo],
                on="id_boleto",
                how="left"
            )
            # Imputação de nulos caso algum nó não estivesse no grafo
            df_modelo.fillna({'pagador_pagerank': 0.0, 'beneficiario_pagerank': 0.0, 
                              'pagador_degree': 0.0, 'beneficiario_degree': 0.0}, inplace=True)
                              
        # Merge 3: Macro BACEN (Sincronizado na linha de tempo pela janela de emissão)
        df_modelo = df_modelo.sort_values('dt_emissao')
        df_selic = df_selic.sort_values('data')
        
        df_modelo = pd.merge_asof(
            df_modelo, 
            df_selic[['data', 'valor', 'diff_selic_30d']], 
            left_on='dt_emissao', 
            right_on='data', 
            direction='backward'
        )
        
        # Renomeia para fazer sentido com o contexto de treino do MFS
        df_modelo.rename(columns={'valor': 'taxa_selic_emissao'}, inplace=True)
        df_modelo.drop(columns=['data'], inplace=True, errors="ignore")
        
        # Limpezas Finais antes do ML (substituir tipos textuais e converter IDs)
        # Guardaremos os identificadores para poder saber de que boleto estamos falando na esteira operacional.
        # Eles simplesmente não entrarão como array X na hora do fit (já isolamos isso no treinador.py)
        cols_to_drop = ['tipo_baixa', 'tipo_especie', 'uf', 'dt_vencimento', 'dt_pagamento']
        df_modelo.drop(columns=[c for c in cols_to_drop if c in df_modelo.columns], inplace=True, errors="ignore")
        
        # Dropa possíveis NaNs que sobraram
        df_modelo.fillna(0, inplace=True)
        
        output_path = os.path.join(processed_dir, "base_modelagem.csv")
        df_modelo.to_csv(output_path, index=False)
        
        logger.info(f"Sucesso! Base de modelagem exportada em: {output_path}")
        logger.info(f"Amostra de shape: {df_modelo.shape}")
        
    except Exception as e:
        logger.error(f"Falha ao montar base de modelagem: {e}")
        raise

if __name__ == "__main__":
    montar_base_modelagem()
