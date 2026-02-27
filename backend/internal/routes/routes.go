package routes

import (
	"expvar"
	"pkg-common/commonAuth"

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
		// 2. Allow Origin function to handle dynamic localhost ports
		AllowOriginFunc:  helpers.AllowLocalHost,
		AllowMethods:     []string{"GET", "POST", "OPTIONS", "PUT", "DELETE"},
		AllowHeaders:     []string{"Content-Type", "Authorization"},
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
	// Require valid token AND admin role
	adminRoutes.Use(commonAuth.TokenMiddleware(app.TokenMaker), middlewares.AdminOnlyMiddleware(app.AuthService))

	usersGroup := adminRoutes.Group("/users")
	{
		usersGroup.GET("", app.Handlers.AuthHandler.GetUsers)
		usersGroup.PUT("/:id", app.Handlers.AuthHandler.UpdateUserInfo)
		usersGroup.PUT("/:id/role", app.Handlers.AuthHandler.UpdateUserRole)
	}

	teamsGroup := adminRoutes.Group("/teams")
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
	{
		compGroup.GET("", app.Handlers.MatchHandler.GetCompetitions)
		compGroup.POST("", app.Handlers.MatchHandler.CreateCompetition)
		compGroup.PUT("/:id", app.Handlers.MatchHandler.UpdateCompetition)
		compGroup.DELETE("/:id", app.Handlers.MatchHandler.DeleteCompetition)
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
}

func SetupAuthRoutes(r *gin.RouterGroup, app *api.Application) {
	authRoutes := r.Group("/auth")
	{
		authRoutes.POST("/register", app.Handlers.AuthHandler.Register)
		authRoutes.POST("/login", app.Handlers.AuthHandler.Login)
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
		newsRoutes.POST("", app.Handlers.NewsHandler.CreateNews)
		newsRoutes.GET("", app.Handlers.NewsHandler.GetNews)
		newsRoutes.GET("/:id", app.Handlers.NewsHandler.GetNewsByID)
		newsRoutes.PUT("/:id", app.Handlers.NewsHandler.UpdateNews)
		newsRoutes.DELETE("/:id", app.Handlers.NewsHandler.DeleteNews)
	}
}

func SetupGalleryRoutes(r *gin.RouterGroup, app *api.Application) {
	galleryRoutes := r.Group("/gallery")
	{
		galleryRoutes.POST("", app.Handlers.GalleryHandler.CreateGallery)
		galleryRoutes.GET("", app.Handlers.GalleryHandler.GetGallery)
		galleryRoutes.GET("/:id", app.Handlers.GalleryHandler.GetGalleryByID)
		galleryRoutes.PUT("/:id", app.Handlers.GalleryHandler.UpdateGallery)
		galleryRoutes.DELETE("/:id", app.Handlers.GalleryHandler.DeleteGallery)
	}
}

func SetupMatchRoutes(r *gin.RouterGroup, app *api.Application) {
	matchRoutes := r.Group("/matches")
	{
		matchRoutes.GET("/competitions", app.Handlers.MatchHandler.GetCompetitions)
		matchRoutes.GET("", app.Handlers.MatchHandler.GetMatches)
		matchRoutes.GET("/standings", app.Handlers.MatchHandler.GetStandings)
		matchRoutes.GET("/teams", app.Handlers.MatchHandler.GetAllTeams)
		matchRoutes.POST("", app.Handlers.MatchHandler.CreateMatch)
		matchRoutes.PUT("/:id", app.Handlers.MatchHandler.UpdateMatch)
		matchRoutes.DELETE("/:id", app.Handlers.MatchHandler.DeleteMatch)
		matchRoutes.POST("/standings", app.Handlers.MatchHandler.CreateStanding)
		matchRoutes.PUT("/standings/:id", app.Handlers.MatchHandler.UpdateStanding)
		matchRoutes.DELETE("/standings/:id", app.Handlers.MatchHandler.DeleteStanding)
	}
}

func SetupPlayerRoutes(r *gin.RouterGroup, app *api.Application) {
	playerRoutes := r.Group("/players")
	{
		playerRoutes.GET("", app.Handlers.PlayerHandler.GetPlayers)
		playerRoutes.GET("/:id", app.Handlers.PlayerHandler.GetPlayerByID)
		playerRoutes.POST("", app.Handlers.PlayerHandler.CreatePlayer)
		playerRoutes.PUT("/:id", app.Handlers.PlayerHandler.UpdatePlayer)
		playerRoutes.DELETE("/:id", app.Handlers.PlayerHandler.DeletePlayer)
	}
}

func SetupTicketRoutes(r *gin.RouterGroup, app *api.Application) {
	// Event Day routes
	eventDayRoutes := r.Group("/event-days")
	{
		eventDayRoutes.GET("", app.Handlers.TicketHandler.ListEventDays)
		eventDayRoutes.GET("/all", app.Handlers.TicketHandler.ListAllEventDays)
		eventDayRoutes.GET("/:id", app.Handlers.TicketHandler.GetEventDay)
		eventDayRoutes.GET("/by-date/:date", app.Handlers.TicketHandler.GetEventDayByDate)
		eventDayRoutes.POST("", app.Handlers.TicketHandler.CreateEventDay)
		eventDayRoutes.PUT("/:id", app.Handlers.TicketHandler.UpdateEventDay)
		eventDayRoutes.DELETE("/:id", app.Handlers.TicketHandler.DeleteEventDay)
		eventDayRoutes.POST("/:id/tiers", app.Handlers.TicketHandler.CreateTier)
	}

	// Ticket routes
	ticketRoutes := r.Group("/tickets")
	{
		ticketRoutes.POST("/purchase", app.Handlers.TicketHandler.Purchase)
		ticketRoutes.POST("/webhook", app.Handlers.TicketHandler.Webhook)
		ticketRoutes.GET("/search", app.Handlers.TicketHandler.SearchByEmail)
		ticketRoutes.POST("/verify/:reference", app.Handlers.TicketHandler.VerifyTicket)
		ticketRoutes.POST("/:id/admin-checkin", app.Handlers.TicketHandler.AdminCheckin)
		ticketRoutes.GET("/:reference", app.Handlers.TicketHandler.GetTicket)
		ticketRoutes.GET("/lookup/:code", app.Handlers.TicketHandler.LookupByCode)
		ticketRoutes.GET("", app.Handlers.TicketHandler.ListTickets)
		ticketRoutes.POST("/:id/checkin", app.Handlers.TicketHandler.Checkin)
	}
}
