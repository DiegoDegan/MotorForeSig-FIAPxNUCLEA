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
        import numpy as np
        from collections import defaultdict
        processed_dir = os.path.join("data", "processed")
        boletos_path = os.path.join(processed_dir, "base_boletos_tratados.csv")
        aux_path = os.path.join(processed_dir, "base_auxiliar_tratada.csv")
        
        logger.info("Carregando bases para computar Grafos e Contágio Reverso...")
        df_boletos = pd.read_csv(boletos_path)
        df_aux = pd.read_csv(aux_path)
        
        # Agrupamento para somar os valores das transações paralelas na criação de arestas únicas
        edges = df_boletos.groupby(['id_pagador', 'id_beneficiario']).agg(
            total_valor=('vlr_nominal', 'sum')
        ).reset_index()
        
        # Cria grafo dirigido com valores financeiros ponderados
        G = nx.from_pandas_edgelist(
            edges, 
            source='id_pagador', 
            target='id_beneficiario', 
            edge_attr='total_valor', 
            create_using=nx.DiGraph()
        )
        
        logger.info("Processando PageRank e Degree localmente...")
        pagerank = nx.pagerank(G, weight='total_valor', alpha=0.85)
        degree = nx.degree_centrality(G)
        
        logger.info("Minerando Exposição Reversa (Contágio Protótipo)...")
        # Computar Risco Composto do Sacado
        df_aux['media_atraso_dias'] = df_aux['media_atraso_dias'].fillna(0)
        df_aux['score_materialidade_v2'] = df_aux['score_materialidade_v2'].fillna(500)
        df_aux['risk_score_raw'] = (df_aux['media_atraso_dias'] / 365) + (1 - df_aux['score_materialidade_v2'] / 1000)
        risk_map = dict(zip(df_aux['id_cnpj'], df_aux['risk_score_raw']))
        
        contagio_map = {}
        for n in G.nodes():
            if G.in_degree(n) > 0:
                predecessors = list(G.predecessors(n))
                valor_exposto = 0.0
                riscos_pagadores = []
                
                for p in predecessors:
                    p_risk = risk_map.get(p, 0.5)
                    riscos_pagadores.append(p_risk)
                    
                    if p_risk > 0.5:
                        valor_exposto += G[p][n]['total_valor']
                        
                contagio_map[n] = {
                    'total_exposed_value': valor_exposto,
                    'avg_payer_risk': np.mean(riscos_pagadores) if riscos_pagadores else 0.0,
                    'num_payers': len(predecessors)
                }
            else:
                contagio_map[n] = {
                    'total_exposed_value': 0.0,
                    'avg_payer_risk': 0.0,
                    'num_payers': 0
                }
        
        # Mapeando de volta para o nível Transacional (Boletos Originais)
        df_ml = pd.DataFrame({
            'id_boleto': df_boletos['id_boleto'],
            'id_pagador': df_boletos['id_pagador'],
            'id_beneficiario': df_boletos['id_beneficiario']
        })
        
        df_ml['pagador_pagerank'] = df_ml['id_pagador'].map(pagerank).fillna(0.0)
        df_ml['pagador_degree'] = df_ml['id_pagador'].map(degree).fillna(0.0)
        df_ml['beneficiario_pagerank'] = df_ml['id_beneficiario'].map(pagerank).fillna(0.0)
        df_ml['beneficiario_degree'] = df_ml['id_beneficiario'].map(degree).fillna(0.0)
        
        # Amarrando Contágio no Beneficiário (Cedente)
        df_ml['total_exposed_value'] = df_ml['id_beneficiario'].apply(lambda x: contagio_map.get(x, {}).get('total_exposed_value', 0.0))
        df_ml['avg_payer_risk'] = df_ml['id_beneficiario'].apply(lambda x: contagio_map.get(x, {}).get('avg_payer_risk', 0.0))
        df_ml['num_payers'] = df_ml['id_beneficiario'].apply(lambda x: contagio_map.get(x, {}).get('num_payers', 0))
        
        return df_ml

if __name__ == "__main__":
    NEO4J_URI = os.getenv("NEO4J_URI")
    NEO4J_USER = os.getenv("NEO4J_USER")
    NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

