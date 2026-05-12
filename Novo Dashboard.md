Com base nos dados analisados e no contexto do seu **Challenge FIAP 2025 Núclea**, aqui está uma proposta de arquitetura de dashboard. O objetivo é transformar a análise técnica de grafos e scores em uma ferramenta de tomada de decisão executiva.



**1. Tela: Visão Geral (The Control Room)**

*Foco: Saúde da carteira e identificação imediata de anomalias.*

* **Big Numbers:**

  * **VME (Volume Máximo Exposto):** Soma de todos os boletos em aberto.
  * **Ticket Médio:** Valor nominal médio por boleto.
  * **Inadimplência Atual (%):** Percentual de boletos vencidos não pagos.
  * **Nº de CPJs Ativos:** Contagem única de pagadores e beneficiários.
* **Gráficos Sugeridos:**

  * **TreeMap (CNAE):** Volume financeiro por setor. Ideal para identificar rapidamente que o setor de *Equipamentos Elétricos* detém a maior parte do risco.
  * **Gráfico de Barras Empilhadas (Mensal):** Comparativo entre "Pago no Prazo" vs "Pago com Atraso" para medir a tendência da rede.
  * **Gauge Chart:** Score médio de materialidade da carteira (Índice de saúde geral).



**2. Tela: Risco Temporal e Análise de Grafos**

*Foco: Como o risco se propaga e quanto tempo a rede "sobrevive" ao atraso.*

* **Big Numbers:**

  * **Nós Críticos (Contágio):** Quantidade de Sacados que pagam para > 5 Cedentes.
  * **Grau Médio de Conectividade:** Média de conexões por empresa.
  * **Tempo Médio de Recuperação (Recurência):** Dias médios até a baixa após o vencimento.
* **Gráficos Sugeridos:**

  * **Network Graph (Grafo Dinâmico):** Visualização central onde o tamanho do nó é o volume financeiro e a cor é o score de risco. Permite identificar visualmente o "efeito dominó".
  * **Curva de Sobrevivência (Kaplan-Meier):** Um gráfico de linha decrescente mostrando a probabilidade de um boleto ser pago à medida que os dias passam após o vencimento.
  * **Sankey Diagram:** Fluxo do capital dos Sacados para os Cedentes, evidenciando gargalos financeiros.



**3. Tela: Previsão de Default (PD) e Perda Esperada (EL)**

*Foco: Projeção financeira baseada no score de materialidade.*

* **Big Numbers:**

  * **EL Total (Expected Loss):** Cálculo de $PD \\times LGD \\times EAD$ para toda a carteira.
  * **PD Média:** Probabilidade de Default média da base.
  * **Provisão Sugerida:** Valor em R$ que deve ser reservado para perdas.
* **Gráficos Sugeridos:**

  * **Histograma de Distribuição de Score:** Frequência de empresas por faixa (0-1000). Ajuda a ver se a base está "pendendo" para o risco.
  * **Gráfico de Dispersão (Scatter Plot):** Eixo X: Volume Exposto / Eixo Y: PD (Probabilidade de Default). Quadrantes superiores direitos são os "Top Risks".
  * **Waterfall Chart (Gráfico de Cascata):** Do Valor Total Nominal até o Valor Estimado de Recuperação após perdas previstas.



**4. Tela: Política de Rejeição Automática**

*Foco: Configuração e monitoramento das "travas" de segurança.*

* **Big Numbers:**

  * **Taxa de Rejeição:** % de novos boletos bloqueados pela política.
  * **Falso Positivo Est.:** % de bons pagadores que seriam rejeitados no critério atual.
  * **Economia de Perda:** R$ que deixaram de ser perdidos devido às rejeições.
* **Gráficos Sugeridos:**

  * **Matriz de Confusão/Trade-off:** Gráfico de linhas mostrando o equilíbrio entre "Aprovação" vs "Segurança". Onde as linhas se cruzam é o *sweet spot* da política.
  * **Box Plot (Outliers):** Identificação de boletos com valores fora da curva para um determinado perfil de sacado (Red Flag).
  * **Bullet Chart:** Comparação da meta de inadimplência vs. nível atual após aplicação da política.





**Como fazer:**

Para que você possa implementar o dashboard do seu **Challenge**, aqui está o detalhamento técnico de cada tela. Utilizei as colunas exatas das bases base\_boletos e base\_auxiliar para que a lógica de programação (SQL, Python ou PowerBI) seja direta.



**Tela 1: Visão Geral (Portfolio Health)**

**Objetivo:** Monitorar o status macro da carteira de recebíveis.

* **Big Numbers:**

  * **VME (Volume Máximo Exposto):** $\\sum (\\text{vlr\\nominal})$ onde $\\text{dt\\pagamento}$ é Nulo.
  * **Ticket Médio:** $\\text{Average}(\\text{vlr\\nominal})$.
  * **Inadimplência Real (D+1):** $\\frac{\\sum \\text{vlr\\nominal (vencidos e não pagos)}}{\\sum \\text{vlr\\nominal total}} \\times 100$.
  * **Volume de Baixa:** $\\sum (\\text{vlr\\baixa})$.
