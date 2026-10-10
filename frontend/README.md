# MiniStack Frontend

O **MiniStack Frontend** é uma interface gráfica baseada na web (um clone simplificado do console da AWS) desenvolvida para facilitar o gerenciamento local de serviços compatíveis com a AWS (como SQS e SNS) e de um registro Docker ECR local, conectando-se ao MiniStack Backend na porta `8080`.

## 🚀 Tecnologias Utilizadas

- **Core**: [React 19](https://react.dev/) com [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vite.dev/)
- **Estilização**: [Tailwind CSS v4](https://tailwindcss.com/) com suporte nativo a temas (Claro/Escuro)
- **Ícones**: [Lucide React](https://lucide.dev/)
- **Linting**: [ESLint](https://eslint.org/)

## 📂 Estrutura de Diretórios

O projeto segue uma estrutura modular baseada em funcionalidades (*features*):

```
src/
├── App.tsx                          # Layout principal, barra lateral, gerenciamento de estado das abas e tema
├── index.css                        # Tokens de tema do Tailwind v4 e estilos globais (incluindo classes como glass-card-base)
├── main.tsx                         # Ponto de entrada do React
├── components/
│   └── ui/                          # Componentes de interface genéricos (Card, Skeleton, etc.)
└── features/
    ├── dashboard/
    │   └── components/              # HomeDashboard (visão geral e métricas estáticas)
    ├── messaging/
    │   ├── components/              # Painel de gerenciamento do SQS e SNS
    │   ├── services/                # Chamadas HTTP para o backend (messagingService.ts)
    │   └── types/                   # Tipagens TypeScript para SQS e SNS
    └── services/
        └── components/              # Catálogo de serviços com busca, filtro e favoritos
```

## 🛠️ Funcionalidades

- **Dashboard**: Visão geral dos recursos ativos e integrados.
- **Messaging (SQS & SNS)**:
  - Criação, listagem, expurgo e exclusão de filas SQS.
  - Publicação e recebimento de mensagens.
  - Criação, listagem e exclusão de tópicos SNS.
  - Criação de inscrições (subscriptions) conectando filas a tópicos.
  - Redirecionamento de mensagens (redrive) de DLQs.
- **ECR (Elastic Container Registry)**: Integração com o Docker Registry V2 para gerenciar imagens Docker locais.
- **Suporte a Tema Escuro**: Alternância de temas persistida no `localStorage`.

## 💻 Como Rodar o Projeto

### Pré-requisitos
- [Node.js](https://nodejs.org/) (versão 18 ou superior recomendada)
- `npm` ou outro gerenciador de pacotes

### Passo a Passo

1. **Instale as dependências:**
   ```bash
   npm install
   ```

2. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```
   *O frontend estará disponível em [http://localhost:5173](http://localhost:5173).*

3. **Gere a build de produção (opcional):**
   ```bash
   npm run build
   ```

4. **Visualize a build de produção localmente:**
   ```bash
   npm run preview
   ```

## 🔌 Integração com o Backend

O frontend se comunica diretamente com o backend localizado em `http://localhost:8080`. As chamadas à API são realizadas de forma centralizada em `src/features/messaging/services/messagingService.ts`.