class GDSMetricsExtractor:
    """ Computa métricas usando o plugin Neo4j Graph Data Science (GDS) diretamente no banco """
    def __init__(self, driver):
        self.driver = driver

    def compute_gds_metrics(self) -> pd.DataFrame:
        import numpy as np
        processed_dir = os.path.join("data", "processed")
        boletos_path = os.path.join(processed_dir, "base_boletos_tratados.csv")
        aux_path = os.path.join(processed_dir, "base_auxiliar_tratada.csv")
        
        logger.info("Carregando bases para merge com métricas extraídas do GDS...")
        df_boletos = pd.read_csv(boletos_path)
        df_aux = pd.read_csv(aux_path)
        
        logger.info("Projetando grafo em memória no Neo4j GDS...")
        with self.driver.session() as session:
            session.run("CALL gds.graph.drop('credit_risk_graph', false)")
            session.run("""
                CALL gds.graph.project(
                    'credit_risk_graph',
                    ['Empresa'],
                    { PAGOU_PARA: { orientation: 'NATURAL', properties: ['valor'] } }
                )
            """)
            
            logger.info("Executando algoritmo PageRank no Neo4j GDS...")
            pr_res = session.run("""
                CALL gds.pageRank.stream('credit_risk_graph', { relationshipWeightProperty: 'valor' })
                YIELD nodeId, score
                RETURN gds.util.asNode(nodeId).id AS id, score AS pagerank
            """)
            pagerank = {record["id"]: float(record["pagerank"]) for record in pr_res}
            
            logger.info("Executando algoritmo Degree Centrality no Neo4j GDS...")
            deg_res = session.run("""
                CALL gds.degree.stream('credit_risk_graph')
                YIELD nodeId, score
                RETURN gds.util.asNode(nodeId).id AS id, score AS degree
            """)
            degree = {record["id"]: float(record["degree"]) for record in deg_res}
            
            session.run("CALL gds.graph.drop('credit_risk_graph', false)")
            logger.info(f"Métricas GDS extraídas: {len(pagerank)} nós processados.")
            
        logger.info("Minerando Exposição Reversa (Contágio Protótipo)...")
        df_aux['media_atraso_dias'] = df_aux['media_atraso_dias'].fillna(0)
        df_aux['score_materialidade_v2'] = df_aux['score_materialidade_v2'].fillna(500)
        df_aux['risk_score_raw'] = (df_aux['media_atraso_dias'] / 365) + (1 - df_aux['score_materialidade_v2'] / 1000)
        risk_map = dict(zip(df_aux['id_cnpj'], df_aux['risk_score_raw']))
        
        edges = df_boletos.groupby(['id_pagador', 'id_beneficiario']).agg(
            total_valor=('vlr_nominal', 'sum')
        ).reset_index()
        G = nx.from_pandas_edgelist(
            edges, 
            source='id_pagador', 
            target='id_beneficiario', 
            edge_attr='total_valor', 
            create_using=nx.DiGraph()
        )
        
        contagio_map = {}
        for n in G.nodes():
            if G.in_degree(n) > 0:
                predecessors = list(G.predecessors(n))
                valor_exposto = 0.0
                riscos_pagadores = []
                for p in predecessors:
                    p_risk = risk_map.get(p, 0.5)
                    riscos_pagadores.append(p_risk)
                    if p_risk > 0.5:
                        valor_exposto += G[p][n]['total_valor']
                contagio_map[n] = {
                    'total_exposed_value': valor_exposto,
                    'avg_payer_risk': np.mean(riscos_pagadores) if riscos_pagadores else 0.0,
                    'num_payers': len(predecessors)
                }
            else:
                contagio_map[n] = {
                    'total_exposed_value': 0.0,
                    'avg_payer_risk': 0.0,
                    'num_payers': 0
                }
        
        df_ml = pd.DataFrame({
            'id_boleto': df_boletos['id_boleto'],
            'id_pagador': df_boletos['id_pagador'],
            'id_beneficiario': df_boletos['id_beneficiario']
        })
        
        df_ml['pagador_pagerank'] = df_ml['id_pagador'].map(pagerank).fillna(0.0)
        df_ml['pagador_degree'] = df_ml['id_pagador'].map(degree).fillna(0.0)
        df_ml['beneficiario_pagerank'] = df_ml['id_beneficiario'].map(pagerank).fillna(0.0)
        df_ml['beneficiario_degree'] = df_ml['id_beneficiario'].map(degree).fillna(0.0)
        
        df_ml['total_exposed_value'] = df_ml['id_beneficiario'].apply(lambda x: contagio_map.get(x, {}).get('total_exposed_value', 0.0))
        df_ml['avg_payer_risk'] = df_ml['id_beneficiario'].apply(lambda x: contagio_map.get(x, {}).get('avg_payer_risk', 0.0))
        df_ml['num_payers'] = df_ml['id_beneficiario'].apply(lambda x: contagio_map.get(x, {}).get('num_payers', 0))
        
        return df_ml

if __name__ == "__main__":
    NEO4J_URI = os.getenv("NEO4J_URI")
    NEO4J_USER = os.getenv("NEO4J_USER")
    NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

    try:
        try:
            logger.info("Tentando conectar ao Neo4j e executar GDS nativamente no banco...")
            driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
            driver.verify_connectivity()
            
            gds_extractor = GDSMetricsExtractor(driver)
            df_ml = gds_extractor.compute_gds_metrics()
            logger.info("Sucesso na extração nativa via Neo4j Graph Data Science (GDS)!")
            driver.close()
        except Exception as e:
            logger.warning(f"Neo4j GDS Falhou ou indisponível: {e}")
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