* **Gráficos:**

  * **Distribuição por Setor (TreeMap):** Categoria: cd\_cnae\_prin | Valor: $\\sum \\text{vlr\\nominal}$.
  * **Status de Pagamento (Donut Chart):** Baseado na coluna calculada de Status (No Prazo, Atrasado, Pendente).
* **Colunas Utilizadas:** vlr\_nominal, dt\_pagamento, dt\_vencimento, vlr\_baixa, cd\_cnae\_prin.



**Tela 2: Risco Temporal e Grafos (Network Contagion)**

**Objetivo:** Visualizar a interconexão entre empresas e o risco de efeito dominó.

* **Big Numbers:**

  * **Nós de Alta Centralidade:** Contagem de id\_pagador que aparecem para mais de $X$ id\_beneficiario.
  * **Exposição em Rede:** Soma do vlr\_nominal de boletos onde o pagador é também um beneficiário na base (Nós Ambivalentes).
  * **Atraso Médio Sistêmico:** $\\text{Mean}(\\text{media\\atraso\\dias})$ da base auxiliar.
* **Gráficos:**

  * **Grafo de Risco (Force-Directed Graph):**

    * Origem: id\_beneficiario | Destino: id\_pagador.
    * Peso da Aresta: $\\sum \\text{vlr\\nominal}$.
    * Cor do Nó: score\_materialidade\_v2 (Gradiente de Verde a Vermelho).
  * **Curva de Sobrevivência (Line Chart):** Probabilidade de pagamento conforme os dias passam do vencimento (eixo X: dias de atraso, eixo Y: % de boletos liquidados).
* **Colunas Utilizadas:** id\_pagador, id\_beneficiario, vlr\_nominal, score\_materialidade\_v2, media\_atraso\_dias.



**Tela 3: Previsão de Default (PD) e Perda Esperada (EL)**

**Objetivo:** Projeção financeira de perdas futuras para provisionamento.

* **Cálculo Base:**

  * **PD (Probability of Default):** Mapeado via score\_materialidade\_v2. (Ex: Score < 200 $\\rightarrow$ PD 20%).
  * **LGD (Loss Given Default):** $1 - (\\frac{\\text{vlr\\baixa}}{\\text{vlr\\nominal}})$ para casos históricos de atraso.
  * **EL (Expected Loss):** $PD \\times LGD \\times \\text{vlr\\nominal}$.
* **Big Numbers:**

  * **Provisão Total (EL):** $\\sum (\\text{EL individual})$.
  * **PD Média da Carteira:** $\\text{Average}(\\text{PD})$.
* **Gráficos:**

  * **EL por Faixa de Score (Bar Chart):** Eixo X: Buckets de score\_materialidade\_v2 | Eixo Y: $\\sum \\text{EL}$.
  * **Risco por UF (Map):** Cor baseada na PD média por uf.
* **Colunas Utilizadas:** score\_materialidade\_v2, vlr\_nominal, vlr\_baixa, uf.



**Tela 4: Política de Rejeição Automática (Underwriting)**

**Objetivo:** Definir regras de corte para novos boletos baseadas nos dados históricos.

* **Métricas de Simulação:**

  * **Taxa de Aprovação Atual:** % de boletos que passariam se o filtro fosse score\_materialidade\_v2 > 400.
  * **Capital Preservado:** $\\sum \\text{vlr\\nominal}$ de boletos rejeitados que possuíam share\_vl\_inad\_pag\_bol\_6\_a\_15d > 0.5.
* **Gráficos:**

  * **Matriz de Decisão (Heatmap):** Eixo X: sacado\_indice\_liquidez\_1m | Eixo Y: score\_materialidade\_v2. Cores mostram a densidade de atrasos históricos.
  * **Impacto de Corte:** Gráfico de linhas mostrando como a inadimplência cai vs. como o faturamento cai ao subir o régua do Score.
* **Colunas Utilizadas:** score\_materialidade\_v2, sacado\_indice\_liquidez\_1m, share\_vl\_inad\_pag\_bol\_6\_a\_15d, vlr\_nominal.



**Tela 5: Análise de Concentração (Counterparty Risk)**

**Objetivo:** Evitar que o FIDC fique "refém" de poucos grandes pagadores ou setores.

* **Big Numbers:**

  * **Índice Herfindahl-Hirschman (HHI):** Medida de concentração da carteira.
  * **Top 5 Pagadores (%):** Representatividade dos 5 maiores id\_pagador no volume total.
* **Gráficos:**

  * **Pareto de Pagadores (Bar + Line):** Eixo X: id\_pagador | Eixo Y: % Acumulado do Volume.
  * **Liquidez por Setor:** indicador\_liquidez\_quantitativo\_3m médio agrupado por cd\_cnae\_prin.
* **Colunas Utilizadas:** vlr\_nominal, id\_pagador, cd\_cnae\_prin, indicador\_liquidez\_quantitativo\_3m.



**Resumo das Colunas Cruciais para o Código:**

1. **Filtros de Tempo:** dt\_emissao, dt\_vencimento, dt\_pagamento.
2. **Risco:** score\_materialidade\_v2, media\_atraso\_dias, share\_vl\_inad\_pag\_bol\_6\_a\_15d.
3. **Liquidez:** sacado\_indice\_liquidez\_1m, indicador\_liquidez\_quantitativo\_3m.
4. **Financeiro:** vlr\_nominal, vlr\_baixa.

