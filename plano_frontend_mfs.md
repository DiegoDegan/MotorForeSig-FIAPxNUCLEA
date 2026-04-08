# Plano de Frontend — Motor MFS

## Visão geral

O frontend do Motor MFS deve funcionar como uma camada de consumo decisório para diferentes perfis de stakeholder, traduzindo sinais complexos de risco de crédito, contágio em rede, sobrevivência de recebimento, regras de negócio e saúde do modelo em uma experiência clara, acionável e confiável. [cite:1][cite:2]

A documentação descreve um motor híbrido que combina ingestão macroeconômica, análise em grafos, regras dinâmicas em YAML, modelos preditivos de PD/LGD e interpretabilidade por SHAP; por isso, o frontend precisa ser desenhado como uma aplicação web analítica, e não apenas como um dashboard estático. [cite:1]

## Objetivos do produto

O produto deve permitir que stakeholders executivos entendam a saúde global da carteira, que a Mesa de Crédito opere decisões por boleto com rapidez e que os times de risco e dados monitorem contágio, drift e governança do modelo. [cite:1][cite:2]

Os objetivos funcionais principais são:

- Centralizar a leitura operacional do `pipeline_report_mesacredito` como fonte primária de decisão. [cite:2]
- Exibir risco sistêmico com base nas métricas de rede, centralidade e exposição contaminada. [cite:1][cite:2]
- Mostrar previsões atuariais por meio de curvas de sobrevivência e pontos de aceleração de risco. [cite:2]
- Tornar a decisão explicável por meio de justificativas SHAP e fatores determinantes do score. [cite:1]
- Monitorar saúde do modelo com PSI e políticas dinâmicas de risco em YAML/JSON. [cite:1][cite:2]

## Perfis de usuário

### Diretoria e stakeholder executivo

Esse perfil precisa de leitura rápida, com foco em carteira total, exposição agregada, alertas do dia, concentração por setor, tendência de risco e recomendações sistêmicas. [cite:1][cite:2] A experiência ideal para esse público prioriza KPIs, tendências, comparativos e poucos cliques até a visão executiva.

### Mesa de Crédito

Esse perfil opera no detalhe das transações e precisa priorizar boletos com maior perda esperada, score de PD crítico, justificativas de reprovação e sinais de contaminação por rede. [cite:1][cite:2] A interface deve privilegiar tabela analítica, filtros rápidos, drill-down por operação e ações claras como aprovar, mandar para análise ou bloquear.

### Risco, BI e Data Science

Esse grupo precisa validar coerência analítica do motor, acompanhar drift, entender influência das features, verificar regras de bloqueio e navegar em visões de rede e sobrevivência. [cite:1][cite:2] A interface deve permitir investigação, comparação temporal e rastreabilidade de decisão.

## Arquitetura de informação

A melhor estrutura é organizar o frontend em quatro módulos principais. [cite:1][cite:2]

| Módulo | Objetivo | Fonte principal | Benefício de negócio |
|---|---|---|---|
| Cockpit executivo | Visão consolidada da carteira | `pipeline_report`, políticas, alertas [cite:2] | Acelera leitura estratégica e reportes [cite:2] |
| Mesa de Crédito | Decisão por boleto/operação | `pipeline_report_mesacredito.xlsx` [cite:2] | Prioriza auditoria e ação operacional [cite:2] |
| Risco sistêmico | Leitura de contágio e hubs | `grafo_features_mfs.xlsx` [cite:2] | Identifica efeito dominó e concentração [cite:1][cite:2] |
| Governança do modelo | Drift, PSI e regras | `auditoria_drift.csv`, `politica_risco.yaml` [cite:2] | Sustenta confiança e retreino do modelo [cite:2] |

## Sitemap sugerido

### 1. Cockpit executivo

Tela inicial para consumo de alta gestão, com leitura resumida do estado atual da carteira. [cite:2] Deve responder em segundos às perguntas: “o risco está subindo?”, “onde está a maior exposição?” e “qual ação o sistema recomenda agora?”. [cite:1][cite:2]

