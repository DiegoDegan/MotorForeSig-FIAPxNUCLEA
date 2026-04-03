import os
import sys
import logging
import joblib
import pandas as pd

# Adicionar raiz no path para imports da IA
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
from backend.core.explicabilidade import RiscoExplainer

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def aplicar_politica(df_predictions):
    """
    Motor de Decisão (Hard Rules).
    Transforma predições do ML em ações de negócio cravadas para a Mesa de Crédito.
    """
    logger.info("Aplicando Política de Risco (Hard Rules)...")
    
    status = []
    
    for _, row in df_predictions.iterrows():
        pd_score = row['score_pd_bruto']
        atraso_previsto = row['atraso_previsto']
        
        # Golden Rules (Política da Empresa MFS)
        if pd_score >= 0.70:
            status.append('REPROVADO_AUTO')
        elif pd_score >= 0.40 or atraso_previsto > 30:
            status.append('ANALISE_MESA')
        elif pd_score < 0.15 and atraso_previsto < 15:
            status.append('APROVADO_AUTO')
        else:
            status.append('ANALISE_MESA')
            
    df_predictions['decisao_politica'] = status
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
        
        # Simula operação: Pega os últimos registros da esteira (que emitiram hoje, por ex)
        logger.info("2. Ingestão da Remessa Comercial...")
        df_real = pd.read_csv(os.path.join(processed_dir, 'base_modelagem.csv'))
        
        # Vamos pegar uma amostra pequena, como um simulador de lote de desconto de recebíveis (FIDCs)
        df_lote = df_real.sample(n=30, random_state=42).copy()
        
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
        
        logger.info("5. Acionando Motor de Decisão (Hard Rules)...")
        df_lote = aplicar_politica(df_lote)
        
        logger.info("6. Transcrevendo SHAP AI Explainability para Business Language...")
        # Chamamos o SHAP explicador (ele pedirá para explicar os mesmos dados)
        # Atenção: Passamos o df_lote intacto pq o `RiscoExplainer` espera os valores brutos para relatar em Reais/Cifras corretos!
        justificativas = explicador.explicar_score(df_lote, top_n=3)
        
        df_lote['parecer_ia_shap'] = [j['justificativa_mesa'] for j in justificativas]
        
        logger.info("7. Exportando Pipeline Operacional (Dashboard/Mesa)...")
        relatorio_colunas = [
            'id_boleto', 'id_pagador', 'vlr_nominal',
            'score_pd_bruto', 'atraso_previsto', 'decisao_politica', 'parecer_ia_shap'
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
        print(f"Risco (PD):   {teste['score_pd_bruto']:.2%}")
        print(f"Dias de Atraso Previstos: {teste['atraso_previsto']:.1f}")
        print(f"VEREDITO:     >>> {teste['decisao_politica']} <<<")
        print(f"Resumo da IA: {teste['parecer_ia_shap']}")
        print("---------------------------------------------------------")
        
    except Exception as e:
        logger.error(f"Falha Operacional no Pipeline: {e}")
        raise

if __name__ == "__main__":
    rodar_pipeline()
