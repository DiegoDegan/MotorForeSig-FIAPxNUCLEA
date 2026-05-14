import shap
import joblib
import pandas as pd
import numpy as np
import logging
import os

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class RiscoExplainer:
    def __init__(self, models_dir=None):
        if models_dir is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            self.models_dir = os.path.join(base_dir, 'models')
        else:
            self.models_dir = models_dir
            
        self._load_models()
        logger.info("Inicializando SHAP TreeExplainer com o modelo originado do treinamento...")
        self.explainer = shap.TreeExplainer(self.pd_model)
        
    def _load_models(self):
        try:
            self.pd_model = joblib.load(os.path.join(self.models_dir, 'modelo_pd.joblib'))
            self.features = joblib.load(os.path.join(self.models_dir, 'features.joblib'))
            self.scaler = joblib.load(os.path.join(self.models_dir, 'scaler.joblib'))
        except FileNotFoundError as e:
            logger.error(f"Arquivos de modelo não encontrados no diretório {self.models_dir}. Treine o modelo primeiro (`python model_trainer.py`).")
            raise e

    def explicar_score(self, df_input, top_n=3):
        """
        Gera as justificativas em linguagem de negócios baseada nos valores SHAP (Chain-of-Thought 3).
        A audiência principal são os operadores da mesa de crédito.
        """
        df_copy = df_input.copy()
        
        # O modelo no `model_trainer.py` treina com valores e taxas escalados via StandardScaler
        if hasattr(self.scaler, 'feature_names_in_'):
            cols_to_scale = list(self.scaler.feature_names_in_)
            df_copy[cols_to_scale] = self.scaler.transform(df_copy[cols_to_scale])
            
        # Selecionar apenas as features usadas no treinamento e na mesma exata ordem
        X = df_copy[self.features]
        
        # SHAP calculation
        shap_values = self.explainer.shap_values(X)
        
        # RandomForestClassifier no SHAP novo geralmente retorna numpy array 3D: (n_samples, n_features, n_classes).
        # Antigamente retornava list. Vamos padronizar:
        if isinstance(shap_values, list):
            shap_values = shap_values[1]
        elif len(shap_values.shape) == 3:
            shap_values = shap_values[:, :, 1]
            
        justificativas = []
        scores = self.pd_model.predict_proba(X)[:, 1]
        
        for i in range(len(X)):
            instance_shap = shap_values[i]
            instance_features = X.iloc[i]
            
            # Quais sub-features mais puxaram o ponteiro (para cima/baixo)? (Magnitude absoluta)
            top_indices = np.argsort(np.abs(instance_shap))[-top_n:][::-1]
            
            razoes = []
            for idx in top_indices:
                feature_name = self.features[idx]
                impacto = instance_shap[idx]
                
                # Pegar o valor original real para relatar de forma clara, se disponível no df original
                valor_operacional = df_input.iloc[i][feature_name]
                
                direcao = "aumentou" if impacto > 0 else "reduziu"
                
                # Chain-of-Thought: Tradução para o operador
                if 'total_exposed' in feature_name.lower():
                    razoes.append(f"O grau de exposição financeira a Pagadores Tóxicos do fornecedor (R$ {valor_operacional:,.2f}) {direcao} o risco de contágio imediato")
                elif 'avg_payer_risk' in feature_name.lower():
                    razoes.append(f"O risco estatístico médio da vizinhança na malha (Score: {valor_operacional:.2f}) {direcao} a chance de default em cascata")
                elif 'num_payers' in feature_name.lower():
                    razoes.append(f"A dependência crítica de {valor_operacional:.0f} sacados tóxicos pelo beneficiário {direcao} o grau de incerteza da fatura")
                elif 'pagerank' in feature_name.lower():
                    razoes.append(f"A conectividade sistêmica da empresa na rede (PageRank: {valor_operacional:.4f}) {direcao} substancialmente o risco de contágio")
                elif 'centrality' in feature_name.lower():
                    razoes.append(f"O número de conexões com outras empresas (Centralidade: {valor_operacional:.0f}) {direcao} o risco")
                elif 'valor' in feature_name.lower() or 'vlr_nominal' in feature_name.lower():
                    razoes.append(f"A magnitude financeira/ticket da transação (R$ {valor_operacional:,.2f}) {direcao} a exposição ao risco")
                else:
                    razoes.append(f"O indicador '{feature_name}' (Valor Real: {valor_operacional:.2f}) {direcao} a probabilidade de default baseada em históricos")
            
            # Lógica de negócio de categorização (exemplo didático de limiares)
            risco_categoria = "CRÍTICO" if scores[i] >= 0.7 else ("ALTO" if scores[i] >= 0.5 else ("MÉDIO" if scores[i] >= 0.2 else "BAIXO"))
            
            just_dict = {
                "score_pd": f"{scores[i]:.2%}",
                "categoria_risco": risco_categoria,
                "justificativa_mesa": " | ".join(razoes)
            }
            justificativas.append(just_dict)
            
        return justificativas

if __name__ == "__main__":
    logger.info("Iniciando Teste de Explicabilidade...")
    np.random.seed(42)
    # Mock compatível com as features treinadas
    tamanho = 3
    df_teste = pd.DataFrame({
        'valor_boleto': np.random.uniform(500, 50000, tamanho),
        'taxa_risco': np.random.uniform(0.01, 0.08, tamanho),
        'pagerank_vizinhanca': np.random.uniform(0, 1, tamanho),
        'degree_centrality': np.random.randint(1, 20, tamanho)
    })
    
    try:
        explicador = RiscoExplainer()
        resultados = explicador.explicar_score(df_teste, top_n=3)
        for idx, res in enumerate(resultados):
            print(f"\n--- CASO/BOLETO {idx+1} ---")
            print(f"Risco Previsto: {res['categoria_risco']} (PD: {res['score_pd']})")
            print(f"Parecer para Mesa: {res['justificativa_mesa']}")
    except FileNotFoundError:
        logger.warning("Modelos não encontrados. Rode 'python model_trainer.py' antes para gerar os `.joblib`.")
