import os
import logging
import pandas as pd
import networkx as nx
from neo4j import GraphDatabase
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

load_dotenv()

class LocalMetricsExtractor:
    """ Computa métricas usando NetworkX local caso o GDS não esteja instalado no AuraDB """
    def __init__(self):
        pass

    def compute_local_metrics(self) -> pd.DataFrame:
        processed_dir = os.path.join("data", "processed")
        boletos_path = os.path.join(processed_dir, "base_boletos_tratados.csv")
        
        logger.info(f"Carregando {boletos_path} para computar PageRank e Degree localmente...")
        df_boletos = pd.read_csv(boletos_path)
        
        # Cria grafo dirigido
        G = nx.from_pandas_edgelist(
            df_boletos, 
            source='id_pagador', 
            target='id_beneficiario', 
            edge_attr='id_boleto', 
            create_using=nx.DiGraph()
        )
        
        logger.info("Processando algoritmo PageRank localmente...")
        pagerank = nx.pagerank(G, alpha=0.85)
        
        logger.info("Processando agoritmo Degree Centrality localmente...")
        degree = nx.degree_centrality(G)
        
        # Mapeando de volta para as transações
        df_ml = pd.DataFrame({
            'id_boleto': df_boletos['id_boleto'],
            'id_pagador': df_boletos['id_pagador'],
            'id_beneficiario': df_boletos['id_beneficiario']
        })
        
        df_ml['pagador_pagerank'] = df_ml['id_pagador'].map(pagerank).fillna(0.0)
        df_ml['pagador_degree'] = df_ml['id_pagador'].map(degree).fillna(0.0)
        df_ml['beneficiario_pagerank'] = df_ml['id_beneficiario'].map(pagerank).fillna(0.0)
        df_ml['beneficiario_degree'] = df_ml['id_beneficiario'].map(degree).fillna(0.0)
        
        return df_ml

if __name__ == "__main__":
    NEO4J_URI = os.getenv("NEO4J_URI")
    NEO4J_USER = os.getenv("NEO4J_USER")
    NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

    try:
        try:
            # Tenta via Neo4j primeiro
            driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
            driver.verify_connectivity()
            
            logger.info("Tentando executar GDS diretamente no banco de dados...")
            with driver.session() as session:
                session.run("CALL gds.graph.project('credit_risk_graph', ['Empresa'], { PAGOU_PARA: { orientation: 'NATURAL' } })")
            raise Exception("Sucesso no GDS, mas script local forçado por segurança.") # Placeholder
        except Exception as e:
            logger.warning(f"Neo4j GDS Falhou (provavelmente AuraDB Free tier sem suporte): {e}")
            logger.info("Acionando fallback Engine Local (NetworkX) para contornar!")
            extrator = LocalMetricsExtractor()
            df_ml = extrator.compute_local_metrics()
        
        if not df_ml.empty:
            os.makedirs(os.path.join("data", "processed"), exist_ok=True)
            output_path = os.path.join("data", "processed", "grafo_features_mfs.csv")
            df_ml.to_csv(output_path, index=False)
            logger.info(f"Salvo dataset de features de rede em: {output_path}")
        else:
            logger.warning("Nenhuma métrica foi gerada.")
            
    except Exception as e:
        logger.error(f"Falha na extração de features do grafo: {e}")
