# 📂 Pasta de Ativos Estáticos (Public) - MFS Dashboard

Esta pasta contém os recursos estáticos que são servidos diretamente pelo **Nginx** na implantação do Google Cloud Run.

### 🖼️ Conteúdo
- Logos da Núclea e do Motor MFS.
- Favicons e manifestos web.
- Imagens de suporte para a interface do Cockpit Gerencial.

### 🚀 Deploy em Produção
O frontend está configurado para ser entregue via **Cloud Run (Serverless)**.
- **URL Oficial:** [https://mfs-dashboard-243998235267.us-central1.run.app](https://mfs-dashboard-243998235267.us-central1.run.app)
- **Servidor Web:** Nginx Alpine.
- **Configuração de Roteamento:** Fallback para `index.html` ativado para suporte a Single Page Application (SPA).

---
*Documentação atualizada em: 21 de Abril de 2026*
