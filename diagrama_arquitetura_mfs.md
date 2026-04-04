# 🏗️ Diagrama de Arquitetura: Motor MFS (Núclea)

Mapeamento visual do fluxo de dados _end-to-end_ do projeto, desde a prospecção dos dados originais e macroeconômicos até o ponto final de entrega na API REST e Mesa de Crédito.

```mermaid
flowchart TD
    %% Cores e Estilizações Customizadas
    classDef rawData fill:#1a1c29,stroke:#4C566A,stroke-width:1px,color:#D8DEE9
    classDef external fill:#2e3440,stroke:#88C0D0,stroke-width:2px,color:#ECEFF4
    classDef compute fill:#434C5E,stroke:#81A1C1,stroke-width:2px,color:#ECEFF4
    classDef graphBD fill:#5E81AC,stroke:#88C0D0,stroke-width:2px,color:#FFF
    classDef mlEngine fill:#BF616A,stroke:#D08770,stroke-width:2px,color:#FFF
    classDef output fill:#A3BE8C,stroke:#8FBCBB,stroke-width:2px,color:#2E3440

    %% Nível 1: Ingestão de Dados
    subgraph Data Sources [1. Camada de Ingestão de Dados]
        B[Base Boletos Transacionais]:::rawData
        A[Base Auxiliar FIDC]:::rawData
        BACEN((API Pública do BACEN\nSelic/IPCA)):::external
    end

    %% Nível 2: Limpeza e Grafos
    subgraph Processing [2. Processamento de Redes e Limpeza]
        Limp["limpeza.py\n(Tratamento Inicial)"]:::compute
        Neo[(Neo4j AuraDB\nGraph Database)]:::graphBD
        NetworkX["extrair_metricas_grafo.py\n(Fallback NetworkX)"]:::compute
        
        B --> Limp
        A --> Limp
        Limp --> Neo
        Limp --> NetworkX
        Neo -.->|Calcula PageRank & Centralidade| NetworkX
        NetworkX -- Extrai Total Exposed Value\nContágio ---> MergeBase
    end

    %% Nível 3: Unificação
    subgraph Centralization [3. Centralização da Modelagem]
        MergeBase{{"montar_base_modelagem.py\n(Merge Universal)"}}:::compute
        BACEN --> MergeBase
        Limp -->|Dados Tratados| MergeBase
    end

    %% Nível 4: Machine Learning e Política YAML
    subgraph Intelligence [4. Camada de Inteligência Preditiva]
        Updater["atualizar_politicas_dinamicas.py\n(Auditor de Defaults)"]:::compute
        YAML[/"politica_risco.yaml\n(Blacklist Tiers)"/]:::rawData
        
        Trainer["model_trainer.py\n(Random Forest PD/LGD)"]:::mlEngine
        SHAP["explicabilidade.py\n(SHAP Explainability)"]:::mlEngine

        MergeBase --> Updater --> YAML
        MergeBase --> Trainer
        Trainer --> SHAP
    end

    %% Nível 5: O Operacional
    subgraph Operational [5. Mesa de Crédito & Abertura]
        Orquestrador(("pipeline_operacional.py\n(Motor de Decisões)")):::compute
        REST{"main_rest_api.py\n(FastAPI Server)"}:::external
        DashOutputs[/"pipeline_report_mesacredito.csv\n(Dashboard BI)"/]:::output
        
        YAML --> Orquestrador
        Trainer -->|Previsões de Risco| Orquestrador
        SHAP -->|Motivo Descritivo| Orquestrador
        
        Orquestrador --> DashOutputs
        Orquestrador <--> REST
    end
```

### Entendendo a Legenda do Fluxo:
- ⬛ **Preto/Cinza Escuro**: Bases de Origem e arquivos crus.
- 🟦 **Azul Metálico**: Módulos Processadores de Limpeza e Cálculos de Grafo da base.
- 🟥 **Vermelho**: A "Caixa Preta". Processamento da IA (Scikit-Learn/SHAP).
- 🟩 **Ciano/Verde**: Endpoints Web e Arquivos Exportados Prontos (Dinheiro Blindado).
