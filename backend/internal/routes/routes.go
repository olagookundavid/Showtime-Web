package routes

import (
	"expvar"
	"pkg-common/commonAuth"

	"showtime-backend/cmd/api"

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
	v1_api := r.Group("/api/v1", commonAuth.RecoverPanic(), commonAuth.RateLimit(rls), commonAuth.Metrics())
	{
		v1_api.GET("/healthcheck", helpers.HealthcheckHandler(app.Config.Env))
	}

	// Register all subroutes
	SetupExampleRoutes(v1_api, app)
	return r
}

func SetupExampleRoutes(r *gin.RouterGroup, app *api.Application) {
	exampleRoutes := r.Group("/example")
	{
		exampleRoutes.POST("", app.Handlers.ExampleHandler.CreateExample)
	}
}

// routes.go
func SetupRoutes(r *gin.RouterGroup, app *api.Application) {

	{
	}
}
