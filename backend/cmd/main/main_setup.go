package main

import (
	"context"
	"database/sql"
	"expvar"
	"flag"
	"fmt"
	"strconv"

	"pkg-common/infrastructure/queue"
	"pkg-common/token"
	"pkg-common/vcs"
	"showtime-backend/cmd/api"
	"showtime-backend/config"
	"showtime-backend/internal/handlers"
	"showtime-backend/internal/ports"
	"showtime-backend/internal/services"
	"showtime-backend/internal/storage"
	"showtime-backend/internal/transport"
	"showtime-backend/pkg/email"

	"pkg-common/logger"

	"github.com/redis/go-redis/v9"

	"os"
	"runtime"
	"time"

	sqlembed "showtime-backend/internal/sql"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
	"github.com/pressly/goose/v3"
	"github.com/robfig/cron"
)

var (
	version = vcs.Version()
)

func expvarSetup() {
	expvar.NewString("version").Set(version)
	expvar.Publish("goroutines", expvar.Func(func() any {
		return runtime.NumGoroutine()
	}))
	expvar.Publish("timestamp", expvar.Func(func() any {
		return time.Now().Unix()
	}))
}

func openDB(cfg config.Config, ctx context.Context) (*pgxpool.Pool, error) {
	poolConfig, err := pgxpool.ParseConfig(cfg.Db.Dsn)
	if err != nil {
		return nil, err
	}

	// Disable prepared statements for compatibility with PgBouncer in transaction mode
	poolConfig.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol

	// Size the pool explicitly. pgxpool defaults to max(4, numCPU) connections,
	// which on a small single instance silently caps throughput exactly when
	// launch-day traffic spikes. Driven by env so it can be tuned against the
	// DB/pooler limit without a redeploy.
	poolConfig.MaxConns = int32(envInt("DB_MAX_CONNS", 20))
	poolConfig.MinConns = int32(envInt("DB_MIN_CONNS", 2))
	poolConfig.MaxConnIdleTime = 5 * time.Minute

	// Opening a connection gets its own deadline, well inside the few seconds a
	// typical query allows itself. Without one, a database that is unreachable
	// rather than slow — a laptop waking from sleep, a network blip — leaves
	// every caller blocked until their own deadline expires, and they all report
	// a query timeout for what is really a connection problem.
	poolConfig.ConnConfig.ConnectTimeout = 5 * time.Second

	// Recycle connections rather than holding them forever. A connection that
	// survived a suspend is often dead on the other side, and the health check
	// is what notices before a caller does.
	poolConfig.MaxConnLifetime = time.Hour
	poolConfig.HealthCheckPeriod = 30 * time.Second

	// Pin session timezone to Lagos so CURRENT_DATE / NOW() match the
	// timezone admins and users expect. Without this, on a UTC-hosted DB
	// (Koyeb default), events would appear/disappear an hour around
	// midnight Lagos time and game-day cut-offs would land on the wrong day.
	poolConfig.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		_, err := conn.Exec(ctx, "SET TIME ZONE 'Africa/Lagos'")
		return err
	}

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, err
	}
	return pool, nil
}

func displayVersion(flagStr string) {
	displayVersion := flag.Bool(flagStr, false, "Display version and exit")
	flag.Parse()
	if *displayVersion {
		fmt.Printf("Version:\t%s\n", version)
		os.Exit(0)
	}
}

func loadDbUrl(log *logger.Logger) string {
	godotenv.Load()
	dbUrl := os.Getenv("DB_URL")
	if dbUrl == "" {
		log.Fatal("DB_URL env variable missing", nil)
	}
	return dbUrl
}

func loadPort() int {
	port, err := strconv.Atoi(os.Getenv("PORT"))
	if err != nil {
		port = 8080
	}
	return port
}

// envInt reads an int env var, falling back to def when unset/invalid.
func envInt(key string, def int) int {
	if v, err := strconv.Atoi(os.Getenv(key)); err == nil {
		return v
	}
	return def
}

// envFloat reads a float env var, falling back to def when unset/invalid.
func envFloat(key string, def float64) float64 {
	if v, err := strconv.ParseFloat(os.Getenv(key), 64); err == nil {
		return v
	}
	return def
}

// envBool reads a bool env var. Only the literal "false" disables; any other
// value (including unset) yields def — so a flag that defaults true stays true
// unless explicitly turned off.
func envBool(key string, def bool) bool {
	switch os.Getenv(key) {
	case "true":
		return true
	case "false":
		return false
	default:
		return def
	}
}

func loadModeEnv() bool {
	godotenv.Load()
	return (os.Getenv("IS_PROD")) == "true"
}

func loadTokenDetails(log *logger.Logger) map[string]string {

	godotenv.Load()
	tokenKey := os.Getenv("TOKEN_KEY")
	accessTokenDuration := os.Getenv("ACCESS_TOKEN_DURATION")

	if tokenKey == "" || accessTokenDuration == "" {
		log.Fatal("Couldn't load token details", nil)
	}
	tokenMap := map[string]string{
		"token_key":             tokenKey,
		"access_token_duration": accessTokenDuration,
	}
	return tokenMap
}

func flagSetup(dbUrl, env string, tokenDeets map[string]string) *config.Config {

	var cfg config.Config

	//env and port
	flag.IntVar(&cfg.Port, "port", loadPort(), "API server port")
	flag.StringVar(&cfg.Env, "env", env, "Environment (dev|prod)")
	//db and settings
	flag.StringVar(&cfg.Db.Dsn, "db-dsn", dbUrl, "PostgreSQL DSN")
	// Rate limiter driven by env so it's actually ON in prod (the previous
	// default of disabled left every non-auth/non-checkout endpoint open to
	// floods on a scale-to-zero instance). Defaults are generous enough that
	// normal users never hit them; the stricter per-route limiters on
	// auth/purchase/checkout still apply on top.
	flag.Float64Var(&cfg.Limiter.Rps, "limiter-rps", envFloat("LIMITER_RPS", 20), "Rate limiter maximum requests per second")
	flag.IntVar(&cfg.Limiter.Burst, "limiter-burst", envInt("LIMITER_BURST", 40), "Rate limiter maximum burst")
	flag.BoolVar(&cfg.Limiter.Enabled, "limiter-enabled", envBool("LIMITER_ENABLED", true), "Enable rate limiter")

	//tokenDeets
	flag.StringVar(&cfg.Token.TokenKey, "token-key", tokenDeets["token_key"], "Token Key")
	flag.StringVar(&cfg.Token.AccessTokenDuration, "access-token-duration", tokenDeets["access_token_duration"], "Access Token Duration")
	flag.StringVar(&cfg.Token.RefreshTokenDuration, "refresh-token-duration", tokenDeets["refresh_token_duration"], "Refresh Token Duration")

	return &cfg
}

// cronjobs wires up and starts the background scheduler. All jobs share ctx so a
// shutdown that cancels ctx aborts any in-flight job (releasing its DB
// connection) instead of leaving pool.Close() to block forever. The scheduler
// and its cancel func are stored on app so shutdown can stop them.
func cronjobs(app *api.Application, ctx context.Context, cancel context.CancelFunc) {
	c := cron.New()

	// run wraps a scheduled job so every one behaves the same way about the two
	// things they all have to get right.
	//
	// It skips if the shared context is already done, and — more importantly —
	// does not report a failure as an error when the cause is that context
	// going away. Shutdown cancels this context deliberately to free the DB
	// connection a running job is holding, so the job's query failing is the
	// intended outcome of stopping the server, not a fault. Logging it at error
	// with a stack trace made an orderly shutdown look like a crash.
	run := func(name string, job func(context.Context) error) func() {
		return func() {
			if ctx.Err() != nil {
				return
			}
			if err := job(ctx); err != nil {
				if ctx.Err() != nil {
					app.Logger.Info(fmt.Sprintf("%s stopped early: server is shutting down", name), nil)
					return
				}
				app.Logger.Error(fmt.Sprintf("%s failed: %v", name, err), nil)
			}
		}
	}

	// Run every day at midnight (00:00)
	c.AddFunc("0 0 * * *", run("Ticket expiration", func(ctx context.Context) error {
		return app.TicketService.ExpirePastTickets(ctx)
	}))

	// Run daily at 01:00 AM to cleanup OTPs
	c.AddFunc("0 1 * * *", run("OTP cleanup", func(ctx context.Context) error {
		return app.AuthService.CleanupExpiredOTPs(ctx)
	}))

	// Run daily at 02:00 AM to sweep orphaned images from object storage.
	// No-op unless R2_GC_ENABLED=true; logs candidates only until R2_GC_DRY_RUN=false.
	c.AddFunc("0 2 * * *", run("Image GC sweep", func(ctx context.Context) error {
		if app.ImageGCService == nil || !app.ImageGCService.Enabled {
			return nil
		}
		return app.ImageGCService.SweepOrphans(ctx)
	}))

	// Run every 10 minutes to auto-expire contracts that reached match length
	c.AddFunc("*/10 * * * *", run("Contract expiration check", func(ctx context.Context) error {
		if app.ContractService == nil {
			return nil
		}
		count, err := app.ContractService.CheckAndExpireContracts(ctx)
		if err == nil && count > 0 {
			app.Logger.Info(fmt.Sprintf("Auto-expired %d contracts", count), nil)
		}
		return err
	}))

	// Run every 5 minutes to lock scheduled fantasy gameweeks and roll over unedited lineups
	c.AddFunc("*/5 * * * *", run("Fantasy auto-lock job", func(ctx context.Context) error {
		if app.FantasyService == nil {
			return nil
		}
		return app.FantasyService.AutoLockGameweeks(ctx)
	}))

	// Run every 10 minutes to auto-finalize and score gameweeks when all matches are finished and stats populated
	c.AddFunc("*/10 * * * *", run("Fantasy auto-finalize job", func(ctx context.Context) error {
		if app.FantasyService == nil {
			return nil
		}
		return app.FantasyService.AutoFinalizeGameweeks(ctx)
	}))

	app.Logger.Info("Starting scheduler...", nil)
	c.Start()

	app.Cron = c
	app.CronCancel = cancel
}

func runMigrations(dsn string, log *logger.Logger) {

	goose.SetLogger(log) // Optional: use default logger

	sqlDB, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatal(fmt.Sprintf("failed to open DB for migrations: %v", err), nil)
	}
	defer sqlDB.Close()

	if err := goose.SetDialect("postgres"); err != nil {
		log.Fatal(fmt.Sprintf("goose dialect error: %v", err), nil)
	}

	migrationsDir := "migrations"

	goose.SetBaseFS(sqlembed.EmbedMigrations)
	if err := goose.Up(sqlDB, migrationsDir); err != nil {
		log.Fatal(fmt.Sprintf("failed to apply migrations: %v", err), nil)
	}

	log.Info("Migrations applied successfully.", nil)
}

func redisSetup() *redis.Client {
	redisAddr := os.Getenv("REDIS_URL")
	redisPass := os.Getenv("REDIS_PASS")

	return redis.NewClient(&redis.Options{
		Addr:     redisAddr,
		Password: redisPass,
		DB:       0,
	})
}

func ExampleQueueProducer(log *logger.Logger) queue.MessagePublisher {
	rabbitMqUrl := os.Getenv("RABBIT_MQ_URL")
	examplePub, err := queue.NewRabbitMQPublisher(rabbitMqUrl, "example_topic")
	if err != nil {
		log.Fatal(err.Error(), nil)
	}
	return examplePub
}

// wireDependencies initializes and injects all dependencies (Repository -> Service -> Handler)
// returning the fully assembled Handlers struct, the AuditService, and the TicketService.
func wireDependencies(pool *pgxpool.Pool, tokenMaker token.Maker, log *logger.Logger) (handlers.Handlers, services.IAuditService, services.IAuthService, services.ITeamManagerService, *services.TicketService, ports.StorageService, services.IContractService, services.ITransferService, services.INotificationService, services.ITransferWindowService, services.IFantasyService) {
	// Infrastructure
	auditRepo := ports.NewAuditRepository(pool)
	authRepo := ports.NewAuthRepository(pool)
	newsRepo := ports.NewNewsRepository(pool)
	galleryRepo := ports.NewGalleryRepository(pool)
	matchRepo := ports.NewMatchRepository(pool)
	playerRepo := ports.NewPlayerRepository(pool)
	eventDayRepo := ports.NewEventDayRepository(pool)
	tierRepo := ports.NewTicketTierRepository(pool)
	ticketRepo := ports.NewTicketRepository(pool)
	tmRepo := ports.NewTeamManagerRepository(pool)
	analyticsRepo := ports.NewAnalyticsRepository(pool)
	tmAllocRepo := ports.NewTeamTicketAllocationRepository(pool)
	statsRepo := ports.NewStatsRepository(pool)
	inventoryRepo := ports.NewInventoryRepository(pool)
	storeRepo := ports.NewStoreRepository(pool)
	importRepo := ports.NewImportRepository(pool)
	heroSlideRepo := ports.NewHeroSlideRepository(pool)
	seasonRepo := ports.NewSeasonRepository(pool)
	playRepo := ports.NewPlayRepository(pool)
	appSettingRepo := ports.NewAppSettingRepository(pool)

	// Transfer & Contract System Repositories
	contractRepo := ports.NewContractRepository(pool)
	transferRepo := ports.NewTransferRepository(pool)
	windowRepo := ports.NewTransferWindowRepository(pool)
	notifRepo := ports.NewNotificationRepository(pool)
	claimRepo := ports.NewClaimRepository(pool)
	commentRepo := ports.NewCommentRepository(pool)
	discountRepo := ports.NewDiscountRepository(pool)

	// Fantasy Repositories
	fantasyRepo := ports.NewFantasyRepository(pool)
	fantasySquadRepo := ports.NewFantasySquadRepository(pool)
	fantasyLeagueRepo := ports.NewFantasyLeagueRepository(pool)
	fantasyPayoutRepo := ports.NewFantasyPayoutRepository(pool)

	// External Clients
	paystackClient := services.NewPaystackClient()
	storageService, err := storage.NewR2StorageService()
	if err != nil {
		log.Fatal(fmt.Sprintf("FATAL: R2 Storage Service failed to initialize. Check R2 environment variables. Error: %v", err), nil)
	}

	// Services
	auditService := services.NewAuditService(auditRepo, authRepo)
	emailService := email.NewResendService() // Move this up
	authService := services.NewAuthService(authRepo, playerRepo, tokenMaker, emailService)
	notifService := services.NewNotificationService(notifRepo)
	windowService := services.NewTransferWindowService(windowRepo)
	contractService := services.NewContractService(contractRepo, playerRepo, notifService, windowRepo)
	transferService := services.NewTransferService(transferRepo, contractRepo, playerRepo, windowRepo, notifService, tmRepo)
	claimService := services.NewClaimService(claimRepo, tmRepo, contractService, notifService, emailService, tokenMaker)
	commentService := services.NewCommentService(commentRepo, newsRepo, matchRepo)
	discountService := services.NewDiscountService(discountRepo)

	newsService := services.NewNewsService(newsRepo, storageService)
	galleryService := services.NewGalleryService(galleryRepo)
	matchService := services.NewMatchService(matchRepo, storageService, contractService)
	playerService := services.NewPlayerService(playerRepo, storageService)
	ticketService := services.NewTicketService(eventDayRepo, tierRepo, ticketRepo, matchRepo, paystackClient, emailService, discountService, discountRepo)
	tmService := services.NewTeamManagerService(tmRepo, authRepo)
	analyticsService := services.NewAnalyticsService(authRepo, ticketRepo, analyticsRepo)
	tmAllocService := services.NewTeamTicketAllocationService(tmAllocRepo, ticketRepo, tierRepo, eventDayRepo, emailService)
	statsService := services.NewStatsService(statsRepo, matchRepo)
	inventoryService := services.NewInventoryService(inventoryRepo)
	storeService := services.NewStoreService(storeRepo, paystackClient, emailService, storageService, discountService, discountRepo)
	importService := services.NewImportService(importRepo, matchRepo)
	heroSlideService := services.NewHeroSlideService(heroSlideRepo, newsRepo)
	seasonService := services.NewSeasonService(seasonRepo)
	playService := services.NewPlayService(playRepo, matchRepo, statsRepo)
	appSettingService := services.NewAppSettingService(appSettingRepo)

	fantasyService := services.NewFantasyService(fantasyRepo, fantasyLeagueRepo, playerRepo, matchRepo, fantasySquadRepo)
	fantasyLeagueService := services.NewFantasyLeagueService(fantasyLeagueRepo, fantasyRepo, fantasyPayoutRepo, authRepo, paystackClient)
	fantasyPayoutService := services.NewFantasyPayoutService(fantasyPayoutRepo, fantasyLeagueRepo, fantasyRepo, appSettingRepo)

	// Transport / Handlers
	authHandler := transport.NewAuthHandler(authService)
	newsHandler := transport.NewNewsHandler(newsService)
	galleryHandler := transport.NewGalleryHandler(galleryService)
	matchHandler := transport.NewMatchHandler(matchService)
	playerHandler := transport.NewPlayerHandler(playerService, contractService, authRepo)
	ticketHandler := transport.NewTicketHandler(ticketService, paystackClient)
	tmHandler := transport.NewTeamManagerHandler(tmService, matchService)
	analyticsHandler := transport.NewAnalyticsHandler(analyticsService)
	tmAllocHandler := transport.NewTeamTicketAllocationHandler(tmAllocService)
	statsHandler := transport.NewStatsHandler(statsService)
	inventoryHandler := transport.NewInventoryHandler(inventoryService)
	uploadHandler := transport.NewUploadHandler(storageService, log)
	storeHandler := transport.NewStoreHandler(storeService, paystackClient)
	importHandler := transport.NewImportHandler(importService)
	heroSlideHandler := transport.NewHeroSlideHandler(heroSlideService)
	seasonHandler := transport.NewSeasonHandler(seasonService)
	playHandler := transport.NewPlayHandler(playService)
	contractHandler := transport.NewContractHandler(contractService, authRepo, auditService)
	transferHandler := transport.NewTransferHandler(transferService, windowService, playerRepo)
	notifHandler := transport.NewNotificationHandler(notifService)
	appSettingHandler := transport.NewAppSettingHandler(appSettingService)
	claimHandler := transport.NewClaimHandler(claimService)
	commentHandler := transport.NewCommentHandler(commentService, authRepo)
	discountHandler := transport.NewDiscountHandler(discountService, storeService, tierRepo)

	reliveService := services.NewReliveService()
	reliveHandler := transport.NewReliveHandler(reliveService)

	liveService := services.NewLiveService(appSettingRepo)
	liveHandler := transport.NewLiveHandler(liveService)

	fantasyHandler := transport.NewFantasyHandler(fantasyService)
	fantasyLeagueHandler := transport.NewFantasyLeagueHandler(fantasyLeagueService)
	fantasyPayoutHandler := transport.NewFantasyPayoutHandler(fantasyPayoutService)
	fantasySquadHandler := transport.NewFantasySquadHandler(
		services.NewFantasySquadService(fantasySquadRepo, fantasyRepo),
	)

	h := handlers.NewHandlers(
		authHandler, newsHandler, galleryHandler, matchHandler, playerHandler,
		ticketHandler, tmHandler, analyticsHandler, tmAllocHandler, statsHandler,
		inventoryHandler, uploadHandler, storeHandler, importHandler,
		heroSlideHandler, seasonHandler, playHandler, reliveHandler,
		contractHandler, transferHandler, notifHandler, appSettingHandler,
		claimHandler, commentHandler, discountHandler, liveHandler,
		fantasyHandler, fantasyLeagueHandler, fantasyPayoutHandler, fantasySquadHandler,
	)
	return h, auditService, authService, tmService, ticketService, storageService, contractService, transferService, notifService, windowService, fantasyService
}
