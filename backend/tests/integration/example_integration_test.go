package tests_integration

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"showtime-backend/internal/handlers"
	"showtime-backend/internal/ports"
	"showtime-backend/internal/services"
	"showtime-backend/internal/transport"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
)

// NOTE: This is an INTEGRATION test.
// It requires a REAL running Postgres database.
//
// In a CI environment, you would spin up a Docker container for Postgres,
// run migrations, and then run this test.
//
// To run this locally:
// 1. Ensure Postgres is running
// 2. Set TEST_DB_DSN environment variable
// 3. Run: go test -v ./internal/transport/example_integration_test.go

func TestIntegration_CreateExample(t *testing.T) {
	// 1. Setup - Connect to Real DB
	dsn := os.Getenv("TEST_DB_DSN")
	if dsn == "" {
		t.Skip("Skipping integration test: TEST_DB_DSN not set")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatalf("Failed to connect to DB: %v", err)
	}
	defer pool.Close()

	// 2. Clean up DB before test (optional but recommended)
	_, _ = pool.Exec(ctx, "DELETE FROM examples WHERE email = 'integration@example.com'")

	// 3. Wiring - The exact same way as main.go!
	// This proves that our wiring works with REAL implementations.
	repo := ports.NewExampleRepository(pool)
	service := services.NewExampleService(repo)
	handler := transport.NewExampleHandler(service)

	// We can even use the main Handlers struct if we want to test that level too
	appHandlers := handlers.NewHandlers(handler)

	// 4. Setup Router
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/example", appHandlers.ExampleHandler.CreateExample)

	// 5. Create Request
	w := httptest.NewRecorder()
	body := `{"email": "integration@example.com", "roles": ["admin"]}`
	req, _ := http.NewRequest("POST", "/example", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	// 6. Execute
	router.ServeHTTP(w, req)

	// 7. Verify Response
	assert.Equal(t, http.StatusCreated, w.Code)

	// 8. Verify Side Effects (Database State)
	// We query the REAL database to ensure the record actually exists.
	var savedEmail string
	err = pool.QueryRow(ctx, "SELECT email FROM examples WHERE email = $1", "integration@example.com").Scan(&savedEmail)
	assert.NoError(t, err)
	assert.Equal(t, "integration@example.com", savedEmail)

	// Cleanup
	_, _ = pool.Exec(ctx, "DELETE FROM examples WHERE email = 'integration@example.com'")
}
