package handlers

import (
	"showtime-backend/internal/transport"
)

type Handlers struct {
	AuthHandler                 transport.IAuthHandler
	NewsHandler                 transport.INewsHandler
	GalleryHandler              transport.IGalleryHandler
	MatchHandler                transport.IMatchHandler
	PlayerHandler               transport.IPlayerHandler
	TicketHandler               transport.ITicketHandler
	TeamManagerHandler          transport.ITeamManagerHandler
	AnalyticsHandler            transport.IAnalyticsHandler
	TeamTicketAllocationHandler transport.ITeamTicketAllocationHandler
	StatsHandler                transport.IStatsHandler
	InventoryHandler            transport.IInventoryHandler
	UploadHandler               transport.IUploadHandler
	TOTWHandler                 transport.ITOTWHandler
	StoreHandler                transport.IStoreHandler
	ImportHandler               transport.IImportHandler
	HeroSlideHandler            transport.IHeroSlideHandler
	SeasonHandler               transport.ISeasonHandler
	PlayHandler                 transport.IPlayHandler
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
	teamTicketAllocationHandler transport.ITeamTicketAllocationHandler,
	statsHandler transport.IStatsHandler,
	inventoryHandler transport.IInventoryHandler,
	uploadHandler transport.IUploadHandler,
	totwHandler transport.ITOTWHandler,
	storeHandler transport.IStoreHandler,
	importHandler transport.IImportHandler,
	heroSlideHandler transport.IHeroSlideHandler,
	seasonHandler transport.ISeasonHandler,
	playHandler transport.IPlayHandler,
) Handlers {
	return Handlers{
		AuthHandler:                 authHandler,
		NewsHandler:                 newsHandler,
		GalleryHandler:              galleryHandler,
		MatchHandler:                matchHandler,
		PlayerHandler:               playerHandler,
		TicketHandler:               ticketHandler,
		TeamManagerHandler:          teamManagerHandler,
		AnalyticsHandler:            analyticsHandler,
		TeamTicketAllocationHandler: teamTicketAllocationHandler,
		StatsHandler:                statsHandler,
		InventoryHandler:            inventoryHandler,
		UploadHandler:               uploadHandler,
		TOTWHandler:                 totwHandler,
		StoreHandler:                storeHandler,
		ImportHandler:               importHandler,
		HeroSlideHandler:            heroSlideHandler,
		SeasonHandler:               seasonHandler,
		PlayHandler:                 playHandler,
	}
}

