import os
import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime
from google.cloud import storage

# Configuração básica de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class GCSManager:
    """
    Gerenciador para operações no Google Cloud Storage.
    Garante persistência efêmera para o MVP do Motor MFS (Relatórios e Logs de Decisão).
    """

    def __init__(self, bucket_name: Optional[str] = None):
        """
        Inicializa o cliente do GCS.
        Espera-se que a variável de ambiente GCP_BUCKET_NAME esteja configurada.
        """
        self.bucket_name = bucket_name or os.getenv("GCP_BUCKET_NAME")
        
        if not self.bucket_name:
            logger.warning("Variável GCP_BUCKET_NAME não configurada. GCSManager instanciado em modo inativo.")
            self.client = None
            self.bucket = None
        else:
            try:
                self.client = storage.Client()
                self.bucket = self.client.bucket(self.bucket_name)
                logger.info(f"GCSManager inicializado no bucket: {self.bucket_name}")
            except Exception as e:
                logger.error(f"Falha ao inicializar o cliente do Google Cloud Storage: {e}")
                self.client = None
                self.bucket = None

    def upload_csv_report(self, file_path: str, blob_name: Optional[str] = None) -> bool:
        """
        Função A: Upload do CSV consolidado da "Mesa de Crédito".
        
        Args:
            file_path: Caminho local do arquivo CSV.
            blob_name: Caminho/Nome do arquivo no bucket (opcional, por padrão usa o nome original na pasta reports/).
        """
        if not self.bucket:
            logger.error("Bucket não configurado. Upload de relatório cancelado.")
            return False
            
        if not os.path.exists(file_path):
            logger.error(f"Arquivo não encontrado localmente: {file_path}")
            return False

        if not blob_name:
            filename = os.path.basename(file_path)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            blob_name = f"reports/mesa_credito_{timestamp}_{filename}"

        try:
            blob = self.bucket.blob(blob_name)
            blob.upload_from_filename(file_path)
            logger.info(f"Relatório {file_path} salvo com sucesso no GCS em: {blob_name}")
            return True
        except Exception as e:
            logger.error(f"Erro ao fazer upload do CSV para o GCS: {e}")
            return False

    def upload_decision_log(self, prediction_id: str, decision_data: Dict[str, Any]) -> bool:
        """
        Função B: Armazenamento de "Decision Logs" individuais (JSON) para cada predição da API.
        
        Args:
            prediction_id: ID único da predição/operação.
            decision_data: Dicionário contendo os dados da requisição, scores e justificativas.
        """
        if not self.bucket:
            logger.error("Bucket não configurado. Upload do log de decisão cancelado.")
            return False

        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            # Salva num subdiretório decision_logs agrupado opcionalmente por dia
            agrupamento_diario = datetime.now().strftime("%Y-%m-%d")
            destination_blob_name = f"decision_logs/{agrupamento_diario}/{timestamp}_{prediction_id}.json"
            
            blob = self.bucket.blob(destination_blob_name)
            blob.upload_from_string(
                data=json.dumps(decision_data, indent=2, ensure_ascii=False),
                content_type='application/json'
            )
            logger.info(f"Log de decisão salvo com sucesso no GCS em: {destination_blob_name}")
            return True
        except Exception as e:
            logger.error(f"Erro ao salvar o log de decisão no GCS: {e}")
            return False
