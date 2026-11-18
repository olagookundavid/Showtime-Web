package ports

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// IdempotencyRecord is what is stored for one Idempotency-Key.
type IdempotencyRecord struct {
	RequestHash string
	// StatusCode is nil while the first request is still running.
	StatusCode  *int
	Body        []byte
	ContentType string
}

// IdempotencyRepository stores Idempotency-Keys (migration 134).
type IdempotencyRepository struct {
	pool *pgxpool.Pool
}

func NewIdempotencyRepository(pool *pgxpool.Pool) *IdempotencyRepository {
	return &IdempotencyRepository{pool: pool}
}

// Claim takes a key for a request. claimed is true when this request now owns
// it: the key is new, or an earlier claim with the same request was abandoned
// (still running past its lease). Otherwise the existing record comes back for
// the caller to replay or refuse.
func (r *IdempotencyRepository) Claim(ctx context.Context, userID, scope, key, requestHash string, lease time.Duration) (*IdempotencyRecord, bool, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var claimed bool
	err := r.pool.QueryRow(ctx, `
		INSERT INTO idempotency_keys (user_id, scope, key, request_hash, locked_until)
		VALUES ($1, $2, $3, $4, NOW() + make_interval(secs => $5))
		ON CONFLICT (user_id, scope, key) DO UPDATE
			SET locked_until = EXCLUDED.locked_until, created_at = NOW()
			WHERE idempotency_keys.status_code IS NULL
			  AND idempotency_keys.locked_until < NOW()
			  AND idempotency_keys.request_hash = EXCLUDED.request_hash
		RETURNING true`,
		userID, scope, key, requestHash, lease.Seconds(),
	).Scan(&claimed)
	if err == nil {
		return nil, true, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, false, err
	}

	var rec IdempotencyRecord
	var contentType *string
	err = r.pool.QueryRow(ctx, `
		SELECT request_hash, status_code, response_body, content_type
		FROM idempotency_keys WHERE user_id = $1 AND scope = $2 AND key = $3`,
		userID, scope, key,
	).Scan(&rec.RequestHash, &rec.StatusCode, &rec.Body, &contentType)
	if errors.Is(err, pgx.ErrNoRows) {
		// Released between the two statements: the caller may simply try again.
		return nil, false, errors.New("idempotency key changed hands, try again")
	}
	if err != nil {
		return nil, false, err
	}
	if contentType != nil {
		rec.ContentType = *contentType
	}
	return &rec, false, nil
}

// Complete stores the response the first request produced, for replay.
func (r *IdempotencyRepository) Complete(ctx context.Context, userID, scope, key string, status int, body []byte, contentType string) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	_, err := r.pool.Exec(ctx, `
		UPDATE idempotency_keys SET status_code = $4, response_body = $5, content_type = $6
		WHERE user_id = $1 AND scope = $2 AND key = $3`,
		userID, scope, key, status, body, contentType)
	return err
}

// Release frees a claim whose request did not succeed, so the same key can be
// tried again (after a refusal nothing happened, so a retry is safe).
func (r *IdempotencyRepository) Release(ctx context.Context, userID, scope, key string) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	_, err := r.pool.Exec(ctx, `
		DELETE FROM idempotency_keys
		WHERE user_id = $1 AND scope = $2 AND key = $3 AND status_code IS NULL`,
		userID, scope, key)
	return err
}

// Purge drops keys older than maxAge.
func (r *IdempotencyRepository) Purge(ctx context.Context, maxAge time.Duration) error {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	_, err := r.pool.Exec(ctx,
		`DELETE FROM idempotency_keys WHERE created_at < NOW() - make_interval(secs => $1)`, maxAge.Seconds())
	return err
}
