# Build stage
FROM golang:1.25.1 AS builder

ARG UID=10001
ARG GID=10001
ARG BINARY_NAME=service-api

WORKDIR /app

# Cache dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy rest of the source
COPY . .

# Build the Go binary (static, no cgo)
RUN CGO_ENABLED=0 GOOS=linux go build -o ${BINARY_NAME} ./cmd/main

# Run stage
FROM alpine:3.21

ARG UID=10001
ARG GID=10001
ARG BINARY_NAME=service-api

WORKDIR /app

# Add user (safer defaults)
RUN addgroup -g ${GID} appgroup && adduser -D -u ${UID} -G appgroup appuser

COPY --from=builder /app/${BINARY_NAME} .

USER appuser

EXPOSE 8080

CMD ["./tradiaApi"]
