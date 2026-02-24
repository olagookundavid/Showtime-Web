package handlers

import (
	"showtime-backend/internal/transport"
)

type Handlers struct {
	// AuthHandler       transport.IAdminAuthHandler
	NewsHandler    transport.INewsHandler
	GalleryHandler transport.IGalleryHandler
	MatchHandler   *transport.MatchHandler
	PlayerHandler  *transport.PlayerHandler
	TicketHandler  *transport.TicketHandler
}

func NewHandlers(
	newsHandler transport.INewsHandler,
	galleryHandler transport.IGalleryHandler,
	matchHandler *transport.MatchHandler,
	playerHandler *transport.PlayerHandler,
	ticketHandler *transport.TicketHandler,
) Handlers {
	return Handlers{
		// AuthHandler:       authHandler,
		NewsHandler:    newsHandler,
		GalleryHandler: galleryHandler,
		MatchHandler:   matchHandler,
		PlayerHandler:  playerHandler,
		TicketHandler:  ticketHandler,
	}
}
