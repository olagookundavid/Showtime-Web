package ports

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// IBroadcastStateRepository stores each match's broadcast state as an opaque
// JSON document; the broadcast package owns its shape.
type IBroadcastStateRepository interface {
	// Load returns the stored state, or nil when none exists for the match.
	Load(ctx context.Context, matchID string) ([]byte, error)
	Save(ctx context.Context, matchID string, state []byte) error
}

type PostgresBroadcastStateRepository struct {
	db *pgxpool.Pool
}

func NewBroadcastStateRepository(db *pgxpool.Pool) IBroadcastStateRepository {
	return &PostgresBroadcastStateRepository{db: db}
}

func (r *PostgresBroadcastStateRepository) Load(ctx context.Context, matchID string) ([]byte, error) {
	query := `SELECT state FROM broadcast_states WHERE match_id = $1`

	var state []byte
	err := r.db.QueryRow(ctx, query, matchID).Scan(&state)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	// The overlay endpoint is public, so a malformed match ID is just "not found".
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "22P02" {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return state, nil
}

func (r *PostgresBroadcastStateRepository) Save(ctx context.Context, matchID string, state []byte) error {
	query := `
		INSERT INTO broadcast_states (match_id, state, updated_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (match_id)
		DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()
	`
	_, err := r.db.Exec(ctx, query, matchID, state)
	return err
}
