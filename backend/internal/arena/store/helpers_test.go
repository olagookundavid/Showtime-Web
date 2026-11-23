package store

import (
	"context"
	"testing"
	"time"

	"showtime-backend/internal/arena/domain"

	"github.com/jackc/pgx/v5/pgxpool"
)

func refDate() time.Time { return time.Date(2026, 10, 12, 9, 0, 0, 0, domain.Lagos) }

// insertUser adds a bare account (the shared users table) for tests.
func insertUser(t *testing.T, pool *pgxpool.Pool, email string) string {
	t.Helper()
	var id string
	err := pool.QueryRow(context.Background(),
		`INSERT INTO users (full_name, email) VALUES ('Test User', $1) RETURNING id::text`, email).Scan(&id)
	if err != nil {
		t.Fatalf("insert user: %v", err)
	}
	return id
}