**Blocos recomendados**:

- KPIs: carteira total, PD média, perda esperada agregada, alertas do dia, % de aprovação automática. [cite:2]
- Linha temporal: tendência de PD média, EL agregada e volume de operações críticas. [cite:2]
- Setores críticos: CNAEs mais tóxicos, bloqueados ou em deterioração. [cite:1][cite:2]
- Resumo de recomendação: ações sugeridas pelo sistema, com nível de confiança. [cite:1]
- Top exposições: cedentes, sacados ou grupos com maior risco acumulado. [cite:1][cite:2]

### 2. Mesa de Crédito

Tela principal de trabalho para analistas, centrada na fila de decisões. [cite:1][cite:2] O objetivo é reduzir tempo de triagem e elevar consistência na priorização de auditoria manual. [cite:2]

**Blocos recomendados**:

- Tabela principal com filtros por status, risco, cedente, sacado, setor, período e faixa de EL. [cite:2]
- Cards de triagem com contagem por carimbo final, como `[APROVADO_AUTO]`, `[ANALISE_MESA]`, `[REPROVADO_AUTO]` e regras duras de reprovação. [cite:1]
- Painel lateral de detalhe do boleto com score PD, dias previstos de atraso, EL, justificativa SHAP e recomendação. [cite:1][cite:2]
- Timeline de decisão com eventos, alterações de status e operador responsável. [cite:1]

### 3. Risco sistêmico

Tela dedicada à leitura da malha relacional e do contágio. [cite:1] Deve mostrar que o valor do MFS não está apenas no score individual, mas na leitura de rede que identifica hubs e cascatas de risco. [cite:1][cite:2]

**Blocos recomendados**:

- Grafo interativo com nós para cedentes, sacados e conexões relevantes. [cite:1]
- Lista dos maiores hubs por PageRank e valor exposto. [cite:2]
- Painel de concentração por setor/CNAE. [cite:1][cite:2]
- Detalhe por entidade com exposição total, conexões críticas, histórico de atraso e score atual. [cite:1]

### 4. Governança do modelo

Tela orientada à confiabilidade analítica, manutenção e auditoria do motor. [cite:2] Deve ser tratada como área estratégica, não secundária, porque confiança no modelo é parte do produto. [cite:1][cite:2]

**Blocos recomendados**:

- PSI global e PSI por feature. [cite:2]
- Status de drift com faixas normal, atenção e crítico. [cite:2]
- Histórico de políticas de risco em YAML/JSON, incluindo CNAEs banidos e notas de corte. [cite:1][cite:2]
- Sinais de necessidade de retreino ou revisão de regras. [cite:2]

## Gráficos recomendados por módulo

### Cockpit executivo

| Gráfico | Objetivo | Por que faz sentido |
|---|---|---|
| KPI cards com mini sparklines | Mostrar tendência de curto prazo | Facilita leitura executiva de carteira, PD e alertas [cite:2] |
| Área/linha temporal | Exibir evolução de PD média, EL e operações críticas | Permite detectar piora sistêmica ao longo do tempo [cite:2] |
| Barras horizontais por CNAE | Destacar setores críticos | Conecta política macroprudencial e toxicidade setorial [cite:1][cite:2] |
| Treemap de exposição | Visualizar concentração por grupo, setor ou cedente | Ajuda a comunicar onde está o risco financeiro acumulado [cite:1][cite:2] |

### Mesa de Crédito

| Gráfico ou componente | Objetivo | Uso recomendado |
|---|---|---|
| Histograma de score por volume | Distribuição de risco | Já é sugerido explicitamente no guia e ajuda a localizar bolsões de risco com peso financeiro [cite:2] |
| Scatter plot `score_pd x perda_esperada_el` | Priorizar operações | Útil para enxergar boletos muito perigosos e muito caros ao mesmo tempo [cite:2] |
| Barras empilhadas por status final | Acompanhar funil decisório | Mostra a composição entre aprovações, análises manuais e reprovações [cite:1] |
| Waterfall ou barras divergentes de SHAP | Explicar decisão | Traduz o racional da IA em linguagem operacional [cite:1] |
| Tabela analítica | Operação diária | Deve ser o componente central dessa tela [cite:2] |

