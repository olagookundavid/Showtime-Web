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

	r := gin.New()

	r.Use(gin.Recovery(), cors.New(helpers.BuildCORSConfig()), gin.LoggerWithConfig(gin.LoggerConfig{
		SkipPaths: []string{"/healthcheck", "/api/v1/healthcheck"},
	}))

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
	// SetupGalleryRoutes(v1_api, app) // Disabled gallery
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
	SetupReliveRoutes(v1_api, app)
	SetupLiveRoutes(v1_api, app)
	SetupContractRoutes(v1_api, app)
	SetupTransferRoutes(v1_api, app)
	SetupPlayerPortalRoutes(v1_api, app)
	SetupNotificationRoutes(v1_api, app)
	SetupAppSettingRoutes(v1_api, app)
	SetupClaimRoutes(v1_api, app)
	SetupCommentRoutes(v1_api, app)
	SetupDiscountRoutes(v1_api, app)
	SetupFantasyRoutes(v1_api, app)
	return r
}

// SetupClaimRoutes carries the player account claim flow.
//
// The submit/verify endpoints are unauthenticated by necessity — the whole point is
// that these players have no account yet — so they are rate-limited at the same tier as
// /auth. They are not a security boundary: the team claim code is shared with a whole
// squad and must be assumed public, and everything it exposes (player names, jersey
// numbers, positions) is already on the public roster pages. The actual gate on getting
// a player account is the team manager approving the claim, in SetupTeamHeadRoutes.
func SetupClaimRoutes(r *gin.RouterGroup, app *api.Application) {
	rls := commonAuth.RateLimitStruct{
		LimiterEnabled: true,
		Rps:            5,
		Burst:          10,
	}

	claimRoutes := r.Group("/claim", commonAuth.RateLimit(rls))
	{
		claimRoutes.POST("/verify-code", app.Handlers.ClaimHandler.VerifyCode)
		claimRoutes.POST("/submit", app.Handlers.ClaimHandler.SubmitClaim)
		claimRoutes.POST("/verify-email", app.Handlers.ClaimHandler.VerifyClaimEmail)
	}

	// The claimant's own view of their pending claim. Any signed-in user may call these;
	// they only ever resolve the claim belonging to the token's user.
	claimProtected := r.Group("/claim")
	claimProtected.Use(commonAuth.TokenMiddleware(app.TokenMaker))
	{
		claimProtected.GET("/my-status", app.Handlers.ClaimHandler.GetMyClaim)
		claimProtected.PATCH("/my-photo", app.Handlers.ClaimHandler.UpdateMyClaimPhoto)
		claimProtected.POST("/resend-verification", app.Handlers.ClaimHandler.ResendVerification)
	}
}

// SetupAppSettingRoutes exposes the site-wide display settings. The read is
// public — every visitor needs the app font before (and without) signing in.
// Writes live under /admin.
func SetupAppSettingRoutes(r *gin.RouterGroup, app *api.Application) {
	r.GET("/app-settings", app.Handlers.AppSettingHandler.GetSettings)
}

