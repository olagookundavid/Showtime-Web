FROM golang:alpine AS builder

WORKDIR /app
RUN apk add --no-cache git ca-certificates tzdata

# Install swag for Swagger generation
RUN go install github.com/swaggo/swag/cmd/swag@latest

COPY go.work go.work.sum ./

COPY backend/go.mod backend/go.sum ./backend/
COPY pkg-common/go.mod pkg-common/go.sum ./pkg-common/

WORKDIR /app/backend
RUN go mod download

WORKDIR /app
COPY backend/ backend/
COPY pkg-common/ pkg-common/

WORKDIR /app/backend
RUN swag init -g cmd/main/main.go

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w" -o /app/server ./cmd/main

FROM alpine:latest

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /app/server .

EXPOSE 8080

CMD ["./server"]