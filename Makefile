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
run/service: service/swag
	@echo 'Starting server...'
	@cd backend/ && go run ./cmd/main

## test: run all tests
test: service/mocks
	@echo 'Running tests...'
	@cd backend/ && go test -v ./tests/...

## run/frontend: run the frontend application
run/frontend:
	@echo 'Starting frontend...'
	@cd frontend/ && npm run dev

# ==================================================================================== # 
# DATABASE MIGRATIONS 
# ==================================================================================== #

include backend/.env

## db/status: check migration status
db/status:
	@cd backend/ && goose -dir internal/sql/migrations postgres $(DB_URL) status

## db/up: run up migrations
db/up:
	@cd backend/ && goose -dir internal/sql/migrations postgres $(DB_URL) up

## db/down: run down migrations
db/down:
	@cd backend/ && goose -dir internal/sql/migrations postgres $(DB_URL) down

	@cd backend/ && goose -dir internal/sql/migrations create ${name} sql

## seed/match-hub: seed match hub data
seed/match-hub:
	@echo 'Seeding Match Hub data...'
	@go run backend/cmd/seeder/main.go