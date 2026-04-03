import os
import logging
import pandas as pd
from neo4j import GraphDatabase
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
load_dotenv()

class Neo4jUploader:
    def __init__(self, uri, user, password):
        try:
            self.driver = GraphDatabase.driver(uri, auth=(user, password))
            self.driver.verify_connectivity()
            logger.info("Conexão Neo4j OK")
        except Exception as e:
            logger.error(f"Falha ao conectar no Neo4j: {e}")
            raise

    def close(self):
        self.driver.close()

    def upload_data_batch(self, transactions):
        query = """
        UNWIND $batch AS process
        
        MERGE (c:Empresa {id: process.id_beneficiario})
        ON CREATE SET c.criado_em = datetime(), c.tipo = 'Beneficiário'
        
        MERGE (s:Empresa {id: process.id_pagador})
        ON CREATE SET s.criado_em = datetime(), s.tipo = 'Pagador'
        
        MERGE (s)-[t:PAGOU_PARA {id_boleto: process.id_boleto}]->(c)
        ON CREATE SET t.valor = process.vlr_nominal, 
                      t.data_vencimento = process.dt_vencimento,
                      t.data_pagamento = process.dt_pagamento,
                      t.default = process.default,
                      t.pagou = process.pagou,
                      t.dias_atraso = process.dias_atraso
        """
        
        with self.driver.session() as session:
            try:
                result = session.run(query, batch=transactions)
                counters = result.consume().counters
                logger.info(f"Carga Batch: {counters.nodes_created} nós e {counters.relationships_created} arestas criadas.")
            except Exception as e:
                 logger.error(f"Erro durante injeção batch em Neo4j: {e}")
                 raise

if __name__ == "__main__":
    NEO4J_URI = os.getenv("NEO4J_URI")
    NEO4J_USER = os.getenv("NEO4J_USER")
    NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

    if not all([NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD]):
        logger.error("Credenciais do Neo4j não encontradas no .env")
        exit(1)

    uploader = Neo4jUploader(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD)
    try:
        file_path = os.path.join("data", "processed", "base_boletos_tratados.csv")
        logger.info(f"Carregando {file_path}")
        df_boletos = pd.read_csv(file_path)
        
        # O Neo4j não lida bem com float NaN ou objetos nulos nativos do pandas
        df_boletos = df_boletos.fillna({
            'dt_pagamento': "", 
            'dt_vencimento': "",
            'vlr_nominal': 0.0,
            'dias_atraso': 0
        })
        
        batch = df_boletos.to_dict('records')
        
        chunk_size = 1000
        for i in range(0, len(batch), chunk_size):
            chunk = batch[i:i+chunk_size]
            uploader.upload_data_batch(chunk)
            
        logger.info("Injeção completa.")
    except Exception as e:
        logger.error(f"Erro no pipeline de injeção: {e}")
    finally:
        uploader.close()
