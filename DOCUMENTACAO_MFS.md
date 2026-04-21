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
- **Setores Mercadológicos (CNAE):** Aplica a "Fórmula de Toxidade" do protótipo no nível macro. Em vez de bloquear apenas por calote, o motor avalia o `Risco Composto = Taxa de Default + (1 - (Score Materialidade Médio / 1000))`. Setores com toxidade `> 0.50` entram na Lista Negra (*Tier 1*). Isso protege setores estratégicos que possuem alta materialidade mesmo com atrasos pontuais.
- **Cedentes:** Bloqueio de novos títulos vindos de fornecedores com calote histórico `> 30%`.
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

## 4. Arquitetura de Produção (Google Cloud Platform)

A solução migrou de um ambiente puramente local para uma arquitetura **Serverless & Robust** no GCP, otimizada para o *Free Tier*:

- **Backend (mfs-api):** Hospedado no **Cloud Run**. 
    - **Sincronização de Dados:** Implementamos um gerenciador de ativos (`GCSManager`) que, no momento do boot do container, comunica-se com um Bucket privado (`gs://nuclea-mfs-assets-8138`) para baixar os modelos ML (`.joblib`) e as bases históricas de grafos e liquidez. Isso garante que a API seja *stateless* e escalável.
    - **Segurança:** Protegida por Token JWT e variáveis de ambiente sensíveis.
- **Frontend (mfs-dashboard):** Hospedado no **Cloud Run** via imagem Nginx customizada.
    - **Roteamento SPA:** Configurado com `try_files` para garantir que o roteamento do React Router não quebre em caso de recarregamento de página (F5).
    - **Comunicação:** Conecta-se à API Cloud via HTTPS seguro.
- **Build & CI/CD:** Utilização do **Cloud Build** com manifestos YAML para automação da montagem das imagens Docker no Artifact Registry.

---

## 5. Endpoints e Acessos Oficiais

A plataforma está operacional e disponível nos seguintes endereços:

*   🌐 **Executivo Dashboard (Frontend):** [https://mfs-dashboard-243998235267.us-central1.run.app](https://mfs-dashboard-243998235267.us-central1.run.app)
*   ⚙️ **Motor de Inteligência (API Docs):** [https://mfs-api-243998235267.us-central1.run.app/docs](https://mfs-api-243998235267.us-central1.run.app/docs)
*   📦 **Asset Storage (Bucket GCS):** `gs://nuclea-mfs-assets-8138/data/`

---

## 6. Checklist de Manutenção
Para novos treinamentos de modelo ou atualizações de base:
1. Gerar novos `.joblib` ou `.csv` localmente.
2. Fazer o upload para o Bucket GCS na pasta respectiva.
3. Reiniciar o serviço `mfs-api` no Cloud Run para que o `lifespan` baixe as versões atualizadas.
