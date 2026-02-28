package main

import (
	"context"
	"fmt"
	"os"
	"pkg-common/logger"
	"sync"

	"pkg-common/token"
	"showtime-backend/cmd/api"
	"showtime-backend/docs"
	"showtime-backend/internal/server"

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

	docs.SwaggerInfo.Schemes = append(docs.SwaggerInfo.Schemes, "http", "https")

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

	// Initialize logger
	log := logger.GetLogger(logger.Options{
		IsProduction: mode,
		AppName:      "Showtime-Backend",
		Environment:  "dev",
		TraceID:      "project-app-id",
	})
	defer log.Sync()

	dbUrl := loadDbUrl(log)
	fmt.Println("DB URL", dbUrl)
	tokenDeets := loadTokenDetails(log)

	cfg := flagSetup(dbUrl, tokenDeets)
	fmt.Println("DB URL", dbUrl)
	runMigrations(dbUrl, log)

	ctx := context.Background()
	pool, err := openDB(*cfg, ctx)
	if err != nil {
		log.Fatal(err.Error(), nil)
	}
	defer pool.Close()
	log.Info("database connection pool established", nil)

	expvarSetup()

	tokenMaker, err := token.NewPasetoMaker(cfg.Token.TokenKey)
	if err != nil {
		log.Fatal(fmt.Errorf("cannot create token maker: %w", err).Error(), nil)
	}
	// examplePub := ExampleQueueProducer(log)
	// defer examplePub.Close()

	appHandlers, auditService, authService, tmService := wireDependencies(pool, tokenMaker)
	app := &api.Application{
		Wg:                 sync.WaitGroup{},
		Config:             *cfg,
		Logger:             log,
		TokenMaker:         tokenMaker,
		Handlers:           appHandlers,
		AuditService:       auditService,
		AuthService:        authService,
		TeamManagerService: tmService,
	}
	cronjobs(app)

	err = server.Serve(app)
	if err != nil {
		log.Fatal(err.Error(), nil)
	}
}
