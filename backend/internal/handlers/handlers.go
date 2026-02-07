package handlers

import (
	"showtime-backend/internal/transport"
)

type Handlers struct {
	// AuthHandler       transport.IAdminAuthHandler
	ExampleHandler transport.IExampleHandler
}

func NewHandlers(
	exampleHandler transport.IExampleHandler,
) Handlers {
	return Handlers{
		// AuthHandler:       authHandler,
		ExampleHandler: exampleHandler,
	}
}
