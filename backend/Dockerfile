FROM golang:1.22-alpine AS builder

WORKDIR /app

# Copy everything and let go mod tidy handle dependencies
COPY . .
RUN go mod tidy
RUN CGO_ENABLED=0 GOOS=linux go build -o server ./cmd/server

FROM alpine:latest

WORKDIR /root/

COPY --from=builder /app/server .

EXPOSE 9091

CMD ["./server"]
