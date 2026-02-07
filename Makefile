# ==================================================================================== # 
# HELPERS 
# ==================================================================================== #

## help: print this help message
.PHONY: help confirm service/swag run/service
help: 
	@echo 'Usage:' 
	@sed -n 's/^##//p' ${MAKEFILE_LIST} | column -t -s ':' | sed -e 's/^/ /'


confirm: 
	@echo -n 'Are you sure? [y/N] ' && read ans && [ $${ans:-N} = y ]

# ==================================================================================== # 
# DEVELOPMENT 
# ==================================================================================== #

## run/api: run the cmd/api application 


## service/mocks: generate mocks for the service
service/mocks:
	@echo 'Generating Mocks...'
	@cd backend/ && mockery --name=IExampleService --dir=internal/services --output=internal/services/mocks

## service/swag: generate swagger docs
service/swag:
	@echo 'Generating Swagger Docs...'
	@cd backend/ && swag init -g cmd/main/main.go -o docs

## run/service: run the service application (generates mocks and docs first)
run/service: service/mocks service/swag
	@echo 'Starting server...'
	@cd backend/ && go run ./cmd/main

## test: run all tests
test: service/mocks
	@echo 'Running tests...'
	@cd backend/ && go test -v ./tests/...

# ==================================================================================== # 
# DATABASE MIGRATIONS 
# ==================================================================================== #

## db/status: check migration status
db/status:
	@cd backend/ && goose -dir internal/sql/migrations postgres $(DB_DSN) status

## db/up: run up migrations
db/up:
	@cd backend/ && goose -dir internal/sql/migrations postgres $(DB_DSN) up

## db/down: run down migrations
db/down:
	@cd backend/ && goose -dir internal/sql/migrations postgres $(DB_DSN) down

## db/create name=$1: create a new migration
db/create:
	@echo 'Creating migration file for ${name}...'
	@cd backend/ && goose -dir internal/sql/migrations create ${name} sql