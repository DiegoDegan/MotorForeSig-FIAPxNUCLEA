import pandas as pd
from neo4j import GraphDatabase
import time
import os
from dotenv import load_dotenv

# Carrega as credenciais a partir do arquivo .env local oculto
load_dotenv()

URI = os.getenv("NEO4J_URI")
USER = os.getenv("NEO4J_USER")
PASSWORD = os.getenv("NEO4J_PASSWORD")

def carregar_dados_mfs():
    # 1. Conectar ao Driver
    driver = GraphDatabase.driver(URI, auth=(USER, PASSWORD))
    print("Conectado ao Neo4j AuraDB!")

    try:
        # 2. Carregar os CSVs Limpos + Auxiliar (Garanta que os arquivos estão na mesma pasta)
        df_aux = pd.read_csv('data/base_auxiliar_fiap.csv')
        df_boletos = pd.read_csv('data/base_boletos_LIMPA.csv') # Usa o arquivo limpo com is_default

        with driver.session() as session:
            
            # PARTE A: Criar Nós de Empresa (Com Batching UNWIND) 
            print("Iniciando criação dos Nós (Empresas)...")
            
            # Converte o DataFrame para lista de dicionários para ingestão massiva
            nodes_batch = df_aux.to_dict('records')
            
            query_nodes = """
            UNWIND $batch AS row
            MERGE (e:Empresa {id_cnpj: row.id_cnpj})
            SET e.cnae = row.cd_cnae_prin,
                e.uf = row.uf,
                e.score_materialidade = toFloat(row.score_materialidade_v2),
                e.indicador_liquidez = toFloat(row.indicador_liquidez_quantitativo_3m)
            """
            
            session.run(query_nodes, batch=nodes_batch)
            print(f"Total de {len(nodes_batch)} nós 'Empresa' injetados via UNWIND.")

            # PARTE B: Criar Relações de Pagamento (Com Batching UNWIND)
            print("\nIniciando criação das Relações (Boletos)...")
            
            rels_batch = df_boletos.to_dict('records')
            
            query_rels = """
            UNWIND $batch AS row
            MATCH (p:Empresa {id_cnpj: row.id_pagador})
            MATCH (b:Empresa {id_cnpj: row.id_beneficiario})
            CREATE (p)-[r:PAGOU_PARA {
                id_boleto: row.id_boleto,
                valor: toFloat(row.vlr_nominal),
                vencimento: row.dt_vencimento,
                is_default: toInteger(row.is_default)
            }]->(b)
            """
            
            session.run(query_rels, batch=rels_batch)
            print(f"Total de {len(rels_batch)} relações 'PAGOU_PARA' injetadas via UNWIND.")

    except Exception as e:
        print(f"Erro durante a ingestão: {e}")
    finally:
        driver.close()
        print("\nConexão com Neo4j encerrada.")

# --- EXECUTAR ---
if __name__ == "__main__":
    start_time = time.time()
    carregar_dados_mfs()
    end_time = time.time()
    print(f"Tempo total: {end_time - start_time:.2f} segundos.")