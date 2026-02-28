# Use the official Golang Alpine image as a builder
FROM golang:alpine AS builder

# Set the working directory inside the container
WORKDIR /app

# Install git and required build tools
RUN apk add --no-cache git tzdata ca-certificates

# Copy the Go workspace files
COPY go.work go.work.sum ./

# Copy the backend and the local shared package dependencies
COPY backend/ ./backend/
COPY pkg-common/ ./pkg-common/

# Build the application from the backend directory
WORKDIR /app/backend
# Download module dependencies
RUN go mod download

# Compile the Go application statically
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o /app/server ./cmd/main

# Use a minimal alpine image for the final stage
FROM alpine:latest

# Add CA certificates (needed for external API calls like Resend/Paystack)
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# Copy the compiled binary from the builder stage
COPY --from=builder /app/server /app/server

# Expose the default port
EXPOSE 8089

# Run the binary execution command
CMD ["/app/server"]
