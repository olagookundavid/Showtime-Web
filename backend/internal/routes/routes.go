package routes

import (
	"expvar"
	"os"

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

	r.Use(cors.New(helpers.BuildCORSConfig()))

	r.NoRoute(helpers.NotFoundResponse)
	r.NoMethod(helpers.MethodNotAllowedResponse)
	// Swagger publishes the full API surface; keep it off in production.
	if os.Getenv("IS_PROD") != "true" {
		r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
	}
	r.MaxMultipartMemory = 32 << 20 // 32 MB

	// Root endpoints. HEAD is registered too so uptime monitors that probe with
	// HEAD (e.g. UptimeRobot's default) get 200, not a NoRoute 404.
	r.GET("/healthcheck", helpers.HealthcheckHandler(app.Config.Env))
	r.HEAD("/healthcheck", helpers.HealthcheckHandler(app.Config.Env))
	// expvar exposes runtime internals (and can leak command-line flags such as
	// the DB DSN / token key) — lock it behind admin auth instead of public.
	debugGroup := r.Group("/debug", commonAuth.TokenMiddleware(app.TokenMaker), middlewares.AdminOnlyMiddleware(app.AuthService))
	debugGroup.GET("/vars", commonAuth.WrapHTTPHandler(expvar.Handler()))

	// Group: /api/v1/
	rls := commonAuth.RateLimitStruct{
		LimiterEnabled: app.Config.Limiter.Enabled,
		Rps:            int(app.Config.Limiter.Rps),
		Burst:          app.Config.Limiter.Burst,
	}
	v1_api := r.Group("/api/v1", commonAuth.RecoverPanic(), middlewares.SecurityHeaders(), commonAuth.RateLimit(rls), commonAuth.Metrics(), middlewares.AuditLoggerMiddleware(app.AuditService))
	{
		v1_api.GET("/healthcheck", helpers.HealthcheckHandler(app.Config.Env))
		v1_api.HEAD("/healthcheck", helpers.HealthcheckHandler(app.Config.Env))
	}

	// Register all subroutes
	SetupAuthRoutes(v1_api, app)
	SetupAdminRoutes(v1_api, app)
	SetupTeamHeadRoutes(v1_api, app)
	SetupNewsRoutes(v1_api, app)
	SetupGalleryRoutes(v1_api, app)
	SetupHeroSlideRoutes(v1_api, app)
	SetupSeasonRoutes(v1_api, app)
	SetupMatchRoutes(v1_api, app)
	SetupPlayerRoutes(v1_api, app)
	SetupTicketRoutes(v1_api, app)
	SetupStatsRoutes(v1_api, app)
	SetupSellerRoutes(v1_api, app)
	SetupUploadRoutes(v1_api, app)
	SetupTOTWRoutes(v1_api, app)
	SetupStoreRoutes(v1_api, app)
	return r
}

func SetupUploadRoutes(r *gin.RouterGroup, app *api.Application) {
	uploadRoutes := r.Group("/upload")
	uploadRoutes.Use(commonAuth.TokenMiddleware(app.TokenMaker), middlewares.RolesAllowedMiddleware(app.AuthService, "admin", "team_head"))
	{
		uploadRoutes.POST("/presign", app.Handlers.UploadHandler.PresignUpload)
		uploadRoutes.DELETE("", app.Handlers.UploadHandler.DeleteUpload)
	}
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
	teamsGroup.Use(middlewares.RolesAllowedMiddleware(app.AuthService, "admin", "referee", "stats"))
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
		compGroup.POST("/:id/bracket", app.Handlers.MatchHandler.GenerateBracket)
		compGroup.DELETE("/:id/bracket", app.Handlers.MatchHandler.ResetBracket)
		// Step 3: per-competition play-by-play scoring rules.
		compGroup.GET("/:id/game-rules", app.Handlers.PlayHandler.GetRules)
		compGroup.PUT("/:id/game-rules", app.Handlers.PlayHandler.UpsertRules)
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

	// Hero slides — open to admin and above. Only the Administrator (gift-ticket)
	// section is reserved for app_admin; everything else an admin can manage.
	heroSlideGroup := adminRoutes.Group("/hero-slides")
	heroSlideGroup.Use(middlewares.AdminOnlyMiddleware(app.AuthService))
	{
		heroSlideGroup.GET("", app.Handlers.HeroSlideHandler.List)
		heroSlideGroup.POST("", app.Handlers.HeroSlideHandler.Create)
		heroSlideGroup.PUT("/:id", app.Handlers.HeroSlideHandler.Update)
		heroSlideGroup.DELETE("/:id", app.Handlers.HeroSlideHandler.Delete)
	}

	// Team of the Season graphics + MVPs — admin/app_admin managed content.
	seasonGroup := adminRoutes.Group("/season")
	seasonGroup.Use(middlewares.AdminOnlyMiddleware(app.AuthService))
	{
		seasonGroup.GET("/graphics", app.Handlers.SeasonHandler.ListGraphics)
		seasonGroup.PUT("/graphics", app.Handlers.SeasonHandler.UpsertGraphic)
		seasonGroup.GET("/mvps", app.Handlers.SeasonHandler.ListMVPsAdmin)
		seasonGroup.POST("/mvps", app.Handlers.SeasonHandler.CreateMVP)
		seasonGroup.PUT("/mvps/:id", app.Handlers.SeasonHandler.UpdateMVP)
		seasonGroup.DELETE("/mvps/:id", app.Handlers.SeasonHandler.DeleteMVP)
	}

	inventoryGroup := adminRoutes.Group("/inventory")
	inventoryGroup.Use(middlewares.AdminOnlyMiddleware(app.AuthService))
	{
		inventoryGroup.GET("/products", app.Handlers.InventoryHandler.ListProducts)
		inventoryGroup.GET("/products/:id", app.Handlers.InventoryHandler.GetProduct)
		inventoryGroup.POST("/products", app.Handlers.InventoryHandler.CreateProduct)
		inventoryGroup.PUT("/products/:id", app.Handlers.InventoryHandler.UpdateProduct)
		inventoryGroup.DELETE("/products/:id", app.Handlers.InventoryHandler.DeleteProduct)
		inventoryGroup.GET("/low-stock", app.Handlers.InventoryHandler.GetLowStockAlerts)
		inventoryGroup.GET("/sales", app.Handlers.InventoryHandler.ListSales)
		inventoryGroup.GET("/reports", app.Handlers.InventoryHandler.GetSalesReport)

		inventoryGroup.GET("/payment-methods", app.Handlers.InventoryHandler.ListPaymentMethods)
		inventoryGroup.POST("/payment-methods", app.Handlers.InventoryHandler.CreatePaymentMethod)
		inventoryGroup.PATCH("/payment-methods/:id/toggle", app.Handlers.InventoryHandler.TogglePaymentMethod)
	}

	adminStoreGroup := adminRoutes.Group("/store")
	adminStoreGroup.Use(middlewares.AdminOnlyMiddleware(app.AuthService))
	{
		adminStoreGroup.GET("/products", app.Handlers.StoreHandler.ListAllStoreProducts)
		adminStoreGroup.GET("/products/:id", app.Handlers.StoreHandler.GetStoreProduct)
		adminStoreGroup.POST("/products", app.Handlers.StoreHandler.CreateStoreProduct)
		adminStoreGroup.PUT("/products/:id", app.Handlers.StoreHandler.UpdateStoreProduct)
		adminStoreGroup.DELETE("/products/:id", app.Handlers.StoreHandler.DeleteStoreProduct)
		adminStoreGroup.POST("/products/:id/variants", app.Handlers.StoreHandler.SaveProductVariants)
		adminStoreGroup.POST("/products/:id/images", app.Handlers.StoreHandler.SaveProductImages)
		adminStoreGroup.GET("/orders", app.Handlers.StoreHandler.ListOrders)
		adminStoreGroup.GET("/orders/:id", app.Handlers.StoreHandler.GetOrder)
		adminStoreGroup.PATCH("/orders/:id/fulfillment", app.Handlers.StoreHandler.UpdateFulfillment)
		adminStoreGroup.POST("/orders/:id/verify", app.Handlers.StoreHandler.VerifyOrder)
		adminStoreGroup.POST("/orders/:id/cancel", app.Handlers.StoreHandler.CancelOrder)
		adminStoreGroup.DELETE("/reviews/:id", app.Handlers.StoreHandler.DeleteProductReview)
	}

	matchesGroup := adminRoutes.Group("/matches")
	matchesGroup.Use(middlewares.RolesAllowedMiddleware(app.AuthService, "admin", "referee", "stats"))
	{
		matchesGroup.POST("", app.Handlers.MatchHandler.CreateMatch)
		matchesGroup.PUT("/:id", app.Handlers.MatchHandler.UpdateMatch)
		matchesGroup.DELETE("/:id", app.Handlers.MatchHandler.DeleteMatch)
		matchesGroup.POST("/:id/team-sheets", app.Handlers.MatchHandler.SaveTeamSheet)
		matchesGroup.GET("/:id/team-sheets", app.Handlers.MatchHandler.GetAdminTeamSheet)
		// Play-by-play entry (Step 1): admin logs plays for a match.
		matchesGroup.GET("/:id/plays", app.Handlers.PlayHandler.ListPlays)
		matchesGroup.POST("/:id/plays", app.Handlers.PlayHandler.CreatePlay)
		matchesGroup.PUT("/:id/plays/:playId", app.Handlers.PlayHandler.UpdatePlay)
		matchesGroup.DELETE("/:id/plays/:playId", app.Handlers.PlayHandler.DeletePlay)
		// Step 2: derive box-score stats from the play log + commit them.
		matchesGroup.GET("/:id/stats-compare", app.Handlers.PlayHandler.CompareStats)
		matchesGroup.POST("/:id/stats-commit", app.Handlers.PlayHandler.CommitStats)
		// Step 3: scoring rules for this match's competition + recompute score.
		matchesGroup.GET("/:id/rules", app.Handlers.PlayHandler.GetMatchRules)
		matchesGroup.POST("/:id/recompute-score", app.Handlers.PlayHandler.RecomputeScore)
		matchesGroup.POST("/:id/import", app.Handlers.ImportHandler.ImportMatch)
		matchesGroup.POST("/standings", app.Handlers.MatchHandler.CreateStanding)
		matchesGroup.PUT("/standings/:id", app.Handlers.MatchHandler.UpdateStanding)
		matchesGroup.DELETE("/standings/:id", app.Handlers.MatchHandler.DeleteStanding)
	}

	playersGroup := adminRoutes.Group("/players")
	playersGroup.Use(middlewares.RolesAllowedMiddleware(app.AuthService, "admin", "referee"))
	{
		playersGroup.POST("", app.Handlers.PlayerHandler.CreatePlayer)
		playersGroup.PUT("/:id", app.Handlers.PlayerHandler.UpdatePlayer)
		playersGroup.DELETE("/:id", app.Handlers.PlayerHandler.DeletePlayer)
	}

	statsGroup := adminRoutes.Group("/stats")
	statsGroup.Use(middlewares.RolesAllowedMiddleware(app.AuthService, "admin", "referee", "stats"))
	{
		statsGroup.POST("/players", app.Handlers.StatsHandler.UpsertPlayerStat)
	}

	eventDaysGroup := adminRoutes.Group("/event-days")
	eventDaysGroup.Use(middlewares.AdminOnlyMiddleware(app.AuthService))
	{
		eventDaysGroup.GET("/all", app.Handlers.TicketHandler.ListAllEventDays)
		eventDaysGroup.POST("", app.Handlers.TicketHandler.CreateEventDay)
		eventDaysGroup.PUT("/:id", app.Handlers.TicketHandler.UpdateEventDay)
		eventDaysGroup.DELETE("/:id", app.Handlers.TicketHandler.DeleteEventDay)
		eventDaysGroup.POST("/:id/tiers", app.Handlers.TicketHandler.CreateTier)
		eventDaysGroup.DELETE("/:id/tiers/:tierId", app.Handlers.TicketHandler.DeleteTier)
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
		ticketsGroup.GET("/referrals", app.Handlers.TicketHandler.ListReferralStats)
	}

	// Administrator section — only App Admins can issue complimentary tickets
	administratorGroup := adminRoutes.Group("/administrator")
	administratorGroup.Use(middlewares.RolesAllowedMiddleware(app.AuthService, "app_admin"))
	{
		administratorGroup.POST("/gift-ticket", app.Handlers.TicketHandler.GiftTicket)
	}

	totwGroup := adminRoutes.Group("/totw")
	totwGroup.Use(middlewares.AdminOnlyMiddleware(app.AuthService))
	{
		totwGroup.POST("", app.Handlers.TOTWHandler.Create)
		totwGroup.DELETE("/:id", app.Handlers.TOTWHandler.Delete)
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
			limitedAuth.POST("/forgot-password", app.Handlers.AuthHandler.SendPasswordResetOTP)
			// reset-password MUST be rate-limited — it's the OTP brute-force surface.
			limitedAuth.POST("/reset-password", app.Handlers.AuthHandler.ResetPassword)
		}

		authRoutes.POST("/logout", app.Handlers.AuthHandler.Logout)
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

func SetupHeroSlideRoutes(r *gin.RouterGroup, app *api.Application) {
	heroSlideRoutes := r.Group("/hero-slides")
	{
		// Public: only active slides for the homepage carousel.
		heroSlideRoutes.GET("", app.Handlers.HeroSlideHandler.ListPublic)
	}
}

func SetupSeasonRoutes(r *gin.RouterGroup, app *api.Application) {
	seasonRoutes := r.Group("/season")
	{
		// Public: the two Team-of-the-Season graphics and the active MVPs.
		seasonRoutes.GET("/graphics", app.Handlers.SeasonHandler.ListGraphics)
		seasonRoutes.GET("/mvps", app.Handlers.SeasonHandler.ListMVPsPublic)
	}
}

func SetupMatchRoutes(r *gin.RouterGroup, app *api.Application) {
	matchRoutes := r.Group("/matches")
	{
		matchRoutes.GET("/competitions", app.Handlers.MatchHandler.GetCompetitions)
		matchRoutes.GET("", app.Handlers.MatchHandler.GetMatches)
		matchRoutes.GET("/:id", app.Handlers.MatchHandler.GetMatchDetail)
		matchRoutes.GET("/:id/plays", app.Handlers.PlayHandler.ListPlays)
		matchRoutes.GET("/standings", app.Handlers.MatchHandler.GetStandings)
		matchRoutes.GET("/teams", app.Handlers.MatchHandler.GetAllTeams)
		matchRoutes.GET("/days", app.Handlers.MatchHandler.GetMatchDays)
		matchRoutes.GET("/eligible-players", app.Handlers.MatchHandler.GetEligiblePlayersForMatchDay)
	}
}

func SetupPlayerRoutes(r *gin.RouterGroup, app *api.Application) {
	playerRoutes := r.Group("/players")
	{
		playerRoutes.GET("", app.Handlers.PlayerHandler.GetPlayers)
		playerRoutes.GET("/:id", app.Handlers.PlayerHandler.GetPlayerByID)
	}
}

func SetupStatsRoutes(r *gin.RouterGroup, app *api.Application) {
	statsRoutes := r.Group("/stats")
	{
		statsRoutes.GET("/players", app.Handlers.StatsHandler.GetPlayerStats)
		statsRoutes.GET("/players/:id", app.Handlers.StatsHandler.GetPlayerStatByID)
		statsRoutes.GET("/teams", app.Handlers.StatsHandler.GetTeamStats)
		statsRoutes.GET("/dates", app.Handlers.StatsHandler.GetStatDates)
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
		ticketRoutes.POST("/referrals", app.Handlers.TicketHandler.CreateReferralCode)
		ticketRoutes.GET("/referrals/lookup", app.Handlers.TicketHandler.LookupReferralByName)
	}
}

func SetupSellerRoutes(r *gin.RouterGroup, app *api.Application) {
	sellerRoutes := r.Group("/seller")
	sellerRoutes.Use(commonAuth.TokenMiddleware(app.TokenMaker), middlewares.RolesAllowedMiddleware(app.AuthService, "admin", "seller"))
	{
		sellerRoutes.POST("/sales", app.Handlers.InventoryHandler.LogSale)
		sellerRoutes.GET("/sales", app.Handlers.InventoryHandler.ListSales)
		sellerRoutes.GET("/products", app.Handlers.InventoryHandler.ListProducts)
		sellerRoutes.GET("/payment-methods", app.Handlers.InventoryHandler.ListPaymentMethods)
	}
}

func SetupTOTWRoutes(r *gin.RouterGroup, app *api.Application) {
	totwRoutes := r.Group("/totw")
	{
		totwRoutes.GET("", app.Handlers.TOTWHandler.GetTOTW)
		totwRoutes.GET("/latest", app.Handlers.TOTWHandler.GetLatestTOTW)
	}
}

func SetupStoreRoutes(r *gin.RouterGroup, app *api.Application) {
	storeRoutes := r.Group("/store")
	{
		storeRoutes.GET("/products", app.Handlers.StoreHandler.ListStoreProducts)
		storeRoutes.GET("/products/:id", app.Handlers.StoreHandler.GetStoreProduct)

		// Stricter limiter on the write/payment endpoints — guards against
		// runaway clients exhausting Paystack quota or spawning orphan orders.
		rls := commonAuth.RateLimitStruct{
			LimiterEnabled: true,
			Rps:            5,
			Burst:          10,
		}
		// OptionalTokenMiddleware lets logged-in customers' user_id be stamped
		// onto orders so they show up in My Orders, while still allowing
		// guest checkouts to go through unauthenticated.
		limited := storeRoutes.Group("", commonAuth.RateLimit(rls), commonAuth.OptionalTokenMiddleware(app.TokenMaker))
		{
			limited.POST("/checkout", app.Handlers.StoreHandler.Checkout)
			limited.POST("/verify", app.Handlers.StoreHandler.VerifyPayment)
		}

		storeRoutes.POST("/webhook", app.Handlers.StoreHandler.Webhook)
		storeRoutes.GET("/orders/by-ref/:reference", app.Handlers.StoreHandler.GetOrderByReference)

		// Public reviews list — anyone can read reviews.
		storeRoutes.GET("/products/:id/reviews", app.Handlers.StoreHandler.ListProductReviews)

		// Authenticated protected customer actions
		protected := storeRoutes.Group("")
		protected.Use(commonAuth.TokenMiddleware(app.TokenMaker))
		{
			protected.GET("/addresses", app.Handlers.StoreHandler.ListSavedAddresses)
			protected.POST("/addresses", app.Handlers.StoreHandler.SaveAddress)
			protected.GET("/orders", app.Handlers.StoreHandler.ListCustomerOrders)
			protected.POST("/products/:id/reviews", app.Handlers.StoreHandler.CreateProductReview)
			protected.GET("/products/:id/reviews/mine", app.Handlers.StoreHandler.GetMyProductReview)
		}
	}
}
