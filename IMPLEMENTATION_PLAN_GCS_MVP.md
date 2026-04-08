# Plano de Implementação: Persistência Efêmera via GCS (MVP)

Este plano descreve como garantir que as decisões de crédito e relatórios do Motor MFS sejam persistidos no GCP sem a necessidade de migração completa para SQL/NoSQL no momento, utilizando o **Google Cloud Storage (GCS)**.

## 🎯 Objetivo
Resolver o problema da efemeridade do Cloud Run para o MVP, permitindo que a Mesa de Crédito acesse os relatórios gerados e mantendo um log de auditoria das decisões de IA.

## 🛠️ Mudanças Propostas

### 1. Novo Módulo: `gcs_manager.py`
Utilizaremos a biblioteca `google-cloud-storage` (já em `requirements.txt`) para criar um gerenciador centralizado.
- **Função A:** Upload do CSV consolidado da "Mesa de Crédito".
- **Função B:** Armazenamento de "Decision Logs" individuais (JSON) para cada predição da API.

### 2. Integração no Pipeline e API
- **`pipeline_operacional.py`:** Após processar o lote, o arquivo de saída será enviado para o Bucket `nuclea-mfs-data`.
- **`main_rest_api.py`:** Toda predição feita via `/v1/predict` salvará um log JSON no bucket para auditoria futura.

### 3. Configuração de Infraestrutura
- Criar o Bucket no GCP.
- Adicionar a variável `GCP_BUCKET_NAME` no `.env`.
- Configurar permissões na conta de serviço do Cloud Run.

---

## ⚡ User Review Required

> [!IMPORTANT]
> **Modelo de Permissões:** Você prefere que o bucket seja acessado via Credenciais de Serviço (Jason File) ou via permissão direta da Conta de Serviço do Cloud Run (recomendado para produção)?

> [!TIP]
> **Custo-Benefício:** Esta solução é "low-code" e resolve 100% da necessidade de persistência do MVP nesta Sprint.

## 🧪 Verificação
1. Execução do pipeline via Cloud Shell.
2. Verificação manual da presença dos arquivos JSON e CSV no console do GCS.
3. Simulação de "reinicialização" do container para garantir que os dados persistem externamente.
