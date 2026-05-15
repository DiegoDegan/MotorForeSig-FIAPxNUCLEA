# Diagrama de Arquitetura: Motor MFS (Núclea)

Mapeamento visual do fluxo de dados _end-to-end_ do projeto, desde a prospecção dos dados transacionais até o ponto final de consumo no Dashboard e Mesa de Crédito Operacional.

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

    subgraph MFS_CLOUD [Ecossistema Motor MFS - Google Cloud Native]
        direction TB
        
        subgraph DataSources [1. Camada de Ingestão]
            B[Base Boletos Transacionais]:::rawData
            A[Base Auxiliar FIDC]:::rawData
            Raw[Repositorio /data/raw]:::rawData
            
            B & A --> Raw
        end

        subgraph ETL_Graph [2. Orquestração & Redes]
            RunAll[["run_pipeline.py\n(Master Orchestrator)"]]:::compute
            Limp["limpeza.py\n(Sanitização)"]:::compute
            Neo[(Neo4j AuraDB Cloud\nGraph DB)]:::graphBD
            NetX["extrair_metricas_grafo.py\n(PageRank & Centralidade)"]:::compute
            
            Raw --> RunAll
            RunAll --> Limp
            Limp --> Neo
            Neo -.-> NetX
        end

        subgraph Intelligence [3. Inteligência & Políticas]
            MergeBase{{"montar_base_modelagem.py\n(Merge Global)"}}:::compute
            Trainer["model_trainer.py\n(Random Forest PD)"]:::mlEngine
            SHAP["explicabilidade.py\n(SHAP Explainability)"]:::mlEngine
            WB[(Weights & Biases\nMLOps Monitoring)]:::infra
            
            MergeBase --> Trainer
            Trainer --> SHAP
            Trainer -.->|Logging| WB
        end

        subgraph Runtime [4. Backend Gateway - Cloud Run]
            FastAPI{"main_rest_api.py\n(FastAPI Server)"}:::external
            GCS[(Google Cloud Storage\nModel & Asset Sync)]:::infra
            
            Trainer -.->|Exporta .joblib| GCS
            GCS -.->|Hot-Reload| FastAPI
            WB -.->|Métricas| FastAPI
            SHAP --> FastAPI
        end

        subgraph Frontend [5. Camada de Apresentação]
            Cockpit[Cockpit Portfolio\nKPIs Ativos]:::frontend
            SysRisk[Risco Sistêmico\nVisualização D3]:::frontend
            CreditDesk[Mesa de Crédito\nJustificativa IA]:::frontend
            GovML[Governança & MLOps\nEstabilidade PSI]:::frontend
            
            FastAPI <-->|JSON Stream| Cockpit
            FastAPI <-->|Relational Graph| SysRisk
            FastAPI <-->|SHAP Feedback| CreditDesk
            FastAPI <-->|W&B Data| GovML
        end
    end
```

### Entendendo a Legenda do Fluxo:
- **Preto/Cinza Escuro**: Bases de dados brutas e arquivos de configuração operacional.
- **Azul Metálico**: Módulos de processamento, banco de grafos e métricas de rede.
- **Vermelho**: Núcleo de Inteligência Artificial (Treinamento e Explicabilidade).
- **Amarelo/Ouro**: Interface React modularizada para consumo final.
- **Tracejado**: Camada de infraestrutura gerenciada (Google Cloud Platform).

---
**Status da Documentação:** Atualizada para a versão final (Remoção de Selic/BACEN).