func SetupUploadRoutes(r *gin.RouterGroup, app *api.Application) {
	uploadRoutes := r.Group("/upload")
	// player_pending is an unapproved account claimant. They need presign access to
	// attach the photo their manager identifies them by; PresignUpload pins their folder
	// to claim-photos so the grant cannot reach the rest of the bucket.
	uploadRoutes.Use(commonAuth.TokenMiddleware(app.TokenMaker), middlewares.RolesAllowedMiddleware(app.AuthService, "admin", "team_head", "player_pending"))
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
		compGroup.GET("/:id/teams", app.Handlers.MatchHandler.GetTeamsByCompetition)
		compGroup.POST("/:id/teams", app.Handlers.MatchHandler.AddTeamToCompetition)
		compGroup.DELETE("/:id/teams/:teamId", app.Handlers.MatchHandler.RemoveTeamFromCompetition)
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
		newsGroup.PUT("/:id/comment-settings", app.Handlers.CommentHandler.UpdateNewsCommentSettings)
	}

	/*
		galleryGroup := adminRoutes.Group("/gallery")
		galleryGroup.Use(middlewares.AdminOnlyMiddleware(app.AuthService))
		{
			galleryGroup.POST("", app.Handlers.GalleryHandler.CreateGallery)
			galleryGroup.PUT("/:id", app.Handlers.GalleryHandler.UpdateGallery)
			galleryGroup.DELETE("/:id", app.Handlers.GalleryHandler.DeleteGallery)
		}
	*/

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
		matchesGroup.POST("/:id/plays/rederive-situations", app.Handlers.PlayHandler.ReDeriveSituations)
		// Play-by-play is locked per match by default; only an admin (not
		// referee/stats, who merely log plays) can unlock it. Audited globally.
		matchesGroup.POST("/:id/pbp-lock", middlewares.AdminOnlyMiddleware(app.AuthService), app.Handlers.PlayHandler.LockPBP)
		matchesGroup.POST("/:id/pbp-unlock", middlewares.AdminOnlyMiddleware(app.AuthService), app.Handlers.PlayHandler.UnlockPBP)
		// Step 2: derive box-score stats from the play log + commit them (app_admin only).
		matchesGroup.GET("/:id/stats-compare", app.Handlers.PlayHandler.CompareStats)
		matchesGroup.POST("/:id/stats-commit", middlewares.RolesAllowedMiddleware(app.AuthService, "app_admin"), app.Handlers.PlayHandler.CommitStats)
		// Step 3: scoring rules for this match's competition + recompute score (commit app_admin only).
		matchesGroup.GET("/:id/rules", app.Handlers.PlayHandler.GetMatchRules)
		matchesGroup.POST("/:id/recompute-score", app.Handlers.PlayHandler.RecomputeScore)
		matchesGroup.POST("/:id/commit-score", middlewares.RolesAllowedMiddleware(app.AuthService, "app_admin"), app.Handlers.PlayHandler.CommitScore)
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
		playersGroup.POST("/assign-jersey-numbers", app.Handlers.PlayerHandler.AssignRandomJerseyNumbers)
	}

	// Manual stat editing is reserved for App Admins (play-by-play is the primary
	// path). Non-app-admins get the read-only stats views only.
	statsGroup := adminRoutes.Group("/stats")
	statsGroup.Use(middlewares.RolesAllowedMiddleware(app.AuthService, "app_admin"))
	{
		statsGroup.POST("/players", app.Handlers.StatsHandler.UpsertPlayerStat)
		// Bulk re-derive of stats for every match that has a play log — the way a
		// derivation change (new stat columns, corrected rule) lands everywhere at
		// once. Stats only; never touches scores or standings. Supports
		// ?dry_run=true and ?competition_id=.
		statsGroup.POST("/recompute-all", app.Handlers.PlayHandler.RecomputeAllStats)
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

	adminContracts := adminRoutes.Group("/contracts")
	adminContracts.Use(middlewares.AdminOnlyMiddleware(app.AuthService))
	{
		adminContracts.GET("", app.Handlers.ContractHandler.GetTeamContracts)
		adminContracts.GET("/:id", app.Handlers.ContractHandler.GetContractByID)
		adminContracts.PUT("/:id/override", app.Handlers.ContractHandler.AdminOverrideContract)
		adminContracts.POST("/:id/force-accept", app.Handlers.ContractHandler.AdminForceAcceptContract)
	}

	adminTransfers := adminRoutes.Group("/transfers")
	adminTransfers.Use(middlewares.AdminOnlyMiddleware(app.AuthService))
	{
		adminTransfers.GET("", app.Handlers.TransferHandler.GetTeamTransfers)
		adminTransfers.GET("/:id", app.Handlers.TransferHandler.GetTransferByID)
		adminTransfers.PUT("/:id/override", app.Handlers.TransferHandler.AdminOverrideTransfer)
	}

	adminWindows := adminRoutes.Group("/transfer-windows")
	adminWindows.Use(middlewares.AdminOnlyMiddleware(app.AuthService))
	{
		adminWindows.GET("", app.Handlers.TransferHandler.GetAllWindows)
		adminWindows.POST("", app.Handlers.TransferHandler.CreateWindow)
		adminWindows.PUT("/:id", app.Handlers.TransferHandler.UpdateWindow)
		adminWindows.DELETE("/:id", app.Handlers.TransferHandler.DeleteWindow)
	}

	adminSettings := adminRoutes.Group("/app-settings")
	adminSettings.Use(middlewares.AdminOnlyMiddleware(app.AuthService))
	{
		adminSettings.PUT("/font", app.Handlers.AppSettingHandler.UpdateAppFont)
	}

	// Live stream control — read the current state (including what auto
	// detection sees) and force the hero on or off.
	adminLive := adminRoutes.Group("/live")
	adminLive.Use(middlewares.AdminOnlyMiddleware(app.AuthService))
	{
		adminLive.GET("", app.Handlers.LiveHandler.GetAdminStatus)
		adminLive.PUT("", app.Handlers.LiveHandler.UpdateOverride)
	}

	adminBudgets := adminRoutes.Group("/team-budgets")
	adminBudgets.Use(middlewares.AdminOnlyMiddleware(app.AuthService))
	{
		adminBudgets.GET("", app.Handlers.TransferHandler.GetAllTeamBudgets)
		adminBudgets.PUT("/:teamId", app.Handlers.TransferHandler.AdminAdjustBudget)
		adminBudgets.POST("/seed", app.Handlers.TransferHandler.AdminSeedBudgets)
	}

	// Cross-team oversight of the claim flow. Same approve/reject as a team head, plus
	// revoke — the escape hatch for an approval that turns out to be the wrong person.
	adminClaims := adminRoutes.Group("/claims")
	adminClaims.Use(middlewares.AdminOnlyMiddleware(app.AuthService))
	{
		adminClaims.GET("", app.Handlers.ClaimHandler.ListClaims)
		adminClaims.POST("/:id/approve", app.Handlers.ClaimHandler.ApproveClaim)
		adminClaims.POST("/:id/reject", app.Handlers.ClaimHandler.RejectClaim)
		adminClaims.POST("/:id/revoke", app.Handlers.ClaimHandler.RevokeClaim)
	}

	adminClaimCodes := adminRoutes.Group("/claim-codes")
	adminClaimCodes.Use(middlewares.AdminOnlyMiddleware(app.AuthService))
	{
		adminClaimCodes.GET("", app.Handlers.ClaimHandler.ListClaimCodes)
		adminClaimCodes.POST("", app.Handlers.ClaimHandler.CreateClaimCode)
		adminClaimCodes.DELETE("/:id", app.Handlers.ClaimHandler.RevokeClaimCode)
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
	thRoutes.POST("/players/assign-jersey-numbers", app.Handlers.PlayerHandler.AssignRandomJerseyNumbers)

	// Allocations
	thRoutes.GET("/allocations", app.Handlers.TeamTicketAllocationHandler.GetTeamAllocations)
	thRoutes.POST("/allocations/issue", app.Handlers.TeamTicketAllocationHandler.IssueTeamTicket)

	// Player account claims. This is where a player account is actually minted: the
	// manager vouching for someone they know personally is the only identity check the
	// system has, because the historical player import carried no contact details.
	// Approvals sit inside the AuditLoggerMiddleware group, so each one is attributable.
	thRoutes.GET("/claims", app.Handlers.ClaimHandler.ListClaims)
	thRoutes.POST("/claims/:id/approve", app.Handlers.ClaimHandler.ApproveClaim)
	thRoutes.POST("/claims/:id/reject", app.Handlers.ClaimHandler.RejectClaim)

	// The code a manager hands to their squad. Generating rotates: the previous code is
	// revoked so a team only ever has one live code.
	thRoutes.GET("/claim-codes", app.Handlers.ClaimHandler.GetMyClaimCode)
	thRoutes.POST("/claim-codes", app.Handlers.ClaimHandler.CreateClaimCode)
	thRoutes.DELETE("/claim-codes/:id", app.Handlers.ClaimHandler.RevokeClaimCode)
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
		newsRoutes.GET("/slug/:slug", app.Handlers.NewsHandler.GetNewsBySlug)
		newsRoutes.GET("/:id", app.Handlers.NewsHandler.GetNewsByID)
	}
}

func SetupGalleryRoutes(r *gin.RouterGroup, app *api.Application) {
	/*
		galleryRoutes := r.Group("/gallery")
		{
			galleryRoutes.GET("", app.Handlers.GalleryHandler.GetGallery)
			galleryRoutes.GET("/:id", app.Handlers.GalleryHandler.GetGalleryByID)
		}
	*/
}

func SetupHeroSlideRoutes(r *gin.RouterGroup, app *api.Application) {
	heroSlideRoutes := r.Group("/hero-slides")
	{
		// Public: only active slides for the homepage carousel.
		heroSlideRoutes.GET("", app.Handlers.HeroSlideHandler.ListPublic)
	}
}

func SetupReliveRoutes(r *gin.RouterGroup, app *api.Application) {
	reliveRoutes := r.Group("/relive")
	{
		reliveRoutes.GET("", app.Handlers.ReliveHandler.GetRelivePlaylist)
	}
}

// SetupLiveRoutes exposes the live-stream status. The read is public — every
// visitor polls it to decide between the hero carousel and the live player.
func SetupLiveRoutes(r *gin.RouterGroup, app *api.Application) {
	r.GET("/live", app.Handlers.LiveHandler.GetStatus)
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
		matchRoutes.GET("/:id/plays/stream", app.Handlers.PlayHandler.StreamPlays)
		// Box score for the public match page. The equivalent admin route
		// (/admin/matches/:id/stats-compare) is gated to admin/referee/stats, so
		// pointing the public page at it left the stats blank for everyone who
		// wasn't signed in as staff — while the play log right beside it, served
		// from this same public group, rendered fine.
		matchRoutes.GET("/:id/stats", app.Handlers.PlayHandler.PublicMatchStats)
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
			// Optional auth: guests still buy tickets, but a signed-in buyer is
			// recognised so members-only discount codes work and the ticket is
			// linked to their account.
			limitedTickets.POST("/purchase", commonAuth.OptionalTokenMiddleware(app.TokenMaker), app.Handlers.TicketHandler.Purchase)
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

func SetupContractRoutes(r *gin.RouterGroup, app *api.Application) {
	contractGroup := r.Group("/contracts")
	contractGroup.Use(commonAuth.TokenMiddleware(app.TokenMaker), middlewares.TeamHeadOrAdminMiddleware(app.AuthService, app.TeamManagerService))
	{
		contractGroup.POST("", app.Handlers.ContractHandler.IssueContract)
		contractGroup.GET("/team", app.Handlers.ContractHandler.GetTeamContracts)
		contractGroup.GET("/free-agents", app.Handlers.ContractHandler.GetFreeAgents)
		contractGroup.GET("/:id", app.Handlers.ContractHandler.GetContractByID)
		contractGroup.POST("/:id/renew", app.Handlers.ContractHandler.RenewContract)
		contractGroup.POST("/:id/cancel", app.Handlers.ContractHandler.CancelContract)
		contractGroup.DELETE("/:id/cancel", app.Handlers.ContractHandler.CancelContract)
		contractGroup.DELETE("/:id/release", app.Handlers.ContractHandler.ReleasePlayer)
	}
}

func SetupTransferRoutes(r *gin.RouterGroup, app *api.Application) {
	transferGroup := r.Group("/transfers")

	// Public window check & player transfer history endpoints
	transferGroup.GET("/window", app.Handlers.TransferHandler.GetActiveWindow)
	transferGroup.GET("/player/:player_id", commonAuth.TokenMiddleware(app.TokenMaker), app.Handlers.TransferHandler.GetPlayerTransfers)

	// Protected transfer operations
	protectedTransfers := transferGroup.Group("")
	protectedTransfers.Use(commonAuth.TokenMiddleware(app.TokenMaker), middlewares.TeamHeadOrAdminMiddleware(app.AuthService, app.TeamManagerService))
	{
		protectedTransfers.POST("/request", app.Handlers.TransferHandler.CreateTransferRequest)
		protectedTransfers.POST("/listing", app.Handlers.TransferHandler.CreatePlayerListing)
		protectedTransfers.POST("/direct-sale", app.Handlers.TransferHandler.CreateDirectSale)
		protectedTransfers.GET("/market", app.Handlers.TransferHandler.GetMarketListings)
		protectedTransfers.GET("/team", app.Handlers.TransferHandler.GetTeamTransfers)
		protectedTransfers.GET("/budget", app.Handlers.TransferHandler.GetTeamBudget)
		protectedTransfers.GET("/:id", app.Handlers.TransferHandler.GetTransferByID)
		protectedTransfers.PUT("/:id/respond", app.Handlers.TransferHandler.RespondToTransfer)
		protectedTransfers.POST("/:id/bid", app.Handlers.TransferHandler.PlaceBid)
		protectedTransfers.PUT("/:id/bids/:bidId/respond", app.Handlers.TransferHandler.RespondToBid)
	}
}

func SetupPlayerPortalRoutes(r *gin.RouterGroup, app *api.Application) {
	ppGroup := r.Group("/player-portal")
	ppGroup.Use(commonAuth.TokenMiddleware(app.TokenMaker), middlewares.RolesAllowedMiddleware(app.AuthService, "player"))
	{
		ppGroup.GET("/contracts", app.Handlers.ContractHandler.GetMyContracts)
		ppGroup.GET("/contracts/:id", app.Handlers.ContractHandler.GetContractByID)
		ppGroup.PUT("/contracts/:id/respond", app.Handlers.ContractHandler.RespondToContract)
		ppGroup.GET("/transfers", app.Handlers.TransferHandler.GetMyTransfers)
	}
}

func SetupNotificationRoutes(r *gin.RouterGroup, app *api.Application) {
	notifGroup := r.Group("/notifications")
	notifGroup.Use(commonAuth.TokenMiddleware(app.TokenMaker))
	{
		notifGroup.GET("", app.Handlers.NotificationHandler.GetUserNotifications)
		notifGroup.GET("/unread-count", app.Handlers.NotificationHandler.GetUnreadCount)
		notifGroup.PUT("/:id/read", app.Handlers.NotificationHandler.MarkAsRead)
		notifGroup.PUT("/read-all", app.Handlers.NotificationHandler.MarkAllAsRead)
	}
}

func SetupDiscountRoutes(r *gin.RouterGroup, app *api.Application) {
	// Public preview. Optional auth because a code can be restricted to
	// signed-in customers, and the preview must reflect the same answer the
	// checkout will give.
	r.POST("/discounts/preview", commonAuth.OptionalTokenMiddleware(app.TokenMaker), app.Handlers.DiscountHandler.Preview)

	// Admin management, alongside the rest of the store administration.
	adminDiscounts := r.Group("/admin/discount-codes")
	adminDiscounts.Use(commonAuth.TokenMiddleware(app.TokenMaker), middlewares.AdminOnlyMiddleware(app.AuthService))
	{
		adminDiscounts.GET("", app.Handlers.DiscountHandler.List)
		adminDiscounts.GET("/targets", app.Handlers.DiscountHandler.ListTargets)
		adminDiscounts.GET("/:id", app.Handlers.DiscountHandler.Get)
		adminDiscounts.POST("", app.Handlers.DiscountHandler.Create)
		adminDiscounts.PUT("/:id", app.Handlers.DiscountHandler.Update)
		adminDiscounts.DELETE("/:id", app.Handlers.DiscountHandler.Delete)
	}
}

func SetupCommentRoutes(r *gin.RouterGroup, app *api.Application) {
	// Public GET comments endpoint (uses OptionalTokenMiddleware so logged in callers get is_liked_by_caller)
	r.GET("/comments", commonAuth.OptionalTokenMiddleware(app.TokenMaker), app.Handlers.CommentHandler.GetComments)

	// Protected comment mutation endpoints (require TokenMiddleware)
	commentGroup := r.Group("/comments")
	commentGroup.Use(commonAuth.TokenMiddleware(app.TokenMaker))
	{
		commentGroup.POST("", app.Handlers.CommentHandler.CreateComment)
		commentGroup.DELETE("/:id", app.Handlers.CommentHandler.DeleteComment)
		commentGroup.POST("/:id/like", app.Handlers.CommentHandler.ToggleLike)
	}
}

func SetupFantasyRoutes(r *gin.RouterGroup, app *api.Application) {
	fantasyRoutes := r.Group("/fantasy")
	{
		// Public Catalog & Leaderboards
		fantasyRoutes.GET("/season", app.Handlers.FantasyHandler.GetActiveSeason)
		fantasyRoutes.GET("/season/:id/gameweeks", app.Handlers.FantasyHandler.GetGameweeks)
		fantasyRoutes.GET("/season/:id/market", app.Handlers.FantasyHandler.ListPlayerMarket)
		fantasyRoutes.GET("/players/:id/gameweek/:gwId/breakdown", app.Handlers.FantasyHandler.GetPlayerBreakdown)
		fantasyRoutes.GET("/leagues/public", app.Handlers.FantasyLeagueHandler.ListPublicLeagues)
		// Optional auth so a signed-in viewer's own rank comes back with the
		// table; anonymous visitors still get the public standings.
		fantasyRoutes.GET("/leagues/:id/leaderboard", commonAuth.OptionalTokenMiddleware(app.TokenMaker), app.Handlers.FantasyLeagueHandler.GetLeaderboard)
		// The terms of a league, read before committing to it. The by-code form
		// covers private leagues, which are never listed.
		fantasyRoutes.GET("/leagues/preview", commonAuth.OptionalTokenMiddleware(app.TokenMaker), app.Handlers.FantasyPayoutHandler.GetLeagueJoinPreviewByCode)
		fantasyRoutes.GET("/leagues/:id/preview", commonAuth.OptionalTokenMiddleware(app.TokenMaker), app.Handlers.FantasyPayoutHandler.GetLeagueJoinPreview)
		fantasyRoutes.GET("/season/:id/leaderboard", commonAuth.OptionalTokenMiddleware(app.TokenMaker), app.Handlers.FantasyLeagueHandler.GetOverallLeaderboard)

		// Webhook (Unauthenticated, HMAC signature validated)
		fantasyRoutes.POST("/leagues/webhook", app.Handlers.FantasyLeagueHandler.LeagueWebhook)

		// Authenticated User Operations
		protected := fantasyRoutes.Group("")
		protected.Use(commonAuth.TokenMiddleware(app.TokenMaker))
		{
			protected.GET("/dashboard", app.Handlers.FantasyHandler.GetDashboard)
			protected.POST("/seasons/:id/enter", app.Handlers.FantasyHandler.EnterSeason)
			protected.POST("/lineups", app.Handlers.FantasyHandler.SaveLineup)
			protected.GET("/lineups/mine", app.Handlers.FantasyHandler.GetMyLineup)

			protected.POST("/leagues", app.Handlers.FantasyLeagueHandler.CreateLeague)
			protected.GET("/leagues/mine", app.Handlers.FantasyLeagueHandler.ListMyLeagues)

			// Stricter limiter on the Paystack-initiating endpoints — guards
			// against runaway clients exhausting Paystack quota or spawning
			// orphan pending memberships.
			rls := commonAuth.RateLimitStruct{
				LimiterEnabled: true,
				Rps:            5,
				Burst:          10,
			}
			limitedLeagues := protected.Group("", commonAuth.RateLimit(rls))
			{
				limitedLeagues.POST("/leagues/join", app.Handlers.FantasyLeagueHandler.JoinLeague)
				limitedLeagues.POST("/leagues/verify", app.Handlers.FantasyLeagueHandler.VerifyLeaguePayment)

				// Withdrawals move real money out, so they sit behind the same
				// stricter limiter as the pay-in endpoints.
				limitedLeagues.POST("/payouts", app.Handlers.FantasyPayoutHandler.RequestPayout)
			}

			protected.GET("/wallet", app.Handlers.FantasyPayoutHandler.GetWallet)
			protected.GET("/payouts", app.Handlers.FantasyPayoutHandler.ListMyPayouts)
			protected.POST("/payouts/:id/cancel", app.Handlers.FantasyPayoutHandler.CancelPayout)
		}
	}

	// Admin Fantasy Operations
	adminFantasy := r.Group("/admin/fantasy")
	adminFantasy.Use(commonAuth.TokenMiddleware(app.TokenMaker), middlewares.AdminOnlyMiddleware(app.AuthService))
	{
		adminFantasy.GET("/seasons", app.Handlers.FantasyHandler.AdminListSeasons)
		adminFantasy.POST("/seasons", app.Handlers.FantasyHandler.AdminCreateSeason)
		adminFantasy.POST("/seasons/:id/activate", app.Handlers.FantasyHandler.AdminActivateSeason)
		adminFantasy.DELETE("/seasons/:id", app.Handlers.FantasyHandler.AdminDeleteSeason)
		adminFantasy.POST("/seasons/:id/gameweeks", app.Handlers.FantasyHandler.AdminCreateGameweek)
		adminFantasy.POST("/seasons/:id/prices/initialize", app.Handlers.FantasyHandler.AdminInitializePrices)
		adminFantasy.POST("/gameweeks/:id/finalize", app.Handlers.FantasyHandler.AdminFinalizeGameweek)
		adminFantasy.POST("/gameweeks/:id/deadline", app.Handlers.FantasyHandler.AdminUpdateGameweekDeadline)

		// Oversight
		adminFantasy.GET("/seasons/:id/overview", app.Handlers.FantasyPayoutHandler.AdminGetOverview)
		adminFantasy.GET("/seasons/:id/managers", app.Handlers.FantasyPayoutHandler.AdminListManagers)
		adminFantasy.GET("/seasons/:id/leagues", app.Handlers.FantasyPayoutHandler.AdminListLeagues)
		adminFantasy.POST("/seasons/:id/settle", app.Handlers.FantasyPayoutHandler.AdminSettleSeason)
		adminFantasy.POST("/seasons/:id/complete", app.Handlers.FantasyPayoutHandler.AdminCompleteSeason)

		// League finance & prize settlement
		adminFantasy.GET("/leagues/:id/finance", app.Handlers.FantasyPayoutHandler.AdminGetLeagueFinance)
		adminFantasy.GET("/leagues/:id/members", app.Handlers.FantasyPayoutHandler.AdminListLeagueMembers)
		adminFantasy.PUT("/leagues/:id/prizes", app.Handlers.FantasyPayoutHandler.AdminSetPrizeStructure)
		adminFantasy.POST("/leagues/:id/settle", app.Handlers.FantasyPayoutHandler.AdminSettleLeague)

		// Payout queue
		adminFantasy.GET("/payouts", app.Handlers.FantasyPayoutHandler.AdminListPayouts)
		adminFantasy.PUT("/payouts/:id/status", app.Handlers.FantasyPayoutHandler.AdminUpdatePayoutStatus)
		adminFantasy.GET("/users/:id/wallet", app.Handlers.FantasyPayoutHandler.AdminGetUserWallet)
	}
}
