# MiniStack Backend

O **MiniStack Backend** é um servidor local escrito em Go que atua como um facilitador e proxy para emulação de serviços da AWS (especificamente SQS e SNS via LocalStack/MiniStack container) e que implementa um registro Docker compatível com a API Docker Registry V2 (ECR local).

## 🚀 Tecnologias Utilizadas

- **Linguagem**: [Go 1.22](https://go.dev/)
- **Roteador HTTP**: [Go Chi v5](https://github.com/go-chi/chi)
- **AWS SDK**: [AWS SDK for Go v2](https://github.com/aws/aws-sdk-go-v2)
- **Logger**: `log/slog` (Structured Logging nativo do Go)
- **Containerização**: Docker & Docker Compose

## 📂 Estrutura de Diretórios

```
├── cmd/
│   └── server/
│       └── main.go          # Ponto de entrada do servidor Go
├── internal/
│   ├── api/                 # Rotas HTTP, middlewares de CORS e manipuladores (handlers)
│   ├── client/              # Clientes de integração (AWS SDK e MiniStack Core)
│   ├── config/              # Carregamento de variáveis de ambiente
│   ├── ecr/                 # Implementação de registro Docker Registry V2 e ECR local
│   └── messaging/           # Lógica de negócio para integração com SQS e SNS
├── data/                    # Volume local compartilhado para persistência
├── Dockerfile               # Configuração de build multi-stage para produção
└── docker-compose.yaml      # Definição do ambiente multi-container
```

## 🛠️ Endpoints da API Expostos (`:9091`)

### Geral
- `GET /healthz` - Verifica a saúde do backend do MiniStack.

### Registro Docker (ECR)
- Rotas sob `/v2/` emulando a API Docker Registry V2, permitindo comandos como `docker push` e `docker pull` locais.

### Filas SQS (Simple Queue Service)
- `GET /queues` - Lista todas as filas locais.
- `POST /queues` - Cria uma nova fila SQS.
- `DELETE /queues/{queueUrl}` - Remove uma fila SQS.
- `POST /queues/{queueUrl}/purge` - Limpa todas as mensagens de uma fila.
- `POST /queues/messages` - Envia uma mensagem para uma fila SQS.
- `POST /queues/redrive` - Move mensagens da Dead Letter Queue (DLQ) de volta para a fila principal.

### Tópicos SNS (Simple Notification Service)
- `GET /topics` - Lista todos os tópicos locais.
- `POST /topics` - Cria um novo tópico SNS.
- `DELETE /topics/{topicArn}` - Remove um tópico SNS.
- `POST /topics/{topicArn}/subscriptions` - Inscreve uma fila SQS em um tópico.
- `POST /topics/{topicArn}/publish` - Publica uma mensagem em um tópico.

## ⚙️ Configurações (Variáveis de Ambiente)

O backend pode ser configurado definindo as seguintes variáveis de ambiente:

| Variável | Descrição | Valor Padrão |
|----------|-----------|--------------|
| `PORT` | Porta onde o servidor HTTP do Go vai rodar | `9091` |
| `MINISTACK_URL` | URL de integração com o emulador AWS (LocalStack/MiniStack) | `http://localhost:4566` |

## 💻 Como Rodar o Projeto

### Pré-requisitos
- [Go 1.22+](https://go.dev/dl/)
- [Docker](https://www.docker.com/) e [Docker Compose](https://docs.docker.com/compose/)

### Usando Docker Compose (Recomendado)

O Docker Compose inicializa tanto o backend Go quanto o container de emulação do MiniStack de forma automatizada:

```bash
docker compose up --build
```

Isso irá:
1. Construir a imagem Docker do backend.
2. Iniciar o container do backend na porta `9091`.
3. Iniciar o container do `ministack` (LocalStack) na porta `4566`.

### Desenvolvimento Local (Modo Go)

Para rodar apenas o backend localmente no seu ambiente de desenvolvimento, certifique-se de que o container do `ministack` ou LocalStack esteja rodando na porta `4566` (ou configure a variável de ambiente `MINISTACK_URL`) e execute:

```bash
# Executar testes unitários e de integração
go test ./...

# Rodar o servidor
go run ./cmd/server
```
