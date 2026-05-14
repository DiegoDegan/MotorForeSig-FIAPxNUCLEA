# Guia de Deploy: Motor MFS no Google Cloud Platform

Este guia descreve o processo de publicação e atualização do **Motor ForeSig** no ambiente de produção do Google Cloud.

---

## 1. Preparação do Ambiente
Antes de começar, você precisa ter o **Google Cloud SDK** (gcloud) instalado na sua máquina.

1.  **Login no GCP:**
    ```bash
    gcloud auth login
    ```
2.  **Selecionar o Projeto:**
    ```bash
    gcloud config set project motor-foresig-nuclea
    ```
3.  **Configurar o Docker (Artifact Registry):**
    ```bash
    gcloud auth configure-docker us-central1-docker.pkg.dev
    ```

---

## 2. Publicação via Cloud Build
Nós utilizamos o **Cloud Build** para transformar o código em uma imagem pronta para a nuvem de forma automatizada.

### Passo 1: Enviar para o Build
Na raiz do projeto, execute o comando que lê o arquivo `cloudbuild.yaml`:
```bash
gcloud builds submit --config cloudbuild.yaml .
```
*(Isso vai compilar o Frontend, instalar o Python e gerar uma imagem única no Artifact Registry).*

---

## 3. Deploy no Cloud Run
Com a imagem gerada, fazemos a atualização do serviço para que ele passe a usar a versão nova.

### Comando de Deploy:
```bash
gcloud run deploy mfs-backend \
  --image us-central1-docker.pkg.dev/motor-foresig-nuclea/mfs-repo/mfs-app:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

---

## 4. Gestão de Segredos e Variáveis
O Motor MFS não funciona sem as chaves de acesso. Elas devem ser configuradas diretamente no painel do **Cloud Run > Edit & Deploy New Revision**:

-   **Variáveis de Ambiente Necessárias:**
    - `NEO4J_URI`: Endereço do AuraDB.
    - `NEO4J_PASSWORD`: Senha do banco.
    - `GCP_PROJECT_ID`: ID do projeto no GCP.
-   **Secrets:** Para maior segurança, utilize o **Secret Manager** do GCP e mapeie as chaves sensíveis como volumes ou variáveis.

---

## 5. Ciclo de Atualização de Dados
Se você treinou novos modelos ML localmente e quer que a nuvem os utilize:
1.  Faça o upload dos arquivos `.joblib` para o Bucket do **Google Cloud Storage**.
2.  O serviço no Cloud Run possui um mecanismo de *Hot-Reload* que baixa os novos modelos automaticamente ao reiniciar o container.

---

## 6. Monitoramento e Logs
Para verificar se há erros em produção ou lentidão:
1.  Acesse o Console do GCP > **Cloud Logging**.
2.  Filtre por `resource.type="cloud_run_revision"` e `resource.labels.service_name="mfs-backend"`.

---
**Documentação de Infraestrutura v1.0**  
*Atualizado em: 13/05/2026*
