package routes

import (
	"expvar"
	"pkg-common/commonAuth"
	"strings"

	"showtime-backend/cmd/api"
	"showtime-backend/internal/middlewares"

	"pkg-common/helpers"

	"github.com/gin-contrib/cors"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	_ "showtime-backend/docs"

	"github.com/gin-gonic/gin"
)

func Routes(app *api.Application) *gin.Engine {

	r := gin.Default()

	allowOrigins := helpers.GetEnvSlice(
		[]string{},
	)

	// Enable CORS globally
	r.Use(cors.New(cors.Config{
		// 1. We are retaining production/staging domains here
		AllowOrigins: allowOrigins,
		// 2. Allow Origin function to handle dynamic localhost ports and Vercel previews
		AllowOriginFunc: func(origin string) bool {
			if helpers.AllowLocalHost(origin) {
				return true
			}
			// Automatically allow Vercel preview environments for staging
			if strings.HasSuffix(origin, ".vercel.app") {
				return true
			}
			return false
		},
		AllowMethods:     []string{"GET", "POST", "OPTIONS", "PUT", "DELETE", "PATCH"},
		AllowHeaders:     []string{"Content-Type", "Authorization", "X-Requested-With"},
		AllowCredentials: true,
	}))

	r.NoRoute(helpers.NotFoundResponse)
	r.NoMethod(helpers.MethodNotAllowedResponse)
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
	r.MaxMultipartMemory = 32 << 20 // 32 MB

	// Root endpoints
	r.GET("/healthcheck", helpers.HealthcheckHandler(app.Config.Env))
	r.GET("/debug/vars", commonAuth.WrapHTTPHandler(expvar.Handler()))

	// Group: /api/v1/
	rls := commonAuth.RateLimitStruct{
		LimiterEnabled: app.Config.Limiter.Enabled,
		Rps:            int(app.Config.Limiter.Rps),
		Burst:          app.Config.Limiter.Burst,
	}
	v1_api := r.Group("/api/v1", commonAuth.RecoverPanic(), commonAuth.RateLimit(rls), commonAuth.Metrics(), middlewares.AuditLoggerMiddleware(app.AuditService))
	{
		v1_api.GET("/healthcheck", helpers.HealthcheckHandler(app.Config.Env))
	}

	// Register all subroutes
	SetupAuthRoutes(v1_api, app)
	SetupAdminRoutes(v1_api, app)
	SetupTeamHeadRoutes(v1_api, app)
	SetupNewsRoutes(v1_api, app)
	SetupGalleryRoutes(v1_api, app)
	SetupMatchRoutes(v1_api, app)
	SetupPlayerRoutes(v1_api, app)
	SetupTicketRoutes(v1_api, app)
	return r
}

func SetupAdminRoutes(r *gin.RouterGroup, app *api.Application) {
	adminRoutes := r.Group("/admin")
	// Require valid token
	adminRoutes.Use(commonAuth.TokenMiddleware(app.TokenMaker))

	usersGroup := adminRoutes.Group("/users")
	usersGroup.Use(middlewares.AdminOnlyMiddleware(app.AuthService))
	{
		usersGroup.GET("", app.Handlers.AuthHandler.GetUsers)
		usersGroup.PUT("/:id", app.Handlers.AuthHandler.UpdateUserInfo)
		usersGroup.PUT("/:id/role", app.Handlers.AuthHandler.UpdateUserRole)
	}

	teamsGroup := adminRoutes.Group("/teams")
	teamsGroup.Use(middlewares.AdminOnlyMiddleware(app.AuthService))
	{
		teamsGroup.GET("", app.Handlers.MatchHandler.GetTeams)
		teamsGroup.GET("/by-competition", app.Handlers.MatchHandler.GetTeamsByCompetition)
		teamsGroup.POST("", app.Handlers.MatchHandler.CreateTeam)
		teamsGroup.PUT("/:id", app.Handlers.MatchHandler.UpdateTeam)
		teamsGroup.DELETE("/:id", app.Handlers.MatchHandler.DeleteTeam)
		teamsGroup.GET("/:id/managers", app.Handlers.TeamManagerHandler.GetManagersForTeam)
		teamsGroup.POST("/:id/manager", app.Handlers.TeamManagerHandler.AssignManager)
		teamsGroup.DELETE("/:id/manager/:user_id", app.Handlers.TeamManagerHandler.RemoveManager)
	}

	compGroup := adminRoutes.Group("/competitions")
	compGroup.Use(middlewares.AdminOnlyMiddleware(app.AuthService))
	{
		compGroup.GET("", app.Handlers.MatchHandler.GetCompetitions)
		compGroup.POST("", app.Handlers.MatchHandler.CreateCompetition)
		compGroup.PUT("/:id", app.Handlers.MatchHandler.UpdateCompetition)
		compGroup.DELETE("/:id", app.Handlers.MatchHandler.DeleteCompetition)
	}

	analyticsGroup := adminRoutes.Group("/analytics")
	analyticsGroup.Use(middlewares.AdminOnlyMiddleware(app.AuthService))
	{
		analyticsGroup.GET("", app.Handlers.AnalyticsHandler.GetAnalytics)
	}

	newsGroup := adminRoutes.Group("/news")
	newsGroup.Use(middlewares.AdminOnlyMiddleware(app.AuthService))
	{
		newsGroup.POST("", app.Handlers.NewsHandler.CreateNews)
		newsGroup.PUT("/:id", app.Handlers.NewsHandler.UpdateNews)
		newsGroup.DELETE("/:id", app.Handlers.NewsHandler.DeleteNews)
	}

	galleryGroup := adminRoutes.Group("/gallery")
	galleryGroup.Use(middlewares.AdminOnlyMiddleware(app.AuthService))
	{
		galleryGroup.POST("", app.Handlers.GalleryHandler.CreateGallery)
		galleryGroup.PUT("/:id", app.Handlers.GalleryHandler.UpdateGallery)
		galleryGroup.DELETE("/:id", app.Handlers.GalleryHandler.DeleteGallery)
	}

	matchesGroup := adminRoutes.Group("/matches")
	matchesGroup.Use(middlewares.AdminOnlyMiddleware(app.AuthService))
	{
		matchesGroup.POST("", app.Handlers.MatchHandler.CreateMatch)
		matchesGroup.PUT("/:id", app.Handlers.MatchHandler.UpdateMatch)
		matchesGroup.DELETE("/:id", app.Handlers.MatchHandler.DeleteMatch)
		matchesGroup.POST("/standings", app.Handlers.MatchHandler.CreateStanding)
		matchesGroup.PUT("/standings/:id", app.Handlers.MatchHandler.UpdateStanding)
		matchesGroup.DELETE("/standings/:id", app.Handlers.MatchHandler.DeleteStanding)
	}

	playersGroup := adminRoutes.Group("/players")
	playersGroup.Use(middlewares.AdminOnlyMiddleware(app.AuthService))
	{
		playersGroup.POST("", app.Handlers.PlayerHandler.CreatePlayer)
		playersGroup.PUT("/:id", app.Handlers.PlayerHandler.UpdatePlayer)
		playersGroup.DELETE("/:id", app.Handlers.PlayerHandler.DeletePlayer)
	}

	eventDaysGroup := adminRoutes.Group("/event-days")
	eventDaysGroup.Use(middlewares.AdminOnlyMiddleware(app.AuthService))
	{
		eventDaysGroup.GET("/all", app.Handlers.TicketHandler.ListAllEventDays)
		eventDaysGroup.POST("", app.Handlers.TicketHandler.CreateEventDay)
		eventDaysGroup.PUT("/:id", app.Handlers.TicketHandler.UpdateEventDay)
		eventDaysGroup.DELETE("/:id", app.Handlers.TicketHandler.DeleteEventDay)
		eventDaysGroup.POST("/:id/tiers", app.Handlers.TicketHandler.CreateTier)
	}

	allocationsGroup := adminRoutes.Group("/allocations")
	allocationsGroup.Use(middlewares.AdminOnlyMiddleware(app.AuthService))
	{
		allocationsGroup.POST("", app.Handlers.TeamTicketAllocationHandler.CreateOrUpdateAllocation)
		allocationsGroup.GET("/event-day/:id", app.Handlers.TeamTicketAllocationHandler.GetAllocationsByEventDay)
		allocationsGroup.DELETE("/:id", app.Handlers.TeamTicketAllocationHandler.DeleteAllocation)
	}

	ticketsGroup := adminRoutes.Group("/tickets")
	ticketsGroup.Use(middlewares.TicketerOrAdminMiddleware(app.AuthService))
	{
		ticketsGroup.POST("/:id/admin-checkin", app.Handlers.TicketHandler.AdminCheckin)
		ticketsGroup.POST("/:id/checkin", app.Handlers.TicketHandler.Checkin)
		ticketsGroup.GET("", app.Handlers.TicketHandler.ListTickets)
		ticketsGroup.GET("/search", app.Handlers.TicketHandler.SearchByEmail)
		ticketsGroup.GET("/lookup/:code", app.Handlers.TicketHandler.LookupByCode)
	}

}

func SetupTeamHeadRoutes(r *gin.RouterGroup, app *api.Application) {
	thRoutes := r.Group("/team-head")
	thRoutes.Use(commonAuth.TokenMiddleware(app.TokenMaker), middlewares.TeamHeadOrAdminMiddleware(app.AuthService, app.TeamManagerService))

	// Get the team head's own team info
	thRoutes.GET("/my-team", app.Handlers.TeamManagerHandler.GetMyTeam)

	// Scoped player management (middleware injects team_id for team_heads)
	thRoutes.GET("/players", app.Handlers.PlayerHandler.GetPlayers)
	thRoutes.GET("/players/:id", app.Handlers.PlayerHandler.GetPlayerByID)
	thRoutes.POST("/players", app.Handlers.PlayerHandler.CreatePlayer)
	thRoutes.PUT("/players/:id", app.Handlers.PlayerHandler.UpdatePlayer)
	thRoutes.DELETE("/players/:id", app.Handlers.PlayerHandler.DeletePlayer)

	// Allocations
	thRoutes.GET("/allocations", app.Handlers.TeamTicketAllocationHandler.GetTeamAllocations)
	thRoutes.POST("/allocations/issue", app.Handlers.TeamTicketAllocationHandler.IssueTeamTicket)
}

func SetupAuthRoutes(r *gin.RouterGroup, app *api.Application) {
	authRoutes := r.Group("/auth")
	{
		rls := commonAuth.RateLimitStruct{
			LimiterEnabled: true,
			Rps:            5,
			Burst:          10,
		}
		limitedAuth := authRoutes.Group("", commonAuth.RateLimit(rls))
		{
			limitedAuth.POST("/register", app.Handlers.AuthHandler.Register)
			limitedAuth.POST("/login", app.Handlers.AuthHandler.Login)
		}

		authRoutes.POST("/logout", app.Handlers.AuthHandler.Logout)
		authRoutes.POST("/reset-password", app.Handlers.AuthHandler.ResetPassword)
	}

	// Authenticated routes
	authProtected := r.Group("/auth")
	authProtected.Use(commonAuth.TokenMiddleware(app.TokenMaker))
	{
		authProtected.GET("/profile", app.Handlers.AuthHandler.ReturnUserProfile)
	}
}

func SetupNewsRoutes(r *gin.RouterGroup, app *api.Application) {
	newsRoutes := r.Group("/news")
	{
		newsRoutes.GET("", app.Handlers.NewsHandler.GetNews)
		newsRoutes.GET("/:id", app.Handlers.NewsHandler.GetNewsByID)
	}
}

func SetupGalleryRoutes(r *gin.RouterGroup, app *api.Application) {
	galleryRoutes := r.Group("/gallery")
	{
		galleryRoutes.GET("", app.Handlers.GalleryHandler.GetGallery)
		galleryRoutes.GET("/:id", app.Handlers.GalleryHandler.GetGalleryByID)
	}
}

func SetupMatchRoutes(r *gin.RouterGroup, app *api.Application) {
	matchRoutes := r.Group("/matches")
	{
		matchRoutes.GET("/competitions", app.Handlers.MatchHandler.GetCompetitions)
		matchRoutes.GET("", app.Handlers.MatchHandler.GetMatches)
		matchRoutes.GET("/standings", app.Handlers.MatchHandler.GetStandings)
		matchRoutes.GET("/teams", app.Handlers.MatchHandler.GetAllTeams)
	}
}

func SetupPlayerRoutes(r *gin.RouterGroup, app *api.Application) {
	playerRoutes := r.Group("/players")
	{
		playerRoutes.GET("", app.Handlers.PlayerHandler.GetPlayers)
		playerRoutes.GET("/:id", app.Handlers.PlayerHandler.GetPlayerByID)
	}
}

func SetupTicketRoutes(r *gin.RouterGroup, app *api.Application) {
	// Event Day routes (Public)
	eventDayRoutes := r.Group("/event-days")
	{
		eventDayRoutes.GET("", app.Handlers.TicketHandler.ListEventDays)
		eventDayRoutes.GET("/:id", app.Handlers.TicketHandler.GetEventDay)
		eventDayRoutes.GET("/by-date/:date", app.Handlers.TicketHandler.GetEventDayByDate)
	}

	// Ticket routes
	ticketRoutes := r.Group("/tickets")
	{
		rls := commonAuth.RateLimitStruct{
			LimiterEnabled: true,
			Rps:            5,
			Burst:          10,
		}

		limitedTickets := ticketRoutes.Group("", commonAuth.RateLimit(rls))
		{
			limitedTickets.POST("/purchase", app.Handlers.TicketHandler.Purchase)
		}

		ticketRoutes.POST("/webhook", app.Handlers.TicketHandler.Webhook)
		ticketRoutes.POST("/verify/:reference", app.Handlers.TicketHandler.VerifyTicket)
		ticketRoutes.GET("/:reference", app.Handlers.TicketHandler.GetTicket)
	}
}
