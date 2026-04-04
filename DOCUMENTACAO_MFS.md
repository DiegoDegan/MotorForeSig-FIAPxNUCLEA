# 🖥️ Documentação Oficial: Motor MFS (MVP - Núclea)
**Motor de Risco ForeSig - *Data-Driven & Graph-Based Credit Risk***

## 1. O que Construímos?
Substituímos uma esteira de análise de crédito puramente relacional (planilhas) por um **Motor Preditivo Híbrido** que opera em Múltiplas Dimensões. Ele não avalia apenas a "saúde" do credor, mas lê a **temperatura macroeconômica** do país, o **contágio financeiro** da rede de fornecedores e traduz matemáticas complexas em textos inteligíveis para a Mesa Operacional de forma autônoma.

O FIDC da Núclea não entra mais cego numa operação; ele intercepta dinheiros "sujos de calote" muito antes da cessão ocorrer.

---

## 2. A Arquitetura do Sistema (O Funil)

O "Coração" do sistema corre através de um Orquestrador Geral (`run_all.py`), responsável por fazer toda a máquina girar em esteira na nuvem ou localmente. O funil funciona da seguinte forma:

### Fase 1: Ingestão e Imunidade Econômica
O script de limpeza consome a base de transações puras. Imediatamente após isso, a aplicação realiza chamadas remotas na **API Pública do BACEN** (`get_bacen_data.py`), sugando a Taxa Selic e o IPCA em tempo real para o exato dia do vencimento do boleto, contextualizando a IA se aquele dinheiro "estava mais caro" de se pagar naquele momento de Brasil.

### Fase 2: O Grafo de Redes de Risco (Neo4j / NetworkX)
Transformar as faturas em uma malha relacional (Grafos).
- **Risco de Contágio Reverso:** Ao invés de o fundo olhar se a transportadora "José" é boa pagadora, a máquina olha todos os clientes que sustentam a transportadora. Se clientes pesados na balança (`PageRank`) têm um histórico longo de atraso sistêmico, o motor joga o saldo contaminado na variável de Exposição (`total_exposed_value`) da Transportadora "José".
- Essa fase funciona localmente em memória (via script), ou integrada via banco distribuído no **AuraDB (Neo4j)**, suportando escalabilidade infinita de volumetria.

### Fase 3: A Varredura Macroprudencial Autónoma (YAML)
Uma inteligência "Curadora" (`atualizar_politicas_dinamicas.py`) investiga todo o histórico transacional à la "Auditor Financeiro".
- Setores Mercadológicos (CNAE) com calote histórico `> 25%`? Ele joga na "Lista Negra" (*Tier 1*).
- Cedentes com calote `> 30%` também vão à lista negra.
- Estas Regras Duras não ficam presas no código. Elas são gravadas num documento leve em **YAML**, podendo ser lido instantaneamente por qualquer Frontend de Dashboard ou alterado manualmente por um humano e o fundo as acata *na hora*.

### Fase 4: Inteligência Artificial Dupla (PD, LGD)
Para entender se o Boleto #003 vai atrasar, não usamos estatística comum.
- Usamos **`RandomForestClassifier`**: Para calcular a rigorosidade do tombo. Probabilidade de Calote Seco (`Score_PD_Bruto`).
- Usamos **`RandomForestRegressor`**: Para tentar adivinhar a quantidade de Dias de Atraso cravada!
As predições juntam Dinheiro (Vlr Normal) e Risco e criam a métrica final dos bancos: a cravosa **Perda Esperada EL**.

### Fase 5: O Tradutor (Interpretabilidade SHAP)
A matemática da fase 4 é opaca (caixa preta). Portanto, o FIDC emprega a biblioteca **SHAP**. Este módulo entra na cabeça da Arvore de Decisão e "assopra" o motivo exato.
Nosso código então pega esse motivo e redige um Parecer de Negócio com linguagem de crédito: *"Score punido devido à alta conectividade do fornecedor na malha"*.

---

## 3. O Relatório de Saída da "Mesa de Crédito"
No ápice do funil (`pipeline_operacional.py`), o Motor analisa as Hard Rules da Fase 3 contra o Score Preditivo da Fase 4. O Sistema emite um dos seguintes Carimbos Finais por Operação em um CSV/XML limpo e pronto!
* `[APROVADO_AUTO]`: Sem problemas, ceda o crédito.
* `[ANALISE_MESA]`: Tem um alerta menor, envie a Mesa de Crédito Operacional revisar.
* `[REPROVADO_SETORES_CRITICOS]`: Nem entre. Este CNAE está sangrando dinheiro!
* `[REPROVADO_CEDENTE_TOXICO]`: Cuidado, clientes desse Fornecedor possuem Risco Agudo em Massa!
* `[REPROVADO_AUTO]`: O Machine Learning apontou que, embora o setor ou fornecedor sejam limpos, aquele boleto individual específico tem forte chance de Default.

### Infraestrutura de Escalabilidade
Todo esse robusto back-end foi preparado para ser exposto em **Endpoints (Rest API no FastAPI)** sob demanda para portais externos, conteinerizado em `Docker` pronto para decolar no GCP (Cloud Run) da Antigravity, de modo inteiramente *Serverless* e seguro (dotEnvs).
