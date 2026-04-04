import os
import yaml
import logging
import pandas as pd

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

def atualizar_macroprudencial():
    logger.info("Iniciando auditoria dinâmica Macroprudencial (CNAEs)...")
    
    base_file = os.path.join('data', 'processed', 'base_modelagem.csv')
    if not os.path.exists(base_file):
        logger.error(f"Arquivo não encontrado: {base_file}")
        return
        
    df = pd.read_csv(base_file)
    
    if 'cd_cnae_prin' not in df.columns:
        logger.warning("CNAE não encontrado na base de modelagem. Certifique-se de que a origem carregou os dados cadastrais da base auxiliar.")
        return
        
    # 1. Tratar a casa decimal dos CNAEs: remover nulos e formatar de 1066000.0 para "1066000"
    df = df.dropna(subset=['cd_cnae_prin'])
    # Se contiver string mal formada, tenta converter sutilmente
    df['cnae_fmt'] = pd.to_numeric(df['cd_cnae_prin'], errors='coerce').fillna(0).astype(int).astype(str)
    
    # Remove cnaes invalidos ou zerados
    df = df[df['cnae_fmt'] != "0"]
    
    # 2. Computar Tiers de Risco
    logger.info("Agrupando Taxas de Default Históricas por Setor (CNAE)...")
    agrupamento = df.groupby('cnae_fmt')['default'].agg(['mean', 'count']).reset_index()
    agrupamento.rename(columns={'mean': 'taxa_default', 'count': 'volumetria'}, inplace=True)
    
    # Filtro antiruído: Ignorar CNAEs com baixíssima amostragem histórica (< 5 operações)
    cnaes_relevantes = agrupamento[agrupamento['volumetria'] >= 5]
    
    cnaes_bloqueados = cnaes_relevantes[cnaes_relevantes['taxa_default'] >= 0.25]['cnae_fmt'].tolist()
    cnaes_alerta = cnaes_relevantes[(cnaes_relevantes['taxa_default'] >= 0.15) & (cnaes_relevantes['taxa_default'] < 0.25)]['cnae_fmt'].tolist()
    
    # 3. Empacotar e Salvar Config YML
    politica = {
        'filtros_macroprudenciais': {
            'cnaes_bloqueados_tier1': sorted(cnaes_bloqueados),
            'cnaes_alerta_tier2': sorted(cnaes_alerta)
        },
        'limites_concessao_ia': {
            'nota_corte_reprovacao_pd': 0.70,
            'nota_encaminhamento_mesa_pd': 0.40,
            'tolerancia_dias_atraso': 30
        }
    }
    
    config_dir = os.path.join('backend', 'config')
    os.makedirs(config_dir, exist_ok=True)
    out_yaml = os.path.join(config_dir, 'politica_risco.yaml')
    
    with open(out_yaml, 'w', encoding='utf-8') as f:
        # Sort keys para o YML ficar lindinho
        yaml.dump(politica, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
        
    logger.info(f"=== Política Dinâmica salva em {out_yaml} ===")
    logger.info(f"CNAEs Bloqueados (>25% de Risco): {len(cnaes_bloqueados)}")
    logger.info(f"CNAEs em Risco Crítico (15-24%): {len(cnaes_alerta)}")

if __name__ == "__main__":
    atualizar_macroprudencial()
