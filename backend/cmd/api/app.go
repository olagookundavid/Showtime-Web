package api

import (
	"context"
	"sync"

	"pkg-common/token"
	"showtime-backend/config"
	"showtime-backend/internal/handlers"
	"showtime-backend/internal/ports"
	"showtime-backend/internal/services"

	"github.com/robfig/cron"

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
	StorageService     ports.StorageService
	ImageGCService     *services.ImageGCService

	// Cron is the background scheduler. CronCancel cancels the context shared by
	// all scheduled jobs. Both are stopped during shutdown, before the DB pool is
	// closed, so an in-flight job can't hold a connection and hang pool.Close().
	Cron       *cron.Cron
	CronCancel context.CancelFunc
}
