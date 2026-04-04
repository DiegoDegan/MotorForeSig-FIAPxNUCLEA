# Arquitetura e Fluxo do Projeto Nuclea - Motor MFS

Este documento descreve a arquitetura proposta para o pipeline de dados, modelagem de risco e decisão operacional, agora integrando o Neo4j como motor de inteligência de rede.

---

## Estrutura de Fluxo Lógico Recomendado
`Limpeza` ➔ `Sincronização Neo4j` ➔ `Extrair Métricas Grafo (GDS)` ➔ `Treinar PD` ➔ `Treinar Atraso` ➔ `Aplicar Política` ➔ `Gerar Pipeline Operador`

---

## Módulos do Sistema

### 1. Limpeza (limpeza.py)
**Objetivo:** Padronizar e preparar as bases transacionais e auxiliares para uso em todos os módulos seguintes.

*   **Framework / Stack:** Python 3.11+, Pandas, SQLAlchemy.
*   **Entradas:** 
    *   Tabela de boletos (IDs, valores, datas de emissão/vencimento/pagamento).
    *   Base auxiliar de empresas (CNPJ, score materialidade, CNAE, UF).
*   **Processamento:**
    *   Cálculo de dias de atraso e flag de Default (atraso > 60 dias).
    *   Criação de flags de evento (pago ou em aberto).
    *   Padronização de chaves e tratamento de nulos.
*   **Saídas:** boletos_tratados, empresas_tratadas.

### 2. Sincronização Neo4j (upload_neo4j.py)
**Objetivo:** Persistir a rede de pagamentos no banco de grafos para análise de contágio e centralidade.

*   **Framework / Stack:** Python Neo4j Driver, Cypher.
*   **Processamento:** 
    *   Criação de nós de Empresas (Pagadores e Beneficiários) com seus atributos.
    *   Criação de relacionamentos (PAGOU_PARA) com propriedades de valor e data.
    *   Garantia de índices e restrições de integridade no banco.
*   **Saídas:** Banco Neo4j atualizado com a topologia da rede.

### 3. Métricas de Grafo via GDS (extrair_metricas_grafo.py)
**Objetivo:** Utilizar o motor Graph Data Science do Neo4j para gerar métricas de conectividade e risco sistêmico.

*   **Framework / Stack:** Neo4j GDS Library, Cypher.
*   **Processamento:** 
    *   Cálculo de PageRank (importância sistêmica do nó).
    *   Cálculo de Degree Centrality (In-Degree/Out-Degree).
    *   Detecção de Comunidades (Louvain) para identificar grupos de risco.
    *   Cálculo de risco por vizinhança (vulnerabilidade por contágio).
*   **Saídas:** features_grafo_empresas (exportadas do Neo4j de volta para o pipeline).

### 4. Base de Modelagem (montar_base_modelagem.py)
**Objetivo:** Unificar boletos tratados, base auxiliar e as métricas avançadas extraídas do Neo4j.

*   **Processamento:** Merges de boletos + auxiliar + métricas calculadas pelo Neo4j por CNPJ.
*   **Saídas:** base_modelagem_pd, base_modelagem_atraso, base_scoring.

### 5. Modelo de PD - Probabilidade de Default (treinar_pd.py / score_pd.py)
**Objetivo:** Treinar o modelo de probabilidade de default integrando atributos cadastrais e de rede.

*   **Algoritmo:** RandomForestClassifier.
*   **Lógica:** Uso de predict_proba para obter o risco técnico; categorização em faixas (Baixo, Moderado, Alto, Crítico).
*   **Saídas:** modelo_pd.joblib, métricas (AUC, Precision/Recall), predicoes_pd.

### 6. Modelo Temporal - Atraso (treinar_atraso.py / score_atraso.py)
**Objetivo:** Estimar o atraso previsto para apoiar fluxo de caixa e priorização.

*   **Algoritmo:** RandomForestRegressor.
*   **Filtro:** Treinado apenas com boletos já pagos (event == 1).
*   **Saídas:** modelo_atraso.joblib, previsão de dias de atraso, ranking de prioridades.

### 7. Política de Risco (gerar_parametros_politica.py / aplicar_politica.py)
**Objetivo:** Materializar e aplicar as Hard Rules de negócio de forma auditável.

*   **Lógica de Aplicação:**
    *   CNAEs em setores bloqueados ➔ Rejeitar.
    *   Cedentes em listas de bloqueio ➔ Rejeitar.
    *   Probability of Default > limite_maximo ➔ Rejeitar.
*   **Saídas:** config_politica.yaml, resultados de rejeição/aprovação com motivos.

### 8. Pipeline Operacional (pipeline_operacional.py)
**Objetivo:** Gerar a visão final formatada e permitir visualização de teia de risco.

*   **Saída:** Arquivo Excel (pipeline_operador_mesa.xlsx).
*   **Integração Visual:** O operador pode usar o ID do boleto para visualizar a vizinhança de risco diretamente no Neo4j Browser ou Dashboard.

---

## Estrutura de Pastas Final

```text
/Nuclea
├── /backend
│   ├── /scripts        # ETL, Sincronização Neo4j, Auxiliares
│   └── /core           # Inteligência: Treinos, Scores e Políticas
├── /data
│   ├── /raw            # Bases originais (CSV)
│   └── /processed      # Outputs de cada etapa (CSV/Parquet)
├── /prototipo_frontend # Dashboard React/Vite
├── .gitignore
├── requirements.txt
└── .env
```

---

## Regras de Ouro a Preservar
1.  **Soberania do Grafo:** O risco não é apenas individual, é sistêmico (calculado via GDS).
2.  **Métricas Sistêmicas:** Uso obrigatório de PageRank e Centralidade via Neo4j.
3.  **Definição de Default:** Padronizada em não pagamento ou atraso > 60 dias.
4.  **Decisão Baseada em PD:** O coração da aprovação é o predict_proba.
5.  **Auditabilidade:** Parâmetros de política externos (YAML) e logs de decisão.

---

## Avaliação do Fluxo com Neo4j
*   **Sinergia:** Ao substituir o NetworkX pelo Neo4j GDS, o projeto sobe de patamar técnico. O Neo4j permite consultas de "hop" (pulos na rede) que o Python sozinho demora muito para processar.
*   **Escalabilidade:** A separação permite que o banco de grafos cresça independentemente dos scripts de modelagem.
*   **Conclusão:** Esta arquitetura é robusta o suficiente para lidar com milhões de registros da Núclea mantendo a performance analítica.