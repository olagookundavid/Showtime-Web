package handlers

import (
	"showtime-backend/internal/transport"
)

type Handlers struct {
	// AuthHandler       transport.IAdminAuthHandler
	NewsHandler    transport.INewsHandler
	GalleryHandler transport.IGalleryHandler
}

func NewHandlers(
	newsHandler transport.INewsHandler,
	galleryHandler transport.IGalleryHandler,
) Handlers {
	return Handlers{
		// AuthHandler:       authHandler,
		NewsHandler:    newsHandler,
		GalleryHandler: galleryHandler,
	}
}
