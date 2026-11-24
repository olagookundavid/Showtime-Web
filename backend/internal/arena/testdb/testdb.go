// Package testdb gives Arena's integration tests a throwaway Postgres database
// with every migration applied. Tests skip themselves when ARENA_TEST_DB_URL is
// not set, so `go test ./...` stays green on a machine without Postgres.
//
//	docker run -d --name arena-testdb -e POSTGRES_PASSWORD=test -p 54329:5432 postgres:18-alpine
//	export ARENA_TEST_DB_URL='postgres://postgres:test@localhost:54329/postgres?sslmode=disable'
package testdb

import (
	"context"
	"database/sql"
	"fmt"
	"io/fs"
	"math/rand"
	"net/url"
	"os"
	"sort"
	"testing"
	"time"

	arenasql "showtime-backend/internal/arena/sql"
	sqlembed "showtime-backend/internal/sql"

	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

// New creates a fresh database, migrates it, and returns a pool to it. The
// database is dropped when the test ends.
func New(t *testing.T) *pgxpool.Pool {
	t.Helper()
	adminURL := os.Getenv("ARENA_TEST_DB_URL")
	if adminURL == "" {
		t.Skip("ARENA_TEST_DB_URL not set; skipping database test")
	}
	ctx := context.Background()

	admin, err := sql.Open("pgx", adminURL)
	if err != nil {
		t.Fatalf("open admin db: %v", err)
	}
	name := fmt.Sprintf("arena_t_%d_%d", time.Now().UnixNano()%1_000_000_000, rand.Intn(1000))
	if _, err := admin.ExecContext(ctx, "CREATE DATABASE "+name); err != nil {
		t.Fatalf("create database: %v", err)
	}

	u, err := url.Parse(adminURL)
	if err != nil {
		t.Fatalf("parse url: %v", err)
	}
	u.Path = "/" + name
	testURL := u.String()

	t.Cleanup(func() {
		_, _ = admin.ExecContext(ctx, "DROP DATABASE IF EXISTS "+name+" WITH (FORCE)")
		_ = admin.Close()
	})

	migrate, err := sql.Open("pgx", testURL)
	if err != nil {
		t.Fatalf("open test db: %v", err)
	}
	goose.SetLogger(goose.NopLogger())
	goose.SetBaseFS(sqlembed.EmbedMigrations)
	if err := goose.SetDialect("postgres"); err != nil {
		t.Fatalf("goose dialect: %v", err)
	}
	if err := goose.Up(migrate, "migrations"); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	// Arena's own scripts are never run by the backend (production gets them by
	// hand), so the tests apply them here, in file name order.
	files, err := fs.Glob(arenasql.Migrations, "migrations/*.sql")
	if err != nil {
		t.Fatalf("list arena scripts: %v", err)
	}
	sort.Strings(files)
	for _, f := range files {
		body, err := arenasql.Migrations.ReadFile(f)
		if err != nil {
			t.Fatalf("read %s: %v", f, err)
		}
		if _, err := migrate.ExecContext(ctx, string(body)); err != nil {
			t.Fatalf("apply %s: %v", f, err)
		}
	}
	_ = migrate.Close()

	pool, err := pgxpool.New(ctx, testURL)
	if err != nil {
		t.Fatalf("pool: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}
