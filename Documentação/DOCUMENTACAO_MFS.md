# Documentação Oficial: Motor MFS (v2.0 - Núclea)
> **Motor de Risco ForeSig - *Data-Driven & Graph-Based Credit Risk***

## 1. O que Construímos?
Substituímos uma esteira de análise de crédito puramente relacional por um **Motor Preditivo Híbrido** de última geração. O sistema opera em múltiplas dimensões: analisa a saúde financeira individual, o **contágio sistêmico** via grafos de rede e aplica políticas macroprudenciais dinâmicas, traduzindo decisões complexas em justificativas de negócio via IA Explicável (XAI).

---

## 2. A Arquitetura do Sistema (O Fluxo de Dados)

O "Coração" do sistema é o Orquestrador Central (`backend/run_pipeline.py`), responsável por garantir que todas as etapas de inteligência ocorram na ordem correta, seja em ambiente de desenvolvimento ou produção.

### Fase 1: Higienização e Saneamento (`limpeza.py`)
Consome as bases de boletos e dados cadastrais brutos. Realiza o tratamento de nulos, correção de tipos e filtragem de ruídos, garantindo que a "matéria-prima" da IA seja de alta qualidade.

### Fase 2: O Grafo de Redes de Risco (Neo4j AuraDB)
Transformação das faturas em uma malha relacional.
- **Risco de Contágio:** Avalia a conectividade entre cedentes e sacados. Se uma empresa está conectada a nós problemáticos da rede, seu score é penalizado via métricas de **PageRank** e **Centralidade**.
- **Infraestrutura:** Utiliza o **Neo4j AuraDB (Cloud)** para processamento distribuído de grafos em tempo real.

### Fase 3: Políticas Macroprudenciais Dinâmicas (`politica_risco.yaml`)
Uma camada de governança que permite ao gestor humano (ou ao script de auditoria) ajustar a "régua" de crédito sem mexer no código.
- **Lista Negra de Setores (CNAE):** Bloqueio automático de setores com alta toxidade sistêmica.
- **Bloqueio de Cedentes:** Interrupção de cessão para fornecedores com histórico crítico de inadimplência.

### Fase 4: Inteligência Preditiva (Machine Learning)
O motor utiliza modelos de **Random Forest** treinados com os dados transacionais e de rede:
- **Score PD (Probabilidade de Default):** Predição binária da chance de o título não ser pago.
- **Previsão de Atraso:** Regressor que estima a quantidade de dias de atraso esperada.

### Fase 5: Explicabilidade (SHAP & XAI)
Utiliza a biblioteca **SHAP** para quebrar a "caixa preta" do modelo. Para cada decisão, o motor gera um parecer textual amigável (ex: *"Score reduzido devido à alta exposição financeira a pagadores tóxicos"*), permitindo que a mesa de crédito entenda o racional da IA.

---

## 3. Entrega Operacional (Endpoints)

O sistema disponibiliza os resultados através de uma API robusta hospedada no **Google Cloud Run**:
*   `GET /v1/dashboard/summary`: Resumo executivo dos KPIs do portfólio.
*   `GET /v1/pipeline/report`: Relatórios detalhados para a mesa de crédito (justificativas + vereditos).
*   `GET /v1/risk/graph`: Dados estruturados para a visualização da teia de risco sistêmico.

---

## 4. Infraestrutura Cloud (GCP)

A solução é 100% **Cloud Native** e otimizada para escalabilidade:
- **Runtime:** Backend e Frontend isolados em containers no **Cloud Run**.
- **Storage:** Google Cloud Storage (GCS) utilizado para persistência de modelos `.joblib` e backups de dados.
- **CI/CD:** Automatizado via **Cloud Build**, garantindo deploys rápidos e seguros.

---

## 5. Endpoints de Acesso Oficiais

*   🌐 **Dashboard Executivo:** [https://mfs-backend-564952987470.us-central1.run.app](https://mfs-backend-564952987470.us-central1.run.app) (Frontend integrado)
*   ⚙️ **Documentação da API (Swagger):** [https://mfs-backend-564952987470.us-central1.run.app/docs](https://mfs-backend-564952987470.us-central1.run.app/docs)

---

## 6. Manutenção e Atualização
Para treinar a IA com novos dados:
1. Adicione os novos CSVs em `data/raw/`.
2. Execute `python backend/run_pipeline.py`.
3. Os novos modelos e relatórios serão gerados e estarão prontos para upload no GCS.

---

**Versão da Documentação:** 2.0.0  
**Data da Revisão:** 13/05/2026  
**Status:** Projeto Finalizado & Cloud Ready.
