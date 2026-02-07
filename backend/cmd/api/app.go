package api

import (
	"sync"

	"pkg-common/token"
	"showtime-backend/config"
	"showtime-backend/internal/handlers"

	"pkg-common/logger"
)

type Application struct {
	Handlers   handlers.Handlers
	Config     config.Config
	Logger     *logger.Logger
	Wg         sync.WaitGroup
	TokenMaker token.Maker
}
