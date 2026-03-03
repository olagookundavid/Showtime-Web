package handlers

import (
	"showtime-backend/internal/transport"
)

type Handlers struct {
	AuthHandler        transport.IAuthHandler
	NewsHandler        transport.INewsHandler
	GalleryHandler     transport.IGalleryHandler
	MatchHandler       transport.IMatchHandler
	PlayerHandler      transport.IPlayerHandler
	TicketHandler      transport.ITicketHandler
	TeamManagerHandler transport.ITeamManagerHandler
	AnalyticsHandler   transport.IAnalyticsHandler
}

func NewHandlers(
	authHandler transport.IAuthHandler,
	newsHandler transport.INewsHandler,
	galleryHandler transport.IGalleryHandler,
	matchHandler transport.IMatchHandler,
	playerHandler transport.IPlayerHandler,
	ticketHandler transport.ITicketHandler,
	teamManagerHandler transport.ITeamManagerHandler,
	analyticsHandler transport.IAnalyticsHandler,
) Handlers {
	return Handlers{
		AuthHandler:        authHandler,
		NewsHandler:        newsHandler,
		GalleryHandler:     galleryHandler,
		MatchHandler:       matchHandler,
		PlayerHandler:      playerHandler,
		TicketHandler:      ticketHandler,
		TeamManagerHandler: teamManagerHandler,
		AnalyticsHandler:   analyticsHandler,
	}
}
