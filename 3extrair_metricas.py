import pandas as pd
import os
from neo4j import GraphDatabase
from dotenv import load_dotenv

# Carrega as credenciais a partir do arquivo .env local oculto
load_dotenv()

URI = os.getenv("NEO4J_URI")
USER = os.getenv("NEO4J_USER")
PASSWORD = os.getenv("NEO4J_PASSWORD")

def extrair_metricas_grafo():
    driver = GraphDatabase.driver(URI, auth=(USER, PASSWORD))
    
    # Query para extrair métricas básicas de conectividade
    # Nota: No Tier Free do Aura, usamos Cypher puro para métricas simples
    query = """
    MATCH (e:Empresa)
    OPTIONAL MATCH (e)-[r:PAGOU_PARA]->()
    WITH e, count(r) as out_degree
    OPTIONAL MATCH ()-[r2:PAGOU_PARA]->(e)
    WITH e, out_degree, count(r2) as in_degree
    RETURN e.id_cnpj AS id_cnpj, 
           in_degree, 
           out_degree, 
           (in_degree + out_degree) AS total_connections
    """
    
    with driver.session() as session:
        result = session.run(query)
        df_graph = pd.DataFrame([dict(record) for record in result])
    
    driver.close()
    return df_graph

# Executar e Unificar
df_metricas = extrair_metricas_grafo()
df_aux = pd.read_csv('data/base_auxiliar_fiap.csv')

# Unindo os dados cadastrais com a inteligência do Grafo
df_final_ia = pd.merge(df_aux, df_metricas, on='id_cnpj', how='left').fillna(0)

df_final_ia.to_csv('data/base_treino_com_grafos.csv', index=False)
print("Sucesso! O arquivo 'base_treino_com_grafos.csv' está pronto para a IA.")