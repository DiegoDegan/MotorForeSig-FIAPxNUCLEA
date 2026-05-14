# Guia de Configuração: Motor ForeSig (MFS) - v2.0

Este guia foi criado para ajudar você a configurar e rodar o projeto **Motor ForeSig** na sua máquina pela primeira vez.

---

## 1. Pré-requisitos (Instalação Inicial)

Antes de começar, certifique-se de ter instalado:

1.  **Python 3.13+**: [Baixe aqui](https://www.python.org/downloads/). **Importante:** Marque a opção **"Add Python to PATH"** na instalação.
2.  **Git**: [Baixe aqui](https://git-scm.com/downloads).
3.  **Cursor ou VS Code**: [Baixe aqui](https://cursor.com/).

---

## 2. Configurando o Ambiente (Passo a Passo)

Abra a pasta do projeto no seu editor e abra o terminal (`Ctrl + '`).

### Passo 1: Criar e Ativar o Ambiente Virtual (.venv)
O ambiente virtual evita conflitos entre as bibliotecas do seu PC e as do projeto.
```powershell
# Cria a pasta .venv
python -m venv .venv

# Ativa o ambiente (Se der erro de permissão, veja as dicas abaixo)
.\.venv\Scripts\Activate.ps1
```

### Passo 2: Instalar Dependências
Com o ambiente ativado (deve aparecer um `(.venv)` no terminal), instale as bibliotecas:
```powershell
pip install -r requirements.txt
```

### Passo 3: Configurar Credenciais (.env)
1.  Renomeie o arquivo `.env.example` para apenas `.env`.
2.  Preencha as variáveis de ambiente (as chaves do Neo4j AuraDB e Google Cloud que o Diego te passar).

---

## 3. Como Rodar o Motor

O projeto agora possui uma esteira automatizada que faz todo o trabalho pesado.

### ⚙️ Rodar o Pipeline de IA (Limpeza + Treino)
Sempre que quiser atualizar o cérebro da IA ou processar novos dados em `data/raw/`:
```powershell
python backend/run_pipeline.py
```

### 🌐 Ligar a API (Para o Dashboard)
Para que o Dashboard consiga ler os dados, você precisa ligar o servidor do backend:
```powershell
python backend/main_rest_api.py
```
*(O servidor rodará em http://127.0.0.1:8000)*

---

## 🛠️ Resolução de Problemas Comuns

-   **Erro ao Ativar .venv (UnauthorizedAccess):** Se o Windows bloquear o comando de ativação, rode este comando no terminal uma vez:
    `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`
-   **Módulo Não Encontrado no Editor:** Se o seu editor (Cursor/VS Code) mostrar linhas vermelhas, use o `Ctrl + Shift + P` -> **Python: Select Interpreter** e escolha o que aponta para a pasta `.venv`.

**Última Atualização:** 13/05/2026
