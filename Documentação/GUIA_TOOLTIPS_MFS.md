# Guia de Tooltips — Nuclea MFS

Este documento reúne todas as descrições técnicas e funcionais dos cards e gráficos do dashboard Nuclea MFS, organizadas por aba.

---

## 1. Visão Geral (Cockpit)

### VME — Volume Máximo Exposto
**Tooltip:** Soma total do valor nominal de todos os boletos em aberto na carteira.

### Ticket Médio por Boleto
**Tooltip:** Valor médio individual de cada boleto presente na carteira atual.

### Inadimplência Real (D+1)
**Tooltip:** Percentual de boletos que já venceram e ainda não foram liquidados até a data de processamento.

### Volume de Baixa
**Tooltip:** Montante financeiro total que já foi efetivamente pago e baixado no sistema.

### Exposição Setorial e Capilaridade
**Tooltip:** Visualização proporcional do volume financeiro alocado em cada setor da economia através do CNAE do pagador.

### Composição de Adimplência Operacional
**Tooltip:** Divisão quantitativa de boletos por sua situação atual (pago no prazo, atrasado, etc).

### Sazonalidade e Performance de Liquidação
**Tooltip:** Evolução temporal do volume financeiro liquidado, segregando pagamentos feitos no prazo vs atrasados.

### Rating de Qualidade do Lastro (MFS)
**Tooltip:** Índice de saúde financeira da carteira baseado no cruzamento de dados de pagadores e base auxiliar.

---

## 2. Risco de Rede (Sistêmico)

### Curva de Sobrevivência e Tempo até Liquidação
**Tooltip:** Estima a probabilidade de liquidação do ativo ao longo do tempo (tempo até liquidação).

### Nós Críticos (>5 cedentes)
**Tooltip:** Número de sacados que possuem conexão com mais de 5 cedentes diferentes, indicando pontos de alta sensibilidade na rede.

### Grau Médio de Conectividade
**Tooltip:** Média de conexões (edges) por empresa no grafo. Valores altos indicam uma carteira mais interdependente e propensa a contágio.

### Eficiência de Back-Office e Liquidação
**Tooltip:** Prazo médio decorrido entre a data de vencimento e a liquidação efetiva do título para ativos que sofreram atraso.

### Clusters de Criticidade Máxima
**Tooltip:** Agrupamento de empresas (clusters) conectadas por relações financeiras. Redes com alta Perda Esperada sinalizam que a quebra de uma entidade pode desencadear inadimplência em cascata no grupo.

---

## 3. PD & Perda Estimada

### Provisão Total — EL Σ(PD × LGD × EAD)
**Tooltip:** Soma total da Perda Esperada (Expected Loss), calculada multiplicando a Probabilidade de Default (PD) pela Perda em caso de Default (LGD) e pela Exposição no momento do Default (EAD).

### PD (Inadimplência) Média da Carteira
**Tooltip:** Média ponderada da Probabilidade de Default de todos os pagadores ativos na carteira.

### Provisão Sugerida (EL + 20% buffer)
**Tooltip:** Valor recomendado para reserva de capital, incluindo a EL total somada a uma margem de segurança (buffer) de 20% para cobrir variações estatísticas.

### EL (Perda Esperada) por Faixa de Score
**Tooltip:** Perda esperada acumulada agrupada por bucket de score_materialidade_v2. Buckets de menor score concentram maior risco individual, porém menor volume de boletos.

### Dispersão — Exposição vs PD (Inadimplência)
**Tooltip:** Cada ponto é um pagador. Quadrante superior-direito = maior exposição E maior PD = Top Risks. Cor: verde=baixo risco, vermelho=crítico.

### Risco por UF — EL (Perda Esperada) por Estado
**Tooltip:** Distribuição geográfica da perda esperada. Estados com alta concentração de boletos de baixo score acumulam maior EL proporcional.

---

## 4. Concentração

### Índice de Granularidade do Portfólio
**Tooltip:** Índice Herfindahl-Hirschman: mede a concentração de mercado. Valores altos indicam dependência excessiva de poucos setores.

### Exposição Crítica por Sacado (VME)
**Tooltip:** Representatividade dos 5 maiores pagadores (sacados) no volume total da carteira.

### Atraso Médio da Carteira
**Tooltip:** Prazo médio de atraso ponderado pelo volume, indicando a pontualidade geral da rede.

### Pareto de Pagadores (Concentração Sacados)
**Tooltip:** Análise de Pareto para identificar dependência de sacados específicos. Idealmente, 80% da carteira deve ser distribuída entre muitos pagadores.

### Pareto de Exposição por Setor (CNAE)
**Tooltip:** Mede o risco de concentração setorial. Diversificação entre setores reduz a vulnerabilidade a crises macroeconômicas específicas.

### Liquidez por Setor (Indicador 1M)
**Tooltip:** Média do índice de liquidez por setor CNAE. Identifica quais setores estão convertendo vendas em caixa com maior rapidez.

### Concentração por UF
**Tooltip:** Volume financeiro total alocado por estado (UF) do pagador. Ajuda a identificar riscos geográficos isolados.

### Concentração de Originação
**Tooltip:** Ranking das entidades com maior volume financeiro alocado na carteira.

---

## 5. Política de Rejeição (Underwriting)

### Matriz de Underwriting e Assertividade
**Tooltip:** Cor = taxa de inadimplência histórica. Células esmaecidas = bloqueadas pela régua de score. Células com borda laranja = zona de risco de contágio (default_rate acima da tolerância configurada).

### Decisão do Motor por Boleto
**Tooltip:** Listagem detalhada das operações processadas. Compara a recomendação original do Motor Nuclea com a nova simulação de política, destacando bloqueios por score ou PD.

### Painel de Simulação de Política
**Tooltip:** Ajuste os parâmetros de risco para simular o comportamento da carteira. A Régua de Score e o Limite de PD definem o filtro de entrada, enquanto a Tolerância de Contágio atua como uma trava de segurança sistêmica.

### Economicidade e Perda Evitada
**Tooltip:** Montante financeiro de Perda Esperada (EL) que deixará de entrar na carteira caso a política simulada seja aplicada. Representa o valor 'salvo' pelo motor de risco.

### Taxa de Aprovação / Aprovação Simulada
**Tooltip:** Percentual de operações que seriam aprovadas sob as condições da política atual. Uma queda nesta taxa geralmente indica um aumento na qualidade média dos ativos selecionados.

### Índice de Seletividade de Ativos / Seletividade Simulada
**Tooltip:** Percentual de operações bloqueadas pelos filtros de Score, PD ou Contágio. Reflete o rigor da política em descartar ativos de alto risco.

### Inadimplência no Corte
**Tooltip:** Taxa histórica de inadimplência dos boletos aprovados pela política simulada. Queda indica política mais restritiva selecionando pagadores melhores.

### Bloqueio por Contágio
**Tooltip:** Ops bloqueadas por alto PageRank (hubs de rede sistêmica). tol=0% = zero tolerância (bloqueia pagerank > p85). tol=30% = permissivo (bloqueia apenas pagerank > p97).

### Impacto do Corte — Receita vs Inadimplência por Parâmetros de Decisão
**Tooltip:** Arraste o slider de Score para ver como a linha vertical se move e quais métricas mudam. O 'sweet spot' fica onde as curvas mais se afastam.

---

## 6. Governança

### PSI (Estabilidade do Modelo)
**Tooltip:** Mede a estabilidade populacional dos dados. Identifica se o comportamento atual das empresas divergiu do padrão de treinamento do modelo, sinalizando a necessidade de calibração ou retreino da IA.

### KS (Poder de Separação)
**Tooltip:** Principal métrica de poder de separação. Quantifica a eficácia do modelo em distinguir entre perfis de bons e maus pagadores, garantindo a precisão na seleção de ativos.

### AUC (Qualidade Global)
**Tooltip:** Representa a qualidade global das previsões. Avalia a performance do modelo em classificar corretamente o risco em diferentes níveis de corte, equilibrando a sensibilidade e a especificidade das decisões.

### Parâmetros de Decisão (Simulador Interativo)
**Tooltip:** Simulador de políticas de crédito. Permite configurar os limites de aprovação automática e revisão manual baseados na probabilidade de default (PD) e exposição financeira total.

### Calibração (Expected vs Observed)
**Tooltip:** Compara a probabilidade de default (PD) prevista pelo modelo com a inadimplência real observada no backtesting. Garante que o modelo não está subestimando nem superestimando o risco real.

### Vigilância Atuarial e Estabilidade (PSI)
**Tooltip:** Trilha de transparência e conformidade. Registra todas as ações humanas e automáticas aplicadas ao modelo e às políticas, assegurando a rastreabilidade exigida por órgãos reguladores.
