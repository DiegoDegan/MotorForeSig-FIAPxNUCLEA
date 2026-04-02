import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, mean_absolute_error
import shap
import matplotlib.pyplot as plt

# 1. CARREGAMENTO DOS DADOS UNIFICADOS
print("Iniciando Motor Unificado MFS...")
df = pd.read_csv('data/base_treino_com_grafos.csv')

# Definição das Features (X) - O que a IA 'enxerga'
# Usamos as métricas de Grafo + Dados Cadastrais da Núclea
features = [
    'in_degree', 'out_degree', 'total_connections', 
    'score_materialidade_v2', 'indicador_liquidez_quantitativo_3m',
    'sacado_indice_liquidez_1m', 'score_quantidade_v2'
]

# Tratamento básico de nulos (preenchendo com a média ou 0)
X = df[features].fillna(0)

# 2. DEFINIÇÃO DOS ALVOS (TARGETS)
# Target A: Default (1 se a média de atraso histórica é alta, ex: > 15 dias)
y_default = (df['media_atraso_dias'] > 15).astype(int)

# Target B: Temporal (A própria média de dias de atraso para prever fluxo de caixa)
y_temporal = df['media_atraso_dias'].fillna(0)

# 3. TREINAMENTO - MODELO A (CLASSIFICADOR DE DEFAULT)
X_train, X_test, y_train_def, y_test_def = train_test_split(X, y_default, test_size=0.2, random_state=42)

clf_mfs = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
clf_mfs.fit(X_train, y_train_def)

auc_score = roc_auc_score(y_test_def, clf_mfs.predict_proba(X_test)[:, 1])
print(f"Métrica PD (AUC-ROC): {auc_score:.4f}")

# 4. TREINAMENTO - MODELO B (REGRESSOR TEMPORAL)
X_train_t, X_test_t, y_train_temp, y_test_temp = train_test_split(X, y_temporal, test_size=0.2, random_state=42)

reg_mfs = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42)
reg_mfs.fit(X_train_t, y_train_temp)

mae_score = mean_absolute_error(y_test_temp, reg_mfs.predict(X_test_t))
print(f"Métrica Temporal (MAE - Erro de Dias): {mae_score:.2f} dias")

# 5. GERAÇÃO DO OUTPUT FINAL (BASE PARA O DASHBOARD)
df['probability_of_default'] = clf_mfs.predict_proba(X)[:, 1]
df['predicted_delay_days'] = reg_mfs.predict(X)

# Criando a 'Ação Sugerida' baseada nos dois motores
df['status_mfs'] = np.where(df['probability_of_default'] > 0.5, 'BLOQUEAR', 
                   np.where(df['probability_of_default'] > 0.3, 'ANALISE MANUAL', 'APROVAR'))

# 6. EXPLICABILIDADE (SHAP) - Evidência Sprint 3
print("Gerando explicabilidade SHAP...")
explainer = shap.TreeExplainer(clf_mfs)
shap_values = explainer.shap_values(X)
shap.summary_plot(shap_values, X, show=False)
plt.savefig('evidencias/shap_explicabilidade_mfs.png')

# Salvar para o Frontend/Mesa Operacional
df.to_csv('data/output_final_motor_mfs.csv', index=False)
print("Sucesso! Arquivo 'output_final_motor_mfs.csv' gerado.")