# 🚀 Guia de Configuração: Motor ForeSig (MFS)

Este guia foi criado para ajudar você a configurar e rodar o projeto **Motor ForeSig** na sua máquina pela primeira vez, usando o VS Code.

---

## 1. Pré-requisitos (Instale se ainda não tiver)

Antes de começar, você precisará de três coisas instaladas no seu computador:

1.  **Python**: [Baixe aqui](https://www.python.org/downloads/) (Marque a opção **"Add Python to PATH"** durante a instalação).
2.  **Git**: [Baixe aqui](https://git-scm.com/downloads) (Apenas clique em "Next" em todas as opções).
3.  **VS Code**: [Baixe aqui](https://code.visualstudio.com/).

---

## 2. Baixando o Projeto do GitHub

1.  Abra o **VS Code**.
2.  Pressione as teclas `Ctrl + Shift + P` ao mesmo tempo.
3.  Digite `Git: Clone` e aperte **Enter**.
4.  Cole o link do repositório: `https://github.com/DiegoDegan/MotorForeSig-FIAPxNUCLEA.git`
5.  Escolha uma pasta no seu computador onde o projeto será salvo.
6.  Quando terminar, aparecerá uma mensagem no canto inferior direito. Clique em **Abrir (Open)**.

---

## 3. Configurando o Ambiente (O "Coração" do Projeto)

Agora vamos preparar o computador para entender o código.

1.  No VS Code, abra o terminal pressionando `Ctrl + '` (ou vá em **Terminal > New Terminal** no menu superior).
2.  Copie e cole o comando abaixo no terminal e aperte **Enter**:
    ```powershell
    python -m venv .venv
    ```
    *(Isso cria uma "caixa isolada" para o projeto não interferir no seu PC).*

3.  **Ativando a caixa**:
    ```powershell
    .\.venv\Scripts\Activate.ps1
    ```
    *(Se aparecer um erro de "Script de execução", não se preocupe, avise o Diego).*

---

## 4. Instalando os Pacotes Necessários

Com o terminal ainda aberto, cole este comando:
```powershell
pip install -r requirements.txt
```
*(Aguarde alguns minutos. O computador está baixando as ferramentas de IA e análise de dados).*

---

## 5. Configurando as Chaves (Arquivo .env)

O projeto precisa de "senhas" para funcionar (como acesso ao banco de dados).

1.  Na lista de arquivos à esquerda, procure pelo arquivo `.env.example`.
2.  Clique com o botão direito nele e escolha **Renomear (Rename)**.
3.  Mude o nome para apenas `.env` (apague o `.example`).
4.  Abra esse arquivo e preencha as informações que o Diego te passar (como `NEO4J_PASSWORD`).

---

## 6. Como Rodar o Projeto?

Tudo pronto! Para testar se o motor de IA está funcionando:

1.  No terminal, digite:
    ```powershell
    python run_all.py
    ```
2.  Isso executará toda a esteira: desde a limpeza dos dados até o treinamento da IA.

---

## 🛠️ Dicas de Ouro (VS Code)

-   **Extensão de Python**: O VS Code vai sugerir instalar a extensão "Python" da Microsoft. Clique em **Instalar**.
-   **Arquivos CSV**: Se quiser ver as planilhas, procure na pasta `data/raw/` ou `data/processed/`.

**Dúvidas?** Chame o Diego no Slack/WhatsApp!
