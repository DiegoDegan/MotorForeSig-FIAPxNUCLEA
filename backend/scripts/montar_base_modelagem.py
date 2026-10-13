import os
import logging
import pandas as pd
import sys

# Ajustar path para importar módulos paralelos
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def montar_base_modelagem():
    try:
        processed_dir = os.path.join("data", "processed")
        
        # 1. Carregar Base Boletos
        logger.info("Carregando base_boletos_tratados.csv...")
        path_boletos = os.path.join(processed_dir, "base_boletos_tratados.csv")
        if not os.path.exists(path_boletos):
            raise FileNotFoundError(f"Arquivo não encontrado: {path_boletos}. Rode o script de limpeza primeiro.")
            
        df_boletos = pd.read_csv(path_boletos)
        df_boletos['dt_emissao'] = pd.to_datetime(df_boletos['dt_emissao'])
        
        # 2. Carregar Base Auxiliar (CNPJ info)
        logger.info("Carregando base_auxiliar_tratada.csv...")
        path_auxiliar = os.path.join(processed_dir, "base_auxiliar_tratada.csv")
        df_aux = pd.read_csv(path_auxiliar)
        
        # 3. Carregar Grafo Features (Métricas do Neo4j)
        logger.info("Carregando grafo_features_mfs.csv...")
        path_grafo = os.path.join(processed_dir, "grafo_features_mfs.csv")
        if os.path.exists(path_grafo):
            df_grafo = pd.read_csv(path_grafo)
        else:
            logger.warning("grafo_features_mfs.csv não encontrado. Merge será feito sem features de rede.")
            df_grafo = pd.DataFrame()
            
        # --- MERGES ---
        logger.info("Iniciando merges...")
        
        # Merge 1: Boletos + Dados do Pagador (CNPJ)
        df_modelo = pd.merge(
            df_boletos, 
            df_aux, 
            left_on="id_pagador", 
            right_on="id_cnpj", 
            how="left"
        )
        df_modelo.drop(columns=["id_cnpj"], inplace=True, errors="ignore")
        
        # Merge 2: Mesclagem de Features de Grafo (Centralidade/PageRank)
        if not df_grafo.empty:
            logger.info("Adicionando inteligência de rede (Grafos)...")
            cols_grafo = [c for c in df_grafo.columns if c == 'id_boleto' or c not in ['id_pagador', 'id_beneficiario']]
            df_modelo = pd.merge(
                df_modelo,
                df_grafo[cols_grafo],
                on="id_boleto",
                how="left"
            )
        
        # Limpezas Finais para o ML
        # Removemos colunas temporais ou categóricas pesadas que não entram no treinamento
        cols_to_drop = ['tipo_baixa', 'tipo_especie', 'uf', 'dt_vencimento', 'dt_pagamento']
        df_modelo.drop(columns=[c for c in cols_to_drop if c in df_modelo.columns], inplace=True, errors="ignore")
        
        # Tratamento de valores nulos pós-merge
        df_modelo.fillna(0, inplace=True)
        
        output_path = os.path.join(processed_dir, "base_modelagem.csv")
        df_modelo.to_csv(output_path, index=False)
        
        logger.info(f"Sucesso! Base de modelagem exportada em: {output_path}")
        logger.info(f"Shape final da base: {df_modelo.shape}")
        
    except Exception as e:
        logger.error(f"Falha ao montar base de modelagem: {e}")
        raise

if __name__ == "__main__":
    montar_base_modelagem()
