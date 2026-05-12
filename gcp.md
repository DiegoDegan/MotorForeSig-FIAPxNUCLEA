# Relatório de Troubleshooting e Status do Deploy no GCP

Este documento relata os problemas estruturais enfrentados durante o deploy da aplicação Motor ForeSig (MFS) no Google Cloud Run, as decisões arquiteturais tomadas para superá-los e o status final das URLs.

---

## 1. Deploy da API Backend (FastAPI + Python)

### 🚨 Problema 1: Incompatibilidade do Cloud Buildpacks
* **Erro:** O sistema nativo de empacotamento do GCP (Buildpacks) falhou ao tentar instalar a biblioteca `pydantic==2.6.4`.
* **Causa:** O Google Cloud atualizou seus servidores em 2026 e abandonou o suporte às versões do Python 3.11 e 3.12. As versões mais novas (3.13/3.14) não possuem binários pré-compilados do Pydantic antigo, o que forçava uma compilação nativa em Rust que acabava quebrando.
* **Solução:** Abandonamos a compilação nativa do GCP (`--source .`) e forçamos a leitura via **Dockerfile**, usando uma imagem base `python:3.11-slim` garantindo que o ambiente fosse idêntico ao desenvolvimento local.

### 🚨 Problema 2: Limite de Memória (OOM Killed)
* **Erro:** `Memory limit of 512 MiB exceeded`.
* **Causa:** Os modelos de Machine Learning (Scikit-Learn, Joblib, Lifelines) são pesados para subir para a memória no momento que a API inicializa, estourando o limite padrão da nuvem gratuita (512MB).
* **Solução:** Refizemos o comando de deploy incluindo a tag `--memory=1024Mi`, dobrando a alocação de RAM do container.

### 🚨 Problema 3: "Dependency Hell" (Conflito entre NumPy e WandB)
* **Erro:** O servidor caiu no startup alertando: `AttributeError: np.float_ was removed in the NumPy 2.0 release.`
* **Causa:** O pacote `shap` puxou automaticamente a versão recém-lançada do **NumPy 2.0+**, porém o nosso sistema de monitoria `wandb==0.16.5` não tinha suporte para essa nova versão do numpy e "quebrava" o servidor inteiro logo na primeira linha de código lida.
* **Solução:** Editamos o `requirements.txt` retirando a trava antiga e atualizando para `wandb>=0.17.0`, garantindo a compatibilidade universal de todo o projeto com o NumPy 2.

### ✅ Status Final do Backend
* **Condição:** **Deploy concluído com sucesso.**
* **URL Oficial:** `https://mfs-backend-564952987470.us-central1.run.app`
* **Variáveis Injetadas:** `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`.

---

## 2. Deploy do Frontend (React + Vite)

O frontend ainda estava em fase de compilação (cancelada para seguirmos por outra via), mas enfrentamos uma cadeia interessante de erros na tentativa padrão:

### 🚨 Problema 1: Ausência da Build Estática
* **Erro:** O docker do Google reportou `file not found` ao tentar achar a pasta `dist/`.
* **Causa:** O script original apenas copiava o código pré-compilado, mas não havia código compilado na nuvem.
* **Solução:** Refizemos o `Dockerfile` com o padrão **Multi-stage**, delegando a missão de rodar `npm run build` para o próprio servidor em nuvem.

### 🚨 Problema 2: Incompatibilidade do Tailwind com Alpine e Cache
* **Erro:** O NPM reportou `Cannot find native binding` do Tailwind/esbuild.
* **Causa:** A imagem `node:18-alpine` não contém as bibliotecas C++ necessárias, e o arquivo `package-lock.json` gerado no seu Windows obrigava a nuvem a procurar dependências do Windows dentro do Linux.
* **Solução:** Alteramos a imagem para a versão Debian (`node:20 AS builder`) para garantir as bibliotecas do Tailwind e substituímos `npm ci` por `npm install` no script de build.

### 🛑 Status Final do Frontend
* **Condição:** Deploy interrompido/cancelado. A build pelo NodeJS no Cloud Run ia ser finalizada, mas decidimos parar o processo em prol de uma nova estratégia de hospedagem.
* **URL API (no .env):** O repositório local do frontend já está configurado no arquivo `.env` para bater diretamente na URL real de produção do backend.

---

### Próximos Passos
Fico no aguardo da sua nova estratégia de abordagem para avançarmos.
