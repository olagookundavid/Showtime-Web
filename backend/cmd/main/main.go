package main

import (
	"context"
	"fmt"
	"os"
	"pkg-common/logger"
	"strings"
	"sync"
	"time"

	"pkg-common/token"
	"showtime-backend/cmd/api"
	"showtime-backend/docs"
	"showtime-backend/internal/server"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

func init() {
	// Example: Get host from environment variable or configuration
	dynamicHost := os.Getenv("API_HOST")

	mode := loadModeEnv()
	if mode {
		docs.SwaggerInfo.Schemes = append(docs.SwaggerInfo.Schemes, "https")
	} else {
		docs.SwaggerInfo.Schemes = append(docs.SwaggerInfo.Schemes, "http")
	}

	if dynamicHost == "" {
		fmt.Println("No Swagger Host set ")
		return
	}
	docs.SwaggerInfo.Host = dynamicHost
	fmt.Printf("Swagger Host set to: %s\n", docs.SwaggerInfo.Host)
}

// @title Showtime Backend API
// @version 1.0
// @description Backend for Showtime Flag Football League Web Platform
// @termsOfService http://swagger.io/terms/

// @contact.name Showtime Dev
// @contact.url http://www.showtime.league
// @contact.email dev@showtime.league

// @license.name Apache 2.0
// @license.url http://www.apache.org/licenses/LICENSE-2.0.html

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Type "Bearer" followed by a space and PASETO token (e.g., "Bearer <token>").
func main() {

	mode := loadModeEnv()
	if mode {
		gin.SetMode(gin.ReleaseMode)
	}

	//Check version and exit
	displayVersion("version")
	env := "dev"
	if mode {
		env = "prod"
	}

	// Initialize logger
	log := logger.GetLogger(logger.Options{
		IsProduction: mode,
		AppName:      "Showtime-Backend",
		Environment:  env,
		TraceID:      "Showtime-app-id",
	})
	defer log.Sync()

	// Fail loud (not silent) on misconfigured outbound integrations. These are
	// not fatal so dev can run without them, but in prod a missing key means
	// emails silently vanish / payments can't be verified — surface it at boot.
	if mode {
		if os.Getenv("RESEND_API_KEY") == "" {
			log.Error("RESEND_API_KEY is not set in production — ticket/order emails will NOT be sent", nil)
		}
		paystackKey := os.Getenv("PAYSTACK_SECRET_KEY")
		if paystackKey == "" {
			log.Error("PAYSTACK_SECRET_KEY is not set in production — payment verification will fail", nil)
		} else if strings.HasPrefix(paystackKey, "pk_") {
			log.Error("PAYSTACK_SECRET_KEY looks like a PUBLISHABLE key (pk_...) — server payment verification/refunds need the SECRET key (sk_...)", nil)
		}
		// The committed dev key is a guessable ascending sequence. Using it (or
		// any short key) in prod means admin tokens can be forged — rotate it.
		tokenKey := os.Getenv("TOKEN_KEY")
		if tokenKey == "12345678901234567890123456789012" || len(tokenKey) < 32 {
			log.Error("TOKEN_KEY is weak/default in production — generate a strong 32-byte secret and set it via the platform secret store immediately", nil)
		}
	}

	dbUrl := loadDbUrl(log)
	tokenDeets := loadTokenDetails(log)

	cfg := flagSetup(dbUrl, env, tokenDeets)

	// Auto-run migrations on boot by default (preserves existing behavior).
	// Set AUTO_MIGRATE=false in prod once migrations are run as a separate,
	// gated deploy step — so a bad/in-progress migration can't take the app
	// down on a cold start, and repeated scale-to-zero wakes don't re-run
	// migration logic against the live DB.
	if envBool("AUTO_MIGRATE", true) {
		runMigrations(dbUrl, log)
	} else {
		log.Info("AUTO_MIGRATE=false — skipping boot migrations (run them via deploy step)", nil)
	}

	ctx := context.Background()
	pool, err := openDB(*cfg, ctx)
	if err != nil {
		log.Fatal(err.Error(), nil)
	}
	defer pool.Close()
	log.Info("database connection pool established", nil)

	// Initialize Worker Pool (Global ants pool)
	if err := services.InitWorkerPool(1000); err != nil {
		log.Fatal(fmt.Errorf("failed to initialize worker pool: %w", err).Error(), nil)
	}
	defer services.CloseWorkerPool()

	expvarSetup()

	tokenMaker, err := token.NewPasetoMaker(cfg.Token.TokenKey)
	if err != nil {
		log.Fatal(fmt.Errorf("cannot create token maker: %w", err).Error(), nil)
	}
	// examplePub := ExampleQueueProducer(log)
	// defer examplePub.Close()

	appHandlers, auditService, authService, tmService, ticketService, storageService, contractService, transferService, notifService, windowService := wireDependencies(pool, tokenMaker, log)

	// Orphaned-image GC. Off + dry-run by default so it can't delete in-use
	// images before its candidate logs have been reviewed (see image_gc_service).
	imageGC := services.NewImageGCService(
		pool, storageService, log,
		envBool("R2_GC_ENABLED", false),
		envBool("R2_GC_DRY_RUN", true),
		time.Duration(envInt("R2_GC_TTL_HOURS", 24))*time.Hour,
	)

	app := &api.Application{
		Wg:                    sync.WaitGroup{},
		Config:                *cfg,
		Logger:                log,
		TokenMaker:            tokenMaker,
		Handlers:              appHandlers,
		AuditService:          auditService,
		AuthService:           authService,
		TeamManagerService:    tmService,
		TicketService:         ticketService,
		StorageService:        storageService,
		ImageGCService:        imageGC,
		ContractService:       contractService,
		TransferService:       transferService,
		NotificationService:   notifService,
		TransferWindowService: windowService,
	}
	// Scheduled jobs share a cancellable context so shutdown can abort any
	// in-flight job before the DB pool is closed (see server.shutdown).
	cronCtx, cronCancel := context.WithCancel(context.Background())
	cronjobs(app, cronCtx, cronCancel)

	err = server.Serve(app)
	if err != nil {
		log.Fatal(err.Error(), nil)
	}
}