### Risco sistêmico

| Gráfico | Objetivo | Uso recomendado |
|---|---|---|
| Grafo interativo | Visualizar contágio e conectividade | É o principal diferencial do motor MFS [cite:1] |
| Bubble chart `PageRank x Volume x Risco` | Encontrar hubs perigosos | Complementa o grafo com leitura comparável e priorizável [cite:2] |
| Heatmap setor x risco | Encontrar padrões de concentração | Ajuda a identificar agrupamentos de toxicidade e exposição [cite:1][cite:2] |
| Sankey de fluxo entre grupos | Mostrar circulação de risco | Útil para storytelling executivo em apresentações [cite:1] |

### Governança do modelo

| Gráfico | Objetivo | Uso recomendado |
|---|---|---|
| Gauge de PSI global | Sinal rápido de estabilidade | Já recomendado no guia, útil para visão instantânea [cite:2] |
| Barras por feature com thresholds | Diagnóstico detalhado | Mostra quais variáveis estão puxando o drift [cite:2] |
| Linha temporal de PSI | Acompanhar deterioração | Melhor do que olhar só o estado atual [cite:2] |
| Tabela de políticas e versionamento | Governança operacional | Essencial para auditoria e rastreabilidade [cite:1][cite:2] |

## Proposta de wireframe textual

### Home / Cockpit

A página inicial deve ser composta por uma barra superior com filtros globais, KPIs em primeira linha, gráfico temporal no centro, painel de setores críticos à esquerda e painel de recomendação do sistema à direita. [cite:1][cite:2] Abaixo, deve existir uma grade com top exposições, operações críticas recentes e um resumo da rede de risco. [cite:1][cite:2]

Estrutura sugerida:

1. Header com logo, período, filtros e busca.
2. Linha de KPIs.
3. Painel principal dividido em tendência temporal e recomendação do sistema.
4. Linha secundária com setores críticos, top exposições e distribuição de score. [cite:2]

### Mesa de Crédito

Essa tela deve priorizar eficiência operacional. [cite:2] A tabela deve ocupar o centro da tela, com filtros em toolbar superior e um drawer lateral abrindo os detalhes da operação selecionada. [cite:1][cite:2]

Estrutura sugerida:

1. Toolbar com filtros e chips ativos.
2. Cards rápidos por carimbo final.
3. Tabela principal.
4. Drawer com score, EL, previsão de atraso, fatores SHAP e ação recomendada. [cite:1]

### Risco sistêmico

A tela deve ser dividida em duas áreas: grafo e inteligência contextual. [cite:1] O usuário clica em um nó e recebe, em um painel lateral, a leitura completa da entidade e seus vínculos críticos. [cite:1][cite:2]

Estrutura sugerida:

1. Filtros por tipo de entidade, setor e período.
2. Grafo principal com zoom e destaque de conexões críticas.
3. Sidebar com métricas da entidade selecionada.
4. Área inferior com bubble chart, heatmap e ranking de hubs. [cite:2]

### Governança

A tela deve ter leitura técnica, mas permanecer visualmente simples. [cite:2] O ideal é abrir com PSI global e status do modelo, seguido de análise por feature e política vigente. [cite:1][cite:2]

Estrutura sugerida:

1. Cards de status do modelo.
2. Gauge global + linha temporal de PSI.
3. Barras por feature.
4. Tabela de políticas, thresholds e histórico recente. [cite:2]

## Recomendação de stack

Como já existe um protótipo em TypeScript, a melhor evolução é manter o ecossistema em React + TypeScript para preservar consistência, produtividade e reutilização de componentes. [image:1]

