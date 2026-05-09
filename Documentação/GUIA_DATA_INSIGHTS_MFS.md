# 📊 Guia de Consumo: Planilhas MVP Motor MFS (Núclea)

Este documento serve como bússola para o time de Front-end, BI e Mesa de Crédito. Ele explica a anatomia dos dados exportados na pasta [Planilhas MVP atual](file:///c:/Users/Degan/Documents/Antigravity/Nuclea/Planilhas%20MVP%20atual) e como extrair valor estratégico de cada um.

---

## 🛠️ 1. O Coração da Operação (Mesa de Crédito)

### 📄 `pipeline_report_mesacredito.xlsx`
O arquivo mais importante para o dia a dia do FIDC. Ele contém o veredito da IA para cada boleto.
*   **Campos Chave:** `score_pd_bruto` (IA), `perda_esperada_el` (R$), `parecer_ia_shap` (SHAP).
*   **💡 Sugestão de Insight:** Filtrar boletos "Reprovados" com EL alto para auditoria manual imediata.
*   **📈 Gráfico Sugerido:** Histograma de distribuição de Scores por Volume Financeiro (R$).

---

## 📈 2. Inteligência Preditiva & Atuarial

### 📄 `curva_sobrevivencia_*.csv` e `grafico_sobrevivencia_km.png`
Dados estatísticos de **Kaplan-Meier**. Responde: *"Qual a chance deste boleto ser pago se ele já atrasou 5 dias?"*.
*   **Contexto:** Compara boletos de Alto Risco vs. Baixo Risco.
*   **💡 Sugestão de Insight:** Identificar em qual dia (ex: d+15) a probabilidade de recebimento "despenca". Isso define a régua de cobrança.
*   **📈 Gráfico Sugerido:** Gráfico de linhas (Line Chart) com as duas curvas sobrepostas (Sobrevivência x Dias).

---

## 🕸️ 3. Visão de Rede e Conectividade

### 📄 `grafo_features_mfs.xlsx`
As métricas de centralidade e influência (PageRank) de cada participante da rede.
*   **Campos Chave:** `pagador_pagerank`, `beneficiario_pagerank`.
*   **💡 Sugestão de Insight:** Identificar "Hubs" de pagadores que, se falharem, podem causar um efeito dominó no fundo.
*   **📈 Gráfico Sugerido:** Mapa de Calor (Heatmap) ou Gráfico de Bolhas (Bubble Chart) cruzando PageRank vs. Volume de Boletos.

---

## 🚔 4. Governança & Manutenção da IA

### 📄 `auditoria_drift.csv`
O "Check-up" de saúde do modelo (Índice PSI).
*   **Contexto:** Mostra se os dados atuais ainda parecem com os dados que a IA usou para aprender.
*   **💡 Sugestão de Insight:** Se o PSI de uma feature (ex: `taxa_selic`) subir acima de 0.25, o modelo está "cego" para o novo cenário e precisa de retreino.
*   **📈 Gráfico Sugerido:** Gauge Chart (Velocímetro) com o nível de estabilidade global.

### 📄 `politica_risco.yaml / .json`
Configurações de "Hard Rules" (CNAEs banidos e Notas de Corte).
*   **Contexto:** São as regras de filtragem macro antes da IA.
*   **💡 Sugestão de Insight:** Ver quais setores (CNAEs) estão bloqueados hoje e conferir se o motivo foi Default Histórico ou Risco de Contágio.

---

## 🚀 Próximos Passos para o BI/Frontend

1.  **Dashboard de Mesa:** Consumir o `pipeline_report` como fonte primária.
2.  **Painel de Risco Sistêmico:** Usar os dados do `grafo` para mostrar a interconectividade.
3.  **Vigilância Atuarial:** Plotar as curvas de `sobrevivencia` para prever o fluxo de caixa futuro do FIDC.

> [!TIP]
> Use os arquivos `.csv` para alimentar bancos de dados ou Dataframes e os arquivos `.xlsx` para apresentações rápidas para a Diretoria.

---

**Gerado pelo Motor ForeSig em: 09/05/2026**
