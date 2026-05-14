# Guia de Consumo: Data Insights Motor MFS (Núclea)

Este documento serve como bússola para o time de Front-end, BI e Mesa de Crédito. Ele explica a anatomia dos dados exportados na pasta [data/processed](file:///c:/Users/Degan/Documents/Antigravity/Nuclea/data/processed) e como extrair valor estratégico de cada um.

---

## 1. O Coração da Operação (Mesa de Crédito)

### Arquivo `pipeline_report_mesacredito.csv`
O arquivo mais importante para o dia a dia do FIDC. Ele contém o veredito da IA para cada boleto.
*   **Campos Chave:** `score_pd_bruto` (IA), `perda_esperada_el` (R$), `parecer_ia_shap` (SHAP).
*   **Insight:** Filtrar boletos "Reprovados" com EL alto para auditoria manual imediata.
*   **Gráfico sugerido:** Histograma de distribuição de Scores por Volume Financeiro (R$).

---

## 2. Inteligência Preditiva & Atuarial

### Arquivo `curva_sobrevivencia_*.csv` e `grafico_sobrevivencia_km.png`
Dados estatísticos de **Kaplan-Meier**. Responde: *"Qual a chance deste boleto ser pago se ele já atrasou 5 dias?"*.
*   **Contexto:** Compara boletos de Alto Risco vs. Baixo Risco.
*   **Insight:** Identificar em qual dia (ex: d+15) a probabilidade de recebimento "despenca". Isso define a régua de cobrança.
*   **Gráfico sugerido:** Gráfico de linhas (Line Chart) com as duas curvas sobrepostas (Sobrevivência x Dias).

---

## 3. Visão de Rede e Conectividade

### Arquivo `grafo_features_mfs.csv`
As métricas de centralidade e influência (PageRank) de cada participante da rede de crédito.
*   **Campos Chave:** `pagador_pagerank`, `beneficiario_pagerank`.
*   **Insight:** Identificar "Hubs" de pagadores que, se falharem, podem causar um efeito dominó na carteira.
*   **Gráfico sugerido:** Mapa de Calor (Heatmap) ou Gráfico de Bolhas (Bubble Chart) cruzando PageRank vs. Volume de Boletos.

---

## 4. Governança & Manutenção da IA

### Arquivo `auditoria_drift.csv`
O "Check-up" de saúde do modelo (Índice PSI).
*   **Contexto:** Mostra se os dados atuais ainda parecem com os dados que a IA usou para aprender.
*   **Insight:** Se o PSI de uma feature (ex: `vlr_nominal`) subir acima de 0.25, o cenário mudou e o modelo precisa de retreino.
*   **Gráfico sugerido:** Gauge Chart (Velocímetro) com o nível de estabilidade global.

---

## Próximos Passos para o BI/Frontend

1.  **Dashboard de Mesa:** Consumir o endpoint `/v1/pipeline/report` como fonte primária.
2.  **Painel de Risco Sistêmico:** Usar os dados do `grafo` para mostrar a interconectividade.
3.  **Vigilância Atuarial:** Plotar as curvas de `sobrevivencia` para prever o fluxo de caixa futuro do FIDC.

---

> [!NOTE]
> Todos os outputs do sistema são gerados em formato .csv para garantir máxima compatibilidade com bancos de dados, ferramentas de BI e scripts de automação.

**Versão da Documentação:** 2.0.0  
**Última Atualização:** 13/05/2026