### Stack sugerida

| Camada | Tecnologia | Motivo |
|---|---|---|
| Framework | React + TypeScript | Continuidade do protótipo e tipagem forte para domínio analítico |
| Build | Vite ou Next.js App Router | Boa performance e DX para web app analítico |
| UI | Tailwind CSS + shadcn/ui ou componentes proprietários | Velocidade com boa base visual para dashboard |
| Gráficos tradicionais | Recharts ou ECharts | Bom equilíbrio entre produtividade e flexibilidade |
| Grafo de rede | Cytoscape.js ou React Flow | Melhor aderência à visualização relacional do MFS |
| Tabelas | TanStack Table | Filtros, ordenação e performance para Mesa de Crédito |
| Estado assíncrono | React Query | Cache, loading, invalidação e polling de dashboards |
| Estado local/global | Zustand | Simples para filtros e UI state compartilhado |
| Design system | Tokens próprios | Escalabilidade visual e consistência do produto |

## Arquitetura de frontend

A aplicação deve ser modularizada por domínio, e não apenas por tipo de componente. Isso reduz acoplamento entre telas e facilita evolução futura. [cite:1][cite:2]

Estrutura sugerida:

```txt
src/
  app/
  modules/
    cockpit/
    mesa-credito/
    risco-sistemico/
    governanca/
  components/
    charts/
    tables/
    cards/
    filters/
    drawers/
  services/
    api/
    adapters/
  store/
  hooks/
  types/
```

### Padrão por domínio

Cada módulo deve conter:

- `services`: consumo dos endpoints.
- `adapters`: transformação de payload para formato visual.
- `hooks`: lógica de consulta e estado.
- `components`: blocos específicos do domínio.
- `pages` ou `views`: composição final da tela.

Esse padrão é adequado porque os documentos mostram áreas de negócio bem separadas: operação, rede, sobrevivência e governança. [cite:1][cite:2]

## Modelo de dados para a UI

Os endpoints do backend podem ser pensados em recursos específicos por domínio, alinhados à arquitetura descrita na documentação, que já menciona FastAPI, endpoints REST e exposição segura do motor. [cite:1]

### Endpoints sugeridos

- `GET /portfolio/summary`
- `GET /portfolio/timeseries`
- `GET /credit/pipeline`
- `GET /credit/operation/:id`
- `GET /risk/network`
- `GET /risk/entity/:id`
- `GET /survival/curve`
- `GET /model/drift`
- `GET /model/features`
- `GET /policies/current`
- `GET /policies/history`

### Contratos importantes para a UI

A interface precisa, no mínimo, destes grupos de campos:

- Identificação da operação: boleto, cedente, sacado, setor, data, valor.
- Decisão: score PD, EL, status final, recomendação, confiança. [cite:1][cite:2]
- Explicabilidade: fatores SHAP, contribuições positivas e negativas, texto de justificativa. [cite:1]
- Rede: PageRank, grau, valor exposto, conexões críticas. [cite:1][cite:2]
- Governança: PSI global, PSI por feature, política ativa, thresholds. [cite:2]

## Design system e UX

O protótipo já sinaliza um posicionamento visual de “centro de comando”, com estética escura, contraste neon controlado, score hub e alerta de risco. [image:1] Essa linguagem pode ser mantida, desde que o produto não dependa apenas do impacto visual e preserve legibilidade, hierarquia e densidade informacional equilibrada.

### Diretrizes visuais

- Tema dark como padrão, com modo claro opcional.
- Grid denso, porém respirável, com cards e painéis bem delimitados.
- Uso de verde, amarelo e vermelho como semântica de risco, evitando excesso de cores competitivas.
- Tipografia de alta legibilidade para uso contínuo.
- Ícones apenas como reforço, nunca como elemento principal de entendimento.

### Boas práticas de UX

- Uma ação principal por contexto: aprovar, analisar ou bloquear. [cite:1]
- Drill-down consistente: do agregado para a operação individual. [cite:1][cite:2]
- Filtros persistentes por período, entidade e nível de risco.
- Tooltips explicativos para PageRank, PSI, EL e SHAP.
- Estados vazios e mensagens de erro tratados como partes do produto, não como fallback técnico.

## Roadmap de implementação

### Fase 1 — Fundamentos

Objetivo: construir base técnica e design system.

- Definir arquitetura do projeto.
- Criar tokens visuais e componentes base.
- Implementar layout shell, autenticação e filtros globais.
- Conectar dados mockados ou contratos iniciais da API.

### Fase 2 — Cockpit e Mesa de Crédito

Objetivo: entregar valor operacional imediato. [cite:2]

- Implementar KPIs, tendências e visão executiva.
- Construir tabela da Mesa de Crédito.
- Criar drawer de detalhe com justificativa SHAP. [cite:1]
- Adicionar filtros avançados e ordenação por risco e EL. [cite:2]

### Fase 3 — Risco sistêmico

Objetivo: ativar o diferencial competitivo do produto. [cite:1]

- Integrar visualização de grafo.
- Criar ranking de hubs e bubble chart.
- Adicionar drill-down por entidade.
- Conectar concentração por setor e exposição contaminada. [cite:1][cite:2]

### Fase 4 — Governança do modelo

Objetivo: sustentar confiança, manutenção e auditoria. [cite:2]

- Implementar painel de PSI global e por feature.
- Exibir políticas vigentes e histórico de mudanças.
- Criar alertas de necessidade de retreino. [cite:2]
- Adicionar relatórios exportáveis para diretoria e times técnicos.

## Priorização de entregas

| Prioridade | Entrega | Impacto |
|---|---|---|
| Alta | Cockpit executivo | Valor imediato para stakeholder e narrativa do produto [cite:2] |
| Alta | Mesa de Crédito | Uso operacional diário e ganho real de produtividade [cite:2] |
| Média | Painel de explicabilidade | Aumenta confiança na decisão da IA [cite:1] |
| Média | Risco sistêmico em grafo | Reforça diferencial competitivo do MFS [cite:1] |
| Média | Curvas de sobrevivência | Ajuda cobrança e previsão atuarial [cite:2] |
| Alta | Governança de drift e políticas | Essencial para confiabilidade contínua [cite:2] |

## Indicadores de sucesso

O frontend deve ser medido por resultado de negócio e eficiência analítica. [cite:1][cite:2]

KPIs sugeridos para produto:

- Tempo médio para triagem de operação.
- Percentual de casos resolvidos sem navegação extra.
- Tempo para localizar exposições críticas.
- Taxa de uso do painel de explicabilidade.
- Tempo para identificar drift crítico.
- Acurácia percebida e confiança dos analistas na recomendação do sistema. [cite:1][cite:2]

## Riscos de projeto

Os principais riscos de implementação são excesso de complexidade visual, sobrecarga do grafo na tela principal, baixa clareza na explicabilidade e falta de alinhamento entre payloads do backend e necessidades analíticas do frontend. [cite:1][cite:2]

Para mitigar isso:

- Separar claramente visão executiva e visão operacional.
- Tratar o grafo como módulo próprio, não como ornamento. [cite:1]
- Padronizar contratos de dados desde o início.
- Fazer prototipação com cenários reais da Mesa de Crédito. [cite:2]
- Garantir acessibilidade e legibilidade em uso prolongado.

## Próximos passos recomendados

1. Validar este plano com os stakeholders e definir quais telas entram no MVP. [cite:2]
2. Mapear o contrato real dos arquivos atuais para endpoints ou BFF. [cite:1][cite:2]
3. Transformar o protótipo TypeScript em design system e biblioteca inicial de componentes. [image:1]
4. Construir primeiro o Cockpit e a Mesa de Crédito, pois concentram maior valor imediato. [cite:2]
5. Evoluir para risco sistêmico e governança como segunda onda de maturidade. [cite:1][cite:2]
