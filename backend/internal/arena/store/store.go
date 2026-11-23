// Package store is Clubs Arena's Postgres access. Every query is against the
// arena_ tables, plus users for looking people up by email.
package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DBTX is what both a pool and a transaction can do, so a Store works the same
// inside and outside a transaction.
type DBTX interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// Store reads and writes Arena data.
type Store struct {
	db   DBTX
	pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Store { return &Store{db: pool, pool: pool} }

// InTx runs fn in one transaction. fn gets a Store bound to it; returning an
// error rolls everything back.
func (s *Store) InTx(ctx context.Context, fn func(*Store) error) error {
	if s.pool == nil {
		// Already inside a transaction: join it.
		return fn(s)
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err := fn(&Store{db: tx}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// ErrNotFound is returned when a row doesn't exist.
var ErrNotFound = errors.New("not found")

// Conflict reasons the service turns into friendly messages.
var (
	ErrDuplicate = errors.New("already exists")
	ErrInUse     = errors.New("in use")
)

// notFound maps pgx's no-rows error to ErrNotFound.
func notFound(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	return err
}

// constraint returns the violated constraint or index name for a unique/foreign
// key/check failure, or "" if err isn't one.
func constraint(err error) (code, name string) {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code, pgErr.ConstraintName
	}
	return "", ""
}

// IsUniqueViolation reports whether err is a unique constraint failure, and which.
func IsUniqueViolation(err error) (string, bool) {
	code, name := constraint(err)
	return name, code == "23505"
}
