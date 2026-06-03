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

func flagSetup(dbUrl string, tokenDeets map[string]string) *config.Config {

	var cfg config.Config

	//env and port
	flag.IntVar(&cfg.Port, "port", loadPort(), "API server port")
	flag.StringVar(&cfg.Env, "env", "development", "Environment (development|staging|production)")
	//db and settings
	flag.StringVar(&cfg.Db.Dsn, "db-dsn", dbUrl, "PostgreSQL DSN")
	flag.Float64Var(&cfg.Limiter.Rps, "limiter-rps", 2, "Rate limiter maximum requests per second")
	flag.IntVar(&cfg.Limiter.Burst, "limiter-burst", 4, "Rate limiter maximum burst")
	flag.BoolVar(&cfg.Limiter.Enabled, "limiter-enabled", false, "Enable rate limiter")

	//tokenDeets
	flag.StringVar(&cfg.Token.TokenKey, "token-key", tokenDeets["token_key"], "Token Key")
	flag.StringVar(&cfg.Token.AccessTokenDuration, "access-token-duration", tokenDeets["access_token_duration"], "Access Token Duration")
	flag.StringVar(&cfg.Token.RefreshTokenDuration, "refresh-token-duration", tokenDeets["refresh_token_duration"], "Refresh Token Duration")

	return &cfg
}

func cronjobs(app *api.Application) {
	c := cron.New()

	// Run every day at midnight (00:00)
	c.AddFunc("0 0 * * *", func() {
		app.Logger.Info("Running daily ticket expiration job...", nil)
		if err := app.TicketService.ExpirePastTickets(context.Background()); err != nil {
			app.Logger.Error(fmt.Sprintf("Ticket expiration failed: %v", err), nil)
		}
	})

	// Run daily at 01:00 AM to cleanup OTPs
	c.AddFunc("0 1 * * *", func() {
		app.Logger.Info("Running OTP cleanup job...", nil)
		if err := app.AuthService.CleanupExpiredOTPs(context.Background()); err != nil {
			app.Logger.Error(fmt.Sprintf("OTP cleanup failed: %v", err), nil)
		}
	})

	app.Logger.Info("Starting scheduler...", nil)
	c.Start()
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
func wireDependencies(pool *pgxpool.Pool, tokenMaker token.Maker, log *logger.Logger) (handlers.Handlers, services.IAuditService, services.IAuthService, services.ITeamManagerService, *services.TicketService, ports.StorageService) {
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
	totwRepo := ports.NewTOTWRepository(pool)
	storeRepo := ports.NewStoreRepository(pool)
	importRepo := ports.NewImportRepository(pool)

	// External Clients
	paystackClient := services.NewPaystackClient()
	storageService, err := storage.NewR2StorageService()
	if err != nil {
		log.Fatal(fmt.Sprintf("FATAL: R2 Storage Service failed to initialize. Check R2 environment variables. Error: %v", err), nil)
	}


	// Services
	auditService := services.NewAuditService(auditRepo, authRepo)
	emailService := email.NewResendService() // Move this up
	authService := services.NewAuthService(authRepo, tokenMaker, emailService)
	newsService := services.NewNewsService(newsRepo, storageService)
	galleryService := services.NewGalleryService(galleryRepo)
	matchService := services.NewMatchService(matchRepo, storageService)
	playerService := services.NewPlayerService(playerRepo, storageService)
	ticketService := services.NewTicketService(eventDayRepo, tierRepo, ticketRepo, matchRepo, paystackClient, emailService)
	tmService := services.NewTeamManagerService(tmRepo, authRepo)
	analyticsService := services.NewAnalyticsService(authRepo, ticketRepo, analyticsRepo)
	tmAllocService := services.NewTeamTicketAllocationService(tmAllocRepo, ticketRepo, tierRepo, eventDayRepo, emailService)
	statsService := services.NewStatsService(statsRepo, matchRepo)
	inventoryService := services.NewInventoryService(inventoryRepo)
	totwService := services.NewTOTWService(totwRepo)
	storeService := services.NewStoreService(storeRepo, paystackClient, emailService, storageService)
	importService := services.NewImportService(importRepo, matchRepo)

	// Transport / Handlers
	authHandler := transport.NewAuthHandler(authService)
	newsHandler := transport.NewNewsHandler(newsService)
	galleryHandler := transport.NewGalleryHandler(galleryService)
	matchHandler := transport.NewMatchHandler(matchService)
	playerHandler := transport.NewPlayerHandler(playerService)
	ticketHandler := transport.NewTicketHandler(ticketService, paystackClient)
	tmHandler := transport.NewTeamManagerHandler(tmService, matchService)
	analyticsHandler := transport.NewAnalyticsHandler(analyticsService)
	tmAllocHandler := transport.NewTeamTicketAllocationHandler(tmAllocService)
	statsHandler := transport.NewStatsHandler(statsService)
	inventoryHandler := transport.NewInventoryHandler(inventoryService)
	uploadHandler := transport.NewUploadHandler(storageService, log)
	totwHandler := transport.NewTOTWHandler(totwService)
	storeHandler := transport.NewStoreHandler(storeService, paystackClient)
	importHandler := transport.NewImportHandler(importService)

	h := handlers.NewHandlers(authHandler, newsHandler, galleryHandler, matchHandler, playerHandler, ticketHandler, tmHandler, analyticsHandler, tmAllocHandler, statsHandler, inventoryHandler, uploadHandler, totwHandler, storeHandler, importHandler)
	return h, auditService, authService, tmService, ticketService, storageService
}
