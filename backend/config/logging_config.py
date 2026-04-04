import logging
import sys
from backend.config.settings import get_settings

def setup_logging(logger_name: str = "MotorMFS") -> logging.Logger:
    """
    Centraliza a formatação e as regras de Print do sistema inteiro.
    Dessa forma, abandonamos os `logging.basicConfig(...)` poluidinhos de cada script,
    padronizando a saída para logs robustos estilo Cloud (GCP/Datadog).
    """
    settings = get_settings()
    
    # Garante a formatação Enterprise padrão
    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    # Handler unificado para o Console (Evita duplicidade)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)

    logger = logging.getLogger(logger_name)
    logger.setLevel(getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))
    
    # Limpamos os handlers anteriores para evitar prints duplicados caso chamado recursivamente
    if logger.hasHandlers():
        logger.handlers.clear()
        
    logger.addHandler(console_handler)
    logger.propagate = False  # Evita subir pro Root Logger de bibliotecas chatas

    # Silenciar verbosidade desnecessária de bibliotecas dependentes (NetworkX, Neo4j Http, Requests)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("requests").setLevel(logging.WARNING)
    logging.getLogger("neo4j").setLevel(logging.WARNING)

    return logger
