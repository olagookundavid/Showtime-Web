FROM golang:1.25-alpine AS builder

# Copy dependencies first -> Download dependencies -> Copy source code -> Build
WORKDIR /app
RUN apk add --no-cache git ca-certificates tzdata

# Install swag for Swagger generation (pinned for reproducible builds)
RUN go install github.com/swaggo/swag/cmd/swag@v1.16.4

# 1. Copy dependencies first
COPY go.work go.work.sum ./
COPY backend/go.mod backend/go.sum ./backend/
COPY pkg-common/go.mod pkg-common/go.sum ./pkg-common/

# 2. Download dependencies
WORKDIR /app/backend
RUN go mod download

# 3. Copy source code
WORKDIR /app
COPY backend/ backend/
COPY pkg-common/ pkg-common/

# 4. Build app
WORKDIR /app/backend
RUN swag init -g cmd/main/main.go

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w" -o /app/server ./cmd/main

FROM alpine:3.20

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata wget \
    && adduser -D -u 10001 appuser

COPY --from=builder /app/server .

# Drop root — the server binds 8080 (>1024), so no privileged port is needed.
USER appuser

EXPOSE 8080

# Liveness probe for the platform/load balancer.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:8080/healthcheck || exit 1

CMD ["./server"]


# Source: https://gemini.google.com/app/d282af44c71eec51