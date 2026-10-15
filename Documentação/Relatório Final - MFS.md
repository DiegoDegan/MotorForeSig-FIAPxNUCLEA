# RELATÓRIO TÉCNICO E EXECUTIVO: MOTOR FORESIG (MFS)

## Esteira Preditiva de Risco de Crédito para FIDC

\---

## 1\. Sumário Executivo \& Visão Geral do Produto

### 

### 1.1. O Que É o Motor ForeSig (MFS)?

O **Motor ForeSig (MFS)** é uma esteira preditiva de inteligência de crédito desenvolvida especificamente para a esteira operacional de **Fundos de Investimento em Direitos Creditórios (FIDCs)** e registradoras financeiras (como a **Núclea**).

Sua finalidade primária é avaliar o risco de inadimplência (default) e o prazo provável de liquidação de duplicatas/boletos bancários **antes** que eles sejam comprados e antecipados pelo fundo.

### 

### 1.2. O Problema de Negócio que o MFS Resolve

No mercado tradicional de antecipação de recebíveis, a análise de crédito é historicamente:

1. **Estática e Isolada:** Birôs tradicionais de crédito analisam o CNPJ do sacado (quem paga) ou do cedente (quem vende a duplicata) de forma individualizada, desconectada da malha comercial ao seu redor.
2. **Cega ao Risco de Contágio Sistêmico:** Se um grande fornecedor depende criticamente de clientes que estão quebrando, a análise tradicional do fornecedor parece saudável até o instante em que ele se torna insolvente por efeito cascata.
3. **Uma "Caixa-Preta" Inflexível:** Modelos de Machine Learning puros costumam gerar uma probabilidade matemática fria (ex: 0.63), sem oferecer à Mesa de Crédito o racional de negócio que justifique o veto regulatório ou a exigência de garantias adicionais.

### 

### 1.3. A Proposta de Valor do MFS

O MFS substitui a esteira convencional por um **Motor Preditivo Híbrido** apoiado em um tripé inovador:

* **Ciência de Redes (Grafos no Neo4j com GDS / NetworkX):** Modela as transações comerciais como uma teia interligada, capturando centralidade (PageRank), concentração de clientes e contágio financeiro reverso.
* **Modelagem Preditiva Dual (Random Forest):** Classifica a Probabilidade de Default (PD) e projeta quantitativamente os dias de atraso esperados na liquidação do título.
* **Governança Ativa com XAI (Explainable AI via SHAP):** Converte a complexidade matemática do modelo em pareceres textuais auditáveis e claros para os analistas de risco (ex.: *"Score penalizado devido à exposição severa a sacados tóxicos e baixa liquidez setorial"*).

\---

## 2\. O Racional Tecnológico: Por Que Escolhemos Cada Ferramenta?

A escolha de cada componente na arquitetura do MFS responde a critérios rigorosos de escalabilidade, resiliência operacional, explicabilidade e custo.

```
┌───────────────────────────────────────────────────────────────────────────┐
│                      ECOSSISTEMA TECNOLÓGICO MFS                          │
├─────────────────────┬─────────────────────────────────────────────────────┤
│ Componente          │ Papel Estratégico \\\& Justificativa Técnica           │
├─────────────────────┼─────────────────────────────────────────────────────┤
│ Neo4j 5 + GDS       │ Banco de Grafos Corporativo \\\& Algoritmos de Rede    │
├─────────────────────┼─────────────────────────────────────────────────────┤
│ Docker              │ Containerização, Isolamento \\\& Padronização DevOps   │
├─────────────────────┼─────────────────────────────────────────────────────┤
│ NetworkX            │ Motor In-Memory de Alta Disponibilidade (Fallback)  │
├─────────────────────┼─────────────────────────────────────────────────────┤
│ Random Forest (ML)  │ Robustez a Outliers, Não-Linearidade \\\& Dual Output  │
├─────────────────────┼─────────────────────────────────────────────────────┤
│ SHAP (XAI)          │ Explicabilidade Regulatória \\\& Transparência da IA   │
├─────────────────────┼─────────────────────────────────────────────────────┤
│ FastAPI (Python)    │ API de Alta Performance em RAM (Padrão Lifespan)    │
├─────────────────────┼─────────────────────────────────────────────────────┤
│ React 19 + Tailwind │ Dashboard Executivo Modularizado para Mesa \\\& Gestão │
└─────────────────────┴─────────────────────────────────────────────────────┘
```

### 2.1. Por Que Neo4j e Graph Data Science (GDS)?

* **O Limite do SQL/Relacional:** Para descobrir se o pagador de uma duplicata deve para outras empresas que estão quebrando a 3 ou 4 graus de distância, um banco relacional precisaria de dezenas de `JOINs` pesados e recursivos, degradando o tempo de resposta.
* **Topologia Nativa:** No Neo4j, as relações são tratadas como entidades de primeira classe com ponteiros de memória diretos (*index-free adjacency*).
* **O Plugin GDS (Graph Data Science):** Permite projetar subgrafos em memória RAM e executar algoritmos de grafos distribuídos, tais como **PageRank** (identificação de hubs de liquidez e nós de alta relevância transacional) e **Degree Centrality** (grau de interdependência).
* **Investigação Ad-Hoc:** Permite que analistas realizem consultas forenses em linguagem Cypher para flagrar operações circulares (fraude de troca de duplicatas).

### 2.2. Por Que Docker para Executar o Neo4j?

* **Isolamento de Ambiente:** Evita a necessidade de instalar manualmente o Neo4j Desktop, Java SDK ou bibliotecas pesadas no sistema operacional do desenvolvedor.
* **Gestão Automatizada de Plugins:** O container oficial baixa e ativa o plugin do GDS diretamente na subida (`NEO4J\\\_PLUGINS='\\\["graph-data-science"]'`).
* **Cloud Ready:** O mesmo container que roda na máquina local pode ser provisionado no Google Cloud Platform (GCP) com paridade total de configuração.

### 2.3. Por Que a Solução Híbrida com Fallback em NetworkX? (Lição Real de Engenharia / FinOps)

* **O Cenário Real:** Durante o desenvolvimento, o plano gratuito do Neo4j em nuvem (AuraDB Free) demonstrou não dar suporte ao plugin GDS (restrito a planos pagos de grande porte).
* **A Resposta de Arquitetura:** Em vez de paralisar a esteira ou incorrer em custos prematuros de nuvem, implementamos uma **Arquitetura de Alta Resiliência**:

  1. O pipeline tenta conectar ao **Neo4j GDS** para aproveitar a computação corporativa de grafos.
  2. Se o cluster de banco estiver offline ou sem suporte ao GDS, um fallback nativo em **NetworkX** entra em ação automaticamente, recalculando o PageRank, o grau e o contágio reverso localmente em memória RAM a partir dos dados limpos.
* **Benefício:** A aplicação nunca falha e a Mesa de Crédito nunca fica sem análise de risco.

### 2.4. Por Que Random Forest (Classificador e Regressor)?

* **Robustez a Dados Tabulares:** Em dados transacionais financeiros, modelos baseados em árvores superam redes neurais profundas em velocidade de convergência e estabilidade estatística.
* **Manejo de Desbalanceamento:** Utilizando `class\\\_weight='balanced'`, o algoritmo penaliza severamente o erro em operações de default (que representam cerca de 6% da base), garantindo alta sensibilidade aos maus pagadores sem perder a calibração dos bons.
* **Previsão Dual:**

  1. **RandomForestClassifier:** Produz a Probabilidade de Default ($PD \\in \[0, 1]$).
  2. **RandomForestRegressor:** Estima o número contínuo de dias de atraso esperados na liquidação.

### 2.5. Por Que SHAP (SHapley Additive exPlanations)?

* **Fundamentação Matemática:** Baseado na Teoria dos Jogos Cooperativos de Lloyd Shapley (Prêmio Nobel), calcula a contribuição marginal de cada feature para a decisão final.
* **Fim da Caixa-Preta:** Regulamentações bancárias e de mercado de capitais (BACEN/CVM/LGPD) proíbem recusas de crédito sem justificativa objetiva. O SHAP traduz as variáveis mais influentes em justificativas claras de negócio.

### 2.6. Por Que FastAPI com Padrão Lifespan?

* **Latência Sub-segundo:** Em vez de abrir arquivos de disco ou consultar modelos a cada requisição HTTP, o FastAPI utiliza o gerenciador assíncrono `lifespan` para carregar todos os modelos `.joblib`, a base de relatórios e o grafo NetworkX **uma única vez na inicialização da aplicação**.
* **Segurança Integrada:** Endpoints protegidos por tokens criptográficos OAuth2/JWT.

\---

## 3\. Arquitetura e Fluxo de Dados de Ponta a Ponta

A esteira opera em um fluxo sequencial e determinístico, orquestrado centralmente pelo script `backend/run\\\_pipeline.py`.

```
  \\\[data/raw/]  (base\\\_boletos\\\_fiap.csv + base\\\_auxiliar\\\_fiap.csv)
       │
       ▼
  1. LIMPEZA \\\& HIGIENIZAÇÃO (limpeza.py)
       │ • Converte tipos e ajusta campos temporais
       │ • Cria target de default (dias\\\_atraso > 60)
       │ • Imputa métricas da base cadastral
       ▼
  2. ENGENHARIA DE REDES (extrair\\\_metricas\\\_grafo.py)
       │ • Projeta grafo transacional: Pagador ➔ Beneficiário
       │ • Executa PageRank \\\& Degree Centrality (Neo4j GDS com fallback NetworkX)
       │ • Calcula Exposição de Contágio Reverso do Cedente
       ▼
  3. FUSÃO DA BASE DE MODELAGEM (montar\\\_base\\\_modelagem.py)
       │ • Faz o merge 1:1 por id\\\_boleto (Transações + Cadastral + Grafo)
       │ • Consolida base\\\_modelagem.csv
       ├───▶ 4. POLÍTICAS MACROPRUDENCIAIS DINÂMICAS (atualizar\\\_politicas\\\_dinamicas.py)
       │         • Audita defaults por CNAE e Cedente
       │         • Sobrescreve backend/config/politica\\\_risco.yaml
       ├───▶ 5. TREINAMENTO DE MACHINE LEARNING (model\\\_trainer.py)
       │         • Treina Random Forest (PD) e Random Forest (Atraso)
       │         • Loga métricas (AUC, KS, PSI) no Weights \\\& Biases
       │         • Salva artefatos serializados (.joblib)
       ▼
  6. PIPELINE OPERACIONAL \\\& EXPLICABILIDADE (pipeline\\\_operacional.py)
       │ • Aplica modelos em toda a base ativa
       │ • Executa SHAP TreeExplainer
       │ • Carimba decisões (APROVADO\\\_AUTO, ANALISE\\\_MESA, REPROVADO\\\_\\\*)
       │ • Salva pipeline\\\_report\\\_mesacredito.csv
       ▼
  7. API REST \\\& RUNTIME (main\\\_rest\\\_api.py - FastAPI)
       │ • Carrega ativos na memória RAM (lifespan)
       │ • Provê 14 rotas seguras (JWT)
       ▼
  8. COCKPIT EXECUTIVO \\\& FRONTEND (React 19 + Vite)
       • Visão Geral, Risco de Rede, PD \\\& Perda, Concentração, Mesa de Crédito, Governança
```

\---

## 4\. O Motor de Decisão de Crédito (Cascata Hierárquica de Regras)

A decisão de concessão de crédito do MFS não é delegada unicamente ao modelo de Machine Learning. Ela segue uma **Cascata de Governança Híbrida**, onde regras macroprudenciais duras (*Hard Rules*) prevalecem sobre as notas da inteligência artificial:

```
                      \\\[BOLETO EM ANÁLISE]
                               │
               CNAE está na lista de Bloqueio (Tier 1)?
                     ├── SIM ──▶ \\\[REPROVADO\\\_SETORES\\\_CRITICOS]
                     └── NÃO
                          │
               Cedente está na lista de Fornecedores Tóxicos?
                     ├── SIM ──▶ \\\[REPROVADO\\\_CEDENTE\\\_TOXICO]
                     └── NÃO
                          │
               Score PD >= 0.70?
                     ├── SIM ──▶ \\\[REPROVADO\\\_AUTO]
                     └── NÃO
                          │
               Score PD >= 0.40  OU  Atraso Previsto > 30d  OU  CNAE Tier 2?
                     ├── SIM ──▶ \\\[ANALISE\\\_MESA] (Decisão Humana + Parecer SHAP)
                     └── NÃO
                          │
               Score PD < 0.15  E  Atraso Previsto < 15d?
                     ├── SIM ──▶ \\\[APROVADO\\\_AUTO]
                     └── NÃO ──▶ \\\[ANALISE\\\_MESA]
```

### Detalhamento das Faixas de Decisão:

1. **Regra 1: Bloqueio Setorial (Tier 1 Macroprudencial):** Setores inteiros da economia cujo índice de inadimplência histórico na carteira supera 50% são sumariamente vetados (`REPROVADO\\\_SETORES\\\_CRITICOS`), mitigando risco sistêmico setorial.
2. **Regra 2: Bloqueio de Cedente Tóxico:** Fornecedores reincidentes com taxa de default acima de 30% têm a cessão de recebíveis bloqueada (`REPROVADO\\\_CEDENTE\\\_TOXICO`).
3. **Regra 3: Reprovação Preditiva Direta:** Títulos cuja probabilidade de default é igual ou superior a 70% são reprovados sem necessidade de esforço operacional humano (`REPROVADO\\\_AUTO`).
4. **Regra 4: Encaminhamento para a Mesa de Crédito:** Casos de risco moderado (PD entre 40% e 70%), prazos de atraso projetados superiores a 30 dias ou setores em estado de alerta (Tier 2) são direcionados para os analistas humanos com o parecer do SHAP já transcrito (`ANALISE\\\_MESA`).
5. **Regra 5: Aprovação Automática:** Operações de altíssima convicção (PD inferior a 15% e previsão de liquidação tempestiva) são aprovadas de forma instantânea (*straight-through processing*).

\---

## 5\. Formulação Matemática e Métricas de Crédito

Para responder com solidez a qualquer questionamento de risco quantitativo, domine os conceitos abaixo:

### 5.1. Perda Esperada (Expected Loss - EL)

Calculada pela fórmula padrão de Basileia:
$$EL = PD \\times EAD \\times LGD$$

* **$PD$ (Probability of Default):** A probabilidade predita pelo modelo Random Forest de que o título atrase mais de 60 dias.
* **$EAD$ (Exposure at Default):** O valor nominal em aberto do boleto no momento da análise ($VlrNominal$).
* **$LGD$ (Loss Given Default):** A perda em caso de inadimplência, calculada no MFS a partir do histórico de recuperação:
$$LGD = \\max\\left(0, 1 - \\frac{VlrBaixa}{VlrNominal}\\right) \\quad \\text{(média balizada em 45%)}$$

### 5.2. Métrica de Desempenho do Modelo: AUC-ROC

* **O Que Mede:** A área sob a curva de sensibilidade versus falsos positivos. Indica a capacidade do modelo de ordenar corretamente bons e maus pagadores.
* **Resultado Obtido no Treinamento:** **AUC = 0.995** (capacidade de discriminação próxima da perfeição na base histórica).

### 5.3. Métrica de Separação de Risco: Estatística KS (Kolmogorov-Smirnov)

* **O Que Mede:** A distância vertical máxima entre a curva acumulada de inadimplentes e a curva acumulada de adimplentes.
* **Resultado Obtido:** **KS = 0.948**. Em modelos de crédito convencionais, valores acima de 0.40 já são considerados excelentes. Um KS de 0.94 demonstra separação limpa das populações de risco.

### 5.4. Estabilidade Populacional e Monitoramento de Drift: Índice PSI

* **O Que Mede:** O *Population Stability Index* compara a distribuição das variáveis na base histórica de treinamento versus os dados atuais em produção.
$$PSI = \\sum \\left( %Actual - %Expected \\right) \\times \\ln\\left( \\frac{%Actual}{%Expected} \\right)$$
* **Régua de Interpretação:**

  * $PSI < 0.10$: Distribuição **Estável** (sem necessidade de ação).
  * $0.10 \\le PSI < 0.25$: **Alerta Moderado** (acompanhar evolução).
  * $PSI \\ge 0.25$: **Drift Crítico** (necessidade mandatória de retreinar os modelos).
* **Resultado Obtido:** **PSI = 0.0014**, confirmando estabilidade populacional rigorosa.

### 5.5. Análise de Sobrevivência (Estimador de Kaplan-Meier)

* **O Que Responde:** *"Dado que um boleto já completou $t$ dias de atraso, qual é a probabilidade dele ainda ser liquidado ao invés de se transformar em calote definitivo?"*
* **Aplicação no FIDC:** Permite desenhar a curva ideal de cobrança. Se a curva de sobrevivência despenca vertiginosamente a partir do 15º dia de atraso, a mesa de cobrança deve intensificar a renegociação preventiva antes de D+15.

### 5.6. Índice HHI (Herfindahl-Hirschman) de Concentração Setorial

* **O Que Mede:** A concentração de risco da carteira em determinados setores econômicos (CNAE).
$$HHI = \\sum\_{i=1}^{n} s\_i^2 \\quad \\text{onde } s\_i \\text{ é o percentual do setor na carteira}$$
* **Aplicação:** Garante que o fundo não ultrapasse limites prudenciais em um único segmento (ex.: concentrado excessivamente em Indústria ou Comércio Atacadista).

\---

## 6\. O Papel do Grafo e os Insights da Estrutura de Redes

A topologia do grafo modela a realidade comercial da carteira:

* **Nós (Vértices):** Empresas ($4.612$ entidades).

  * **$1.158$ Beneficiárias:** Cedentes que antecipam os recebíveis.
  * **$3.454$ Pagadoras:** Sacadas que efetuam os pagamentos dos boletos.
  * **$102$ Empresas Híbridas:** Atuam simultaneamente como pagadoras em algumas operações e beneficiárias em outras.
* **Arestas (Relacionamentos `PAGOU\\\_PARA`):** As transações financeiras individuais ($7.118$ operações), contendo atributos de valor, vencimento, data de liquidação e atraso.

### Três Fenômenos Identificados na Rede:

1. **O Efeito Dominó (Cadeias Longas):** Existem **13.877 caminhos de 3 pontas** ($A \\rightarrow B \\rightarrow C$) e **mais de 2,6 milhões de caminhos de 4 pontas** ($A \\rightarrow B \\rightarrow C \\rightarrow D$). Isso comprova que o fluxo de caixa de uma empresa intermediária depende diretamente do adimplemento dos seus próprios clientes para honrar suas obrigações com os fornecedores da ponta.
2. **Ciclos Bilaterais ($A \\leftrightarrow B$):** Identificamos **34 empresas** com emissões de boletos em mão dupla. Essa detecção automática alerta a Mesa de Crédito para possíveis duplicatas simuladas ou manobras de rolagem de dívida.
3. **Contágio Reverso:** Mede a proporção do faturamento de um cedente que provém de pagadores com histórico de atraso recorrente. Se o cedente depende de sacados podres, seu score é preventivamente rebaixado antes da quebra.

\---

## 7\. Guia de Telas do Dashboard Executivo (Frontend React)

O Frontend foi desenvolvido em **React 19 com Tailwind CSS**, estruturado em 6 telas acessíveis no topo da navegação:

|Aba|Nome da Tela|Finalidade Executiva \& Destaques|
|-|-|-|
|**1**|**Visão Geral (Cockpit)**|Painel macro do portfólio. Exibe o Volume Máximo Exposto (VME), Ticket Médio, taxa de inadimplência real D+1, distribuição de exposição por setor (CNAE), HHI e Pareto dos maiores pagadores.|
|**2**|**Risco de Rede**|Grafo dinâmico interativo (`react-force-graph-2d`). Permite arrastar os nós, identificar hubs críticos (>5 conexões), clusters de contágio e analisar a curva de tempo até liquidação.|
|**3**|**PD \& Perda Estimada**|Visão quantitativa de risco. Apresenta o somatório da Provisão Total ($EL$), dispersão de probabilidade de default, regressão de dias de atraso e matriz de risco por faixa.|
|**4**|**Concentração**|Monitoramento de conformidade com os regulamentos do FIDC. Rastreia o enquadramento de limites por cedente e sacado individual, evitando exposição excessiva a um único grupo econômico.|
|**5**|**Política de Rejeição (Mesa)**|A esteira viva de crédito. Fila de boletos com os vereditos da IA, indicadores de liquidez, pareceres textuais do SHAP e botões interativos para a mesa humana **Aprovar** ou **Bloquear** o título.|
|**6**|**Governança \& MLOps**|Painel de auditoria do modelo. Apresenta a curva ROC (AUC), teste de separação KS, velocímetro de estabilidade populacional (PSI), curva de sobrevivência Kaplan-Meier e log de auditoria.|

\---

## 8\. Guia de Respostas para Perguntas Difíceis da Banca

Utilize este roteiro estratégico para responder a perguntas técnicas ou conceituais dos avaliadores:

### P1: "Por que usar grafos se vocês já têm dados tabulares dos boletos?"

> \\\*\\\*Resposta:\\\*\\\*  
> \\\*"Dados tabulares enxergam apenas uma transação pontual entre a Empresa A e a Empresa B. O grafo enxerga o ecossistema completo. Com métricas de PageRank e Contágio Reverso, conseguimos detectar se a Empresa B depende de uma teia de sacados problemáticos a 2 ou 3 saltos de distância. Isso nos permite antecipar o risco de insolvência antes que o primeiro boleto atrase, o que é invisível em uma análise tabular tradicional."\\\*

\---

### P2: "O modelo de Machine Learning não é uma caixa-preta perigosa para aprovar crédito?"

> \\\*\\\*Resposta:\\\*\\\*  
> \\\*"Não, por dois motivos de governança: Primeiro, adotamos uma arquitetura híbrida onde regras macroprudenciais duras (como bloqueio de setores críticos e cedentes tóxicos) têm precedência sobre a IA. Segundo, implementamos IA Explicável via SHAP TreeExplainer. Para cada boleto avaliado, o motor calcula a contribuição marginal exata de cada variável e traduz em um parecer legível para o operador da mesa, atendendo a todos os requisitos de auditoria e transparência do BACEN e da LGPD."\\\*

\---

### P3: "Por que escolher Random Forest em vez de Deep Learning ou XGBoost?"

> \\\*\\\*Resposta:\\\*\\\*  
> \\\*"Em dados tabulares transacionais com forte desbalanceamento de classes, o Random Forest oferece um equilíbrio perfeito entre velocidade de treinamento, estabilidade de fronteira e ausência de overfitting em bases moderadas. Além disso, a sua integração nativa com o SHAP TreeExplainer é matematicamente exata e computacionalmente muito mais rápida do que algoritmos agnósticos (como KernelExplainer), permitindo gerar explicações em tempo real com latência mínima."\\\*

\---

### P4: "Qual é o papel do Neo4j em produção versus o fallback de NetworkX?"

> \\\*\\\*Resposta:\\\*\\\*  
> \\\*"Trata-se de uma decisão de Arquitetura de Software voltada para tolerância a falhas e FinOps. O Neo4j com o Graph Data Science (GDS) é a infraestrutura corporativa desenhada para suportar milhões de duplicatas distribuídas na nuvem com ACID e consultas ad-hoc em Cypher. Já o NetworkX atua como uma camada de alta disponibilidade (fallback operacional local). Se o cluster de banco sofrer qualquer interrupção, o pipeline recalcula todas as métricas em memória RAM determinísticamente, garantindo que a esteira de crédito nunca pare."\\\*

\---

### P5: "Como o sistema garante que o modelo de IA não fique desatualizado ao longo do tempo?"

> \\\*\\\*Resposta:\\\*\\\*  
> \\\*"Através da nossa camada de Governança e MLOps. O sistema monitora continuamente o índice PSI (Population Stability Index) das variáveis preditivas. Caso ocorra uma alteração no comportamento do mercado e o PSI ultrapasse o limiar prudencial de 0.25 (Data Drift), um gatilho de retreino é acionado automaticamente, orquestrando um novo ciclo do pipeline e atualizando as políticas macroprudenciais dinâmicas no arquivo de configuração sem necessidade de alterar o código-fonte."\\\*

\---

## 9\. Mapa do Repositório \& Estrutura de Arquivos

```
├── backend/
│   ├── main\\\_rest\\\_api.py              # Servidor FastAPI com 14 rotas e modelos em RAM (lifespan)
│   ├── run\\\_pipeline.py               # Orquestrador Master do pipeline de dados (end-to-end)
│   ├── config/
│   │   ├── settings.py               # Configurações Pydantic centralizadas (.env)
│   │   ├── logging\\\_config.py         # Padronização de logs da aplicação
│   │   └── politica\\\_risco.yaml       # Regras duras de corte, limites de PD e listas de CNAE/Cedentes
│   ├── core/
│   │   ├── model\\\_trainer.py          # Treinamento dos modelos Random Forest (PD e Atraso)
│   │   ├── explicabilidade.py        # Tradutor de valores SHAP para linguagem humana de negócios
│   │   └── gcs\\\_manager.py            # Sincronização stateless com o Google Cloud Storage
│   ├── models/                       # Modelos serializados salvos (.joblib)
│   └── scripts/
│       ├── limpeza.py                # Higienização de dados brutos e cálculo de atrasos
│       ├── extrair\\\_metricas\\\_grafo.py # Extração nativa de PageRank/Degree via Neo4j GDS + NetworkX
│       ├── montar\\\_base\\\_modelagem.py  # Consolidação 1:1 por boleto dos dados transacionais, cadastrais e de rede
│       ├── atualizar\\\_politicas\\\_dinamicas.py # Análise de risco setorial e atualização de politica\\\_risco.yaml
│       ├── pipeline\\\_operacional.py   # Aplicação de regras + IA + SHAP ➔ pipeline\\\_report\\\_mesacredito.csv
│       ├── upload\\\_neo4j.py           # Injeção em lote de nós e arestas no Neo4j
│       ├── backtest\\\_suite.py         # Validação temporal out-of-time da acurácia do modelo
│       ├── monitor\\\_data\\\_drift.py     # Cálculo de PSI para auditoria de estabilidade populacional
│       └── analise\\\_sobrevivencia.py  # Ajuste de curvas atuaritas de Kaplan-Meier
├── frontend\\\_mvp/
│   ├── package.json                  # Dependências do React 19, Vite, Tailwind CSS e Recharts
│   └── src/
│       ├── App.tsx                   # Roteamento global das 6 telas executivas
│       ├── services/api.ts           # Cliente HTTP com gestão de token JWT e renovação automática
│       └── modules/                  # Módulos visuais (Cockpit, Risco, PD, Concentração, Mesa, Governança)
├── data/
│   ├── raw/                          # Bases brutas originais (boletos e dados cadastrais)
│   └── processed/                    # Bases saneadas, features de grafo e relatórios operacionais
└── Documentação/                     # Documentações detalhadas, diagramas e relatórios técnicos
```

\---

*Relatório Oficial Homologado para Apresentação — Motor ForeSig Núclea v2.5*

