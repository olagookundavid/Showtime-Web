package api

import (
	"sync"

	"pkg-common/token"
	"showtime-backend/config"
	"showtime-backend/internal/handlers"
	"showtime-backend/internal/services"

	"pkg-common/logger"
)

type Application struct {
	Handlers           handlers.Handlers
	Config             config.Config
	Logger             *logger.Logger
	Wg                 sync.WaitGroup
	TokenMaker         token.Maker
	AuditService       services.IAuditService
	AuthService        services.IAuthService
	TeamManagerService services.ITeamManagerService
	TicketService      *services.TicketService
}
