import os
import sys
import logging
import joblib
import pandas as pd
import yaml

# Adicionar raiz no path para imports da IA
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
from backend.core.explicabilidade import RiscoExplainer

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def carregar_politica():
    config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'config', 'politica_risco.yaml')
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    except Exception as e:
        logger.warning(f"Não foi possivel carregar regras do YAML. Usando defaults fixos. Erro: {e}")
        return {}

def aplicar_politica(df_predictions, pol):
    """
    Motor de Decisão Híbrido (IA + Hard Rules + YAML Macroprudencial).
    """
    logger.info("Aplicando Política de Risco (Hard Rules YAML)...")
    
    status = []
    alertas_macro = []
    
    filtros = pol.get('filtros_macroprudenciais', {})
    limites = pol.get('limites_concessao_ia', {})
    
    cnaes_bloqueados = [str(x) for x in filtros.get('cnaes_bloqueados_tier1', [])]
    cnaes_alerta = [str(x) for x in filtros.get('cnaes_alerta_tier2', [])]
    cedentes_bloqueados = [str(x) for x in filtros.get('cedentes_bloqueados_tier1', [])]
    
    pd_reprovacao = limites.get('nota_corte_reprovacao_pd', 0.70)
    pd_mesa = limites.get('nota_encaminhamento_mesa_pd', 0.40)
    atraso_max = limites.get('tolerancia_dias_atraso', 30)
    
    for _, row in df_predictions.iterrows():
        pd_score = row['score_pd_bruto']
        atraso_previsto = row['atraso_previsto']
        
        # Extrai Identificadores
        cnae = pd.to_numeric(row.get('cd_cnae_prin', 0), errors='coerce')
        cnae_str = str(int(cnae)) if pd.notna(cnae) else "0"
        id_ben = str(row.get('id_beneficiario', '0'))
        
        # Alerta Setorial
        alerta_setor = f" [ALERTA MACRO] Setor CNAE {cnae_str} encontra-se em estado de atenção (Tier 2)." if cnae_str in cnaes_alerta else ""
        alertas_macro.append(alerta_setor)
        
        # Regra 1: Bloqueio Macroprudencial Setorial
        if cnae_str in cnaes_bloqueados:
            status.append('REPROVADO_SETORES_CRITICOS')
            continue
            
        # Regra 2: Bloqueio Fornecedor (Cedente Tóxico)
        if id_ben in cedentes_bloqueados:
            status.append('REPROVADO_CEDENTE_TOXICO')
            continue
            
        # Regra 3: Score de IA da Empresa
        if pd_score >= pd_reprovacao:
            status.append('REPROVADO_AUTO')
        elif pd_score >= pd_mesa or atraso_previsto > atraso_max:
            status.append('ANALISE_MESA')
        elif pd_score < 0.15 and atraso_previsto < 15:
            status.append('APROVADO_AUTO')
        else:
            status.append('ANALISE_MESA')
            
    df_predictions['decisao_politica'] = status
    df_predictions['alerta_macro'] = alertas_macro
    return df_predictions

def rodar_pipeline():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    models_dir = os.path.join(base_dir, 'models')
    processed_dir = os.path.join('data', 'processed')
    
    try:
        logger.info("1. Boot da Inteligência...")
        pd_model = joblib.load(os.path.join(models_dir, 'modelo_pd.joblib'))
        delay_model = joblib.load(os.path.join(models_dir, 'modelo_atraso.joblib'))
        features = joblib.load(os.path.join(models_dir, 'features.joblib'))
        scaler = joblib.load(os.path.join(models_dir, 'scaler.joblib'))
        
        explicador = RiscoExplainer(models_dir=models_dir)
        
        # Operação em Toda a Base Ativa
        logger.info("2. Ingestão da Remessa Comercial...")
        df_real = pd.read_csv(os.path.join(processed_dir, 'base_modelagem.csv'))

        # Pega toda a base sem limitação
        df_lote = df_real.copy()

        # Re-attach colunas descartadas no build da base de modelagem para compor o relatório final
        _bol_raw = pd.read_csv(os.path.join(processed_dir, 'base_boletos_tratados.csv'))
        _extra_bol = [c for c in ['id_boleto', 'dt_vencimento', 'dt_pagamento', 'tipo_baixa', 'tipo_especie'] if c in _bol_raw.columns]
        df_lote = df_lote.merge(_bol_raw[_extra_bol], on='id_boleto', how='left')
        del _bol_raw

        # uf vem da base auxiliar (id_cnpj = id_pagador)
        _aux_raw = pd.read_csv(os.path.join(processed_dir, 'base_auxiliar_tratada.csv'))
        if 'uf' in _aux_raw.columns and 'id_cnpj' in _aux_raw.columns:
            df_lote = df_lote.merge(
                _aux_raw[['id_cnpj', 'uf']].rename(columns={'id_cnpj': 'id_pagador'}),
                on='id_pagador', how='left'
            )
        del _aux_raw
        
        logger.info("3. Formatando Vetores para IA...")
        X = df_lote.copy()
        
        # O explorador da classe RiscoExplainer usa as features exatas do treino.
        # Nós normalizamos para a inferência local e guardamos as predições.
        if hasattr(scaler, 'feature_names_in_'):
            cols_to_scale = list(scaler.feature_names_in_)
            X[cols_to_scale] = scaler.transform(X[cols_to_scale])
             
        # Restringir apenas as features numéricas oficiais do treino (exclui identificadores)
        X = X[features]
        
        logger.info("4. Inferência Preditiva Simultânea (PD & LGD)...")
        scores_pd = pd_model.predict_proba(X)[:, 1]
        previsoes_atraso = delay_model.predict(X)
        
        df_lote['score_pd_bruto'] = scores_pd
        df_lote['atraso_previsto'] = previsoes_atraso
        
        # Computação Contábil FIDC: Perda Esperada (EL) em Reais
        df_lote['perda_esperada_el'] = df_lote['vlr_nominal'] * df_lote['score_pd_bruto']
        
        logger.info("5. Acionando Motor de Decisão (Hard Rules Hibrido YAML)...")
        politica_yaml = carregar_politica()
        df_lote = aplicar_politica(df_lote, politica_yaml)
        
        logger.info("6. Transcrevendo SHAP AI Explainability para Business Language...")
        justificativas = explicador.explicar_score(df_lote, top_n=3)
        
        pareceres = []
        for j, (_, row) in zip(justificativas, df_lote.iterrows()):
            texto_base = j['justificativa_mesa']
            texto_final = texto_base + row['alerta_macro']
            pareceres.append(texto_final)
            
        df_lote['parecer_ia_shap'] = pareceres

        # Colunas finais do relatório com nomes padronizados para o dashboard
        df_lote['PD']  = df_lote['score_pd_bruto']
        df_lote['LGD'] = (
            1 - df_lote['vlr_baixa'].div(df_lote['vlr_nominal'].replace(0, float('nan')))
        ).clip(0, 1).fillna(0.45)
        df_lote['EL']                 = df_lote['PD'] * df_lote['LGD'] * df_lote['vlr_nominal']
        df_lote['atraso_previsto_dias'] = df_lote['atraso_previsto']
        df_lote['STATUS_FINAL']       = df_lote['decisao_politica']
        df_lote['MOTIVO_DECISAO']     = df_lote['parecer_ia_shap']
        df_lote['id_cnpj']            = df_lote['id_pagador']

        logger.info("7. Exportando Pipeline Operacional (Dashboard/Mesa)...")
        relatorio_colunas = [
            'id_boleto', 'id_pagador', 'id_beneficiario', 'dt_emissao',
            'dt_vencimento', 'dt_pagamento', 'vlr_nominal', 'vlr_baixa',
            'tipo_baixa', 'tipo_especie', 'id_cnpj', 'cd_cnae_prin', 'uf',
            'sacado_indice_liquidez_1m', 'cedente_indice_liquidez_1m',
            'score_materialidade_evolucao', 'media_atraso_dias',
            'indicador_liquidez_quantitativo_3m', 'share_vl_inad_pag_bol_6_a_15d',
            'score_quantidade_v2', 'score_materialidade_v2',
            'atraso_previsto_dias',
            'PD', 'LGD', 'EL', 'STATUS_FINAL', 'MOTIVO_DECISAO',
            # colunas originais mantidas para compatibilidade com o dashboard
            'score_pd_bruto', 'perda_esperada_el', 'decisao_politica',
        ]
        
        # Garante que identificadores não travem caso não estejam na lista amostrada
        colunas_final = [c for c in relatorio_colunas if c in df_lote.columns]
        df_relatorio = df_lote[colunas_final]
        
        # Sort pela urgência (Os mais arriscados para cima)
        df_relatorio = df_relatorio.sort_values(by='score_pd_bruto', ascending=False)
        
        output_file = os.path.join(processed_dir, 'pipeline_report_mesacredito.xlsx')
        # Em vez de openpyxl que talvez não tenhamos instalado, usamos CSV pro MFS
        output_file_csv = os.path.join(processed_dir, 'pipeline_report_mesacredito.csv')
        df_relatorio.to_csv(output_file_csv, index=False)
        logger.info(f"== Esteira Completa! Report gerado com IA e SHAP: {output_file_csv} ==")
        
        # Print de 1 caso pro console
        teste = df_relatorio.iloc[0]
        print("\n\n------- EXEMPLO REAL DE SAÍDA (TELA DO OPERADOR) --------")
        print(f"Boleto Cód:   {teste.get('id_boleto', 'N/A')[:10]}...")
        print(f"Valor Face:   R$ {teste.get('vlr_nominal', 0):,.2f}")
        print(f"Risco (PD):   {teste['score_pd_bruto']:.2%}")
        print(f"Perda EL:     R$ {teste.get('perda_esperada_el', 0):,.2f}")
        print(f"Dias de Atraso Previstos: {teste.get('atraso_previsto_dias', teste.get('atraso_previsto', 0)):.1f}")
        print(f"VEREDITO:     >>> {teste['decisao_politica']} <<<")
        print(f"Resumo da IA: {teste['parecer_ia_shap']}")
        print("---------------------------------------------------------")
        
    except Exception as e:
        logger.error(f"Falha Operacional no Pipeline: {e}")
        raise

if __name__ == "__main__":
    rodar_pipeline()
