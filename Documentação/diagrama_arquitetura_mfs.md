# 🏗️ Diagrama de Arquitetura: Motor MFS (Núclea)

Mapeamento visual do fluxo de dados _end-to-end_ do projeto, desde a prospecção dos dados originais e macroeconômicos até o ponto final de consumo no Dashboard e Mesa de Crédito Operacional.

```mermaid
flowchart TD
    %% Cores e Estilizações Customizadas
    classDef rawData fill:#1a1c29,stroke:#4C566A,stroke-width:1px,color:#D8DEE9
    classDef external fill:#2e3440,stroke:#88C0D0,stroke-width:2px,color:#ECEFF4
    classDef compute fill:#434C5E,stroke:#81A1C1,stroke-width:2px,color:#ECEFF4
    classDef graphBD fill:#5E81AC,stroke:#88C0D0,stroke-width:2px,color:#FFF
    classDef mlEngine fill:#BF616A,stroke:#D08770,stroke-width:2px,color:#FFF
    classDef output fill:#A3BE8C,stroke:#8FBCBB,stroke-width:2px,color:#2E3440
    classDef frontend fill:#EBCB8B,stroke:#D08770,stroke-width:2px,color:#2E3440
    classDef infra fill:#4C566A,stroke:#D8DEE9,stroke-dasharray: 5 5,color:#FFF

    subgraph GCP [Google Cloud Platform - Infraestrutura Cloud Native]
        direction TB
        
        subgraph DataSources [1. Camada de Ingestão de Dados]
            B[Base Boletos Transacionais]:::rawData
            A[Base Auxiliar FIDC]:::rawData
            BACEN((API Pública do BACEN\nSelic/IPCA)):::external
        end

        subgraph ETL_Graph [2. Engenharia de Dados & Redes de Risco]
            Limp["limpeza.py\n(Tratamento Inicial)"]:::compute
            Neo[(Neo4j AuraDB\nGraph Database)]:::graphBD
            NetX["extrair_metricas_grafo.py\n(Features de Contágio)"]:::compute
            
            B --> Limp
            A --> Limp
            Limp --> Neo
            Neo -.->|Calcula PageRank & Centralidade| NetX
            NetX -- Extrai Total Exposed Value ---> MergeBase
        end

        subgraph Intelligence [3. Motor de Inteligência & Políticas]
            MergeBase{{"montar_base_modelagem.py\n(Merge Universal)"}}:::compute
            Trainer["model_trainer.py\n(Random Forest PD/LGD)"]:::mlEngine
            SHAP["explicabilidade.py\n(SHAP & Pareceres)"]:::mlEngine
            YAML[/"politica_risco.yaml\n(Controle Dinâmico)"/]:::rawData
            
            Limp --> MergeBase
            BACEN --> MergeBase
            MergeBase --> Trainer
            Trainer --> SHAP
            MergeBase --> YAML
        end

        subgraph Backend [4. Backend Gateway - Cloud Run]
            FastAPI{"main_rest_api.py\n(FastAPI + JWT Authentication)"}:::external
            GCS[(Google Cloud Storage\nAsset & Model Sync)]:::infra
            
            Trainer -.->|Exporta .joblib| GCS
            GCS -.->|Sincroniza Modelos| FastAPI
            SHAP --> FastAPI
            YAML --> FastAPI
        end

        subgraph Frontend [5. Camada de Apresentação & Mesa - React]
            Cockpit[Cockpit Portfolio\nKPIs Ativos]:::frontend
            SysRisk[Risco Sistêmico\nForce Graph D3]:::frontend
            CreditDesk[Mesa de Crédito\nFeedback Loop]:::frontend
            Gov[Governança\nPerformance & Drift]:::frontend
            
            FastAPI <-->|JSON Data / Auth| Cockpit
            FastAPI <-->|Relational Graph Data| SysRisk
            FastAPI <-->|Pipeline Ops & Overrides| CreditDesk
            FastAPI -->|Audit Logs & PSI| Gov
        end
    end
```

### Entendendo a Legenda do Fluxo:
- ⬛ **Preto/Cinza Escuro**: Bases de Origem e arquivos de configuração (YAML/CSV).
- 🟦 **Azul Metálico**: Módulos Processadores de Limpeza e Cálculos de Grafo.
- 🟥 **Vermelho**: Motor de IA (Training, Explainability e Inferência).
- 🟨 **Amarelo/Ouro**: Interface de Usuário (Frontend modularizado).
- 🟩 **Ciano/Verde**: API Gateway (FastAPI) e Pontos de Integração.
- ⬜ **Tracejado**: Infraestrutura de suporte em nuvem (GCS/Cloud Run).
