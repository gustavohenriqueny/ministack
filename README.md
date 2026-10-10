# MiniStack

Console web local para gerenciar serviços AWS emulados — um "console da AWS" para desenvolvimento offline, rodando sobre o emulador [MiniStack](https://hub.docker.com/r/ministackorg/ministack) (compatível com LocalStack).

Criei para não depender de CLI ou de conta AWS ao desenvolver e testar fluxos assíncronos (filas, tópicos, containers) na minha máquina.

## O que faz

- **SQS:** criar, listar, purgar e remover filas; enviar mensagens; *redrive* da DLQ para a fila principal
- **SNS:** criar tópicos, inscrever filas, publicar mensagens
- **ECR:** registro Docker local compatível com a Docker Registry API V2 (`docker push`/`pull`)
- **ECS:** emulação de clusters, task definitions, services e tasks executando containers via Docker

## Arquitetura

```
frontend/  React 19 + TypeScript + Vite + Tailwind (shadcn/ui)
   │  HTTP /api
backend/   Go 1.22 + chi + AWS SDK v2  ──►  MiniStack (:4566)
   │                                   ──►  Docker (ECR/ECS)
```

## Como rodar

O backend serve a API em `/api` e o build do frontend a partir de `backend/public/`:

```bash
# 1. emulador AWS (porta 4566)
cd backend && docker compose up -d ministack

# 2. build do frontend dentro do backend
cd ../frontend && npm ci && npm run build && cp -r dist ../backend/public

# 3. backend (porta 9091) → abra http://localhost:9091
cd ../backend && go run ./cmd/server
```

Detalhes de cada parte em [`backend/README.md`](backend/README.md) e [`frontend/README.md`](frontend/README.md).

> Tudo roda localmente com credenciais fictícias (`test`/`test`) do emulador — nenhuma conta AWS é usada.
