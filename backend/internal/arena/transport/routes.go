package transport

import (
	showtime "showtime-backend/internal/domain"
	"showtime-backend/internal/middlewares"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// Register mounts every Arena endpoint under /arena on the API group. auth is the
// token middleware; roles decides what each signed-in person may do.
func (h *Handler) Register(v1 *gin.RouterGroup, auth gin.HandlerFunc, roles services.IRoleService) {
	g := v1.Group("/arena")

	// Public: anyone can read the competition.
	g.GET("/scope", h.Scope)
	g.GET("/overview", h.Overview)
	g.GET("/standings", h.Standings)
	g.GET("/matches", h.Matches)
	g.GET("/matches/:id", h.MatchDetail)
	g.GET("/clubs", h.Clubs)
	g.GET("/clubs/:slug", h.ClubProfile)
	g.GET("/players", h.PlayerStats)
	g.GET("/players/:id", h.PlayerProfile)
	g.GET("/bracket", h.Bracket)
	g.GET("/seasons", h.Seasons)
	g.GET("/formations", h.Formations)

	// Signed in: the caller's own profile, club and contracts.
	me := g.Group("/me", auth)
	{
		me.GET("", h.Me)
		me.POST("/player", h.CreateMyPlayer)
		me.PUT("/player", h.UpdateMyPlayer)
		me.PUT("/follow", h.Follow)
		me.DELETE("/follow", h.Unfollow)
		me.GET("/contracts", h.MyContracts)
		me.GET("/contracts/:id", h.MyContract)
		me.POST("/contracts/:id/sign", h.SignContract)
		me.POST("/contracts/:id/reject", h.RejectContract)
	}

	// Club managers: transfers for their own club.
	manage := g.Group("/manage", auth)
	{
		own := manage.Group("", ManagerScope(h.svc, roles, false))
		own.GET("/contracts", h.ManageContracts)
		own.GET("/contracts/:id", h.ManageContract)
		own.POST("/contracts", h.MakeOffer)
		own.POST("/contracts/:id/withdraw", h.WithdrawOffer)
		own.POST("/contracts/:id/approve-release", h.ApproveRelease)
		own.POST("/contracts/:id/decline-release", h.DeclineRelease)
		own.GET("/free-agents", h.FreeAgents)
		own.GET("/players/search", h.SearchPlayers)

		// Club info and team sheets: staff with full club access may act for any
		// club with ?club_id=.
		club := manage.Group("", ManagerScope(h.svc, roles, true))
		club.GET("/club", h.ManageClub)
		club.GET("/fixtures", h.ManageFixtures)
		club.GET("/teamsheets/:matchId", h.GetSheet)
		club.PUT("/teamsheets/:matchId", h.SaveSheet)
		club.POST("/teamsheets/:matchId/reopen", h.ReopenSheet)
		club.POST("/teamsheets/autopick", h.AutoPickSheet)
	}

	// Staff. Each group is one feature in the roles page.
	admin := g.Group("/admin", auth)
	{
		seasons := admin.Group("", middlewares.FeatureAccessMiddleware(roles, showtime.FeatureArenaSeasons))
		seasons.GET("/seasons", h.AdminSeasons)
		seasons.POST("/seasons", h.AdminCreateSeason)
		seasons.GET("/seasons/:id", h.AdminSeason)
		seasons.PUT("/seasons/:id", h.AdminUpdateSeason)
		seasons.POST("/seasons/:id/status", h.AdminSeasonStatus)
		seasons.POST("/seasons/:id/window", h.AdminTransferWindow)
		seasons.POST("/seasons/:id/divisions", h.AdminCreateDivision)
		seasons.PUT("/divisions/:id", h.AdminUpdateDivision)
		seasons.DELETE("/divisions/:id", h.AdminDeleteDivision)
		seasons.PUT("/divisions/:id/clubs", h.AdminDivisionClubs)
		seasons.POST("/divisions/:id/fixtures/preview", h.AdminPreviewFixtures)
		seasons.POST("/divisions/:id/fixtures", h.AdminGenerateFixtures)
		seasons.DELETE("/divisions/:id/fixtures", h.AdminDeleteFixtures)
		seasons.POST("/divisions/:id/playoffs", h.AdminGeneratePlayoffs)
		seasons.PUT("/matches/:id/schedule", h.AdminReschedule)

		clubs := admin.Group("", middlewares.FeatureAccessMiddleware(roles, showtime.FeatureArenaClubs))
		clubs.GET("/clubs", h.AdminClubs)
		clubs.POST("/clubs", h.AdminCreateClub)
		clubs.GET("/clubs/:id", h.AdminClub)
		clubs.PUT("/clubs/:id", h.AdminUpdateClub)
		clubs.POST("/clubs/:id/archive", h.AdminArchiveClub)
		clubs.DELETE("/clubs/:id", h.AdminDeleteClub)
		clubs.PUT("/clubs/:id/manager", h.AdminClubManager)
		clubs.GET("/players", h.AdminPlayers)
		clubs.POST("/players", h.AdminCreatePlayer)
		clubs.GET("/players/:id", h.AdminPlayer)
		clubs.PUT("/players/:id", h.AdminUpdatePlayer)
		clubs.DELETE("/players/:id", h.AdminDeletePlayer)
		clubs.PUT("/players/:id/user", h.AdminLinkPlayer)
		clubs.POST("/players/:id/register", h.AdminRegisterPlayer)
		clubs.POST("/players/:id/release", h.AdminReleasePlayer)

		results := admin.Group("", middlewares.FeatureAccessMiddleware(roles, showtime.FeatureArenaResults))
		results.GET("/matches/:id/result-form", h.AdminResultForm)
		results.PUT("/matches/:id/result", h.AdminRecordResult)
		results.DELETE("/matches/:id/result", h.AdminClearResult)

		transfers := admin.Group("", middlewares.FeatureAccessMiddleware(roles, showtime.FeatureArenaTransfers))
		transfers.GET("/contracts", h.AdminContracts)
		transfers.GET("/contracts/:id", h.AdminContract)
		transfers.POST("/contracts/:id/withdraw", h.AdminWithdrawContract)
	}
}
