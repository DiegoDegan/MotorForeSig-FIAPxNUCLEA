from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    # Identificação de Ambiente
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    
    # API e Aplicação (FastAPI)
    API_TITLE: str = "Motor Cérebro MFS (Núclea)"
    API_VERSION: str = "v1"
    
    # Banco de Grafos (Neo4j)
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "password"
    NEO4J_DATABASE: str = "neo4j"
    
    # Integrações (Banco Central / Macroeconomia)
    BACEN_API_BASE_URL: str = "https://api.bcb.gov.br/dados/serie/bcdata.sgs"
    
    # Motor de Risco (Parâmetros Universais)
    MAX_PD_THRESHOLD: float = 0.35
    DIAS_ATRASO_DEFAULT: int = 60
    
    # Pydantic Configuration: Localiza automaticamente seu ".env" lá na raiz
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

# Instância Singleton Central para todo projeto importar de uma vez
settings = Settings()

def get_settings() -> Settings:
    """
    Dependency Injection principal para uso nas rotas do FastAPI (main_rest_api.py).
    Garante que os dados sejam lidos da memória ao invés de ficar batendo no disco (.env).
    """
    return settings
