package ports

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"showtime-backend/internal/domain"
	appErrors "showtime-backend/internal/errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ExampleRepository interface {
	Create(ctx context.Context, example *domain.Example) error
	FindByToken(ctx context.Context, token string) (*domain.Example, error)
	FindByEmail(ctx context.Context, email string) (*domain.Example, error)
	UpdateStatus(ctx context.Context, id string, status domain.ExampleStatus) error
	Revoke(ctx context.Context, email string) error
	MarkAsUsed(ctx context.Context, token string) error
}

type ExamplePGRepository struct {
	db *pgxpool.Pool
}

func NewExampleRepository(db *pgxpool.Pool) ExampleRepository {
	return &ExamplePGRepository{db: db}
}

func (r *ExamplePGRepository) Create(ctx context.Context, example *domain.Example) error {
	query := `
		INSERT INTO examples (
			email, token, inviter_id, roles, 
			expires_at, status
		) VALUES (
			$1, $2, $3, $4,
			$5, $6
		) RETURNING id, created_at
	`

	args := []any{
		example.Email,
		example.Token,
		example.InviterID,
		example.Roles,
		example.ExpiresAt,
		example.Status,
	}

	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	err := r.db.QueryRow(ctx, query, args...).Scan(&example.ID, &example.CreatedAt)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key value violates unique constraint") {
			return appErrors.ErrDuplicateExample
		}
		return fmt.Errorf("failed to create example: %w", err)
	}

	return nil
}

func (r *ExamplePGRepository) FindByToken(ctx context.Context, token string) (*domain.Example, error) {
	query := `
		SELECT 
			id, email, token, inviter_id, roles,
			expires_at, created_at, used_at, status
		FROM examples
		WHERE token = $1
	`

	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var ex domain.Example
	var usedAt sql.NullTime

	err := r.db.QueryRow(ctx, query, token).Scan(
		&ex.ID,
		&ex.Email,
		&ex.Token,
		&ex.InviterID,
		&ex.Roles,
		&ex.ExpiresAt,
		&ex.CreatedAt,
		&usedAt,
		&ex.Status,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, appErrors.ErrExampleNotFound
		}
		return nil, fmt.Errorf("failed to find example: %w", err)
	}

	if usedAt.Valid {
		ex.UsedAt = &usedAt.Time
	}

	return &ex, nil
}

func (r *ExamplePGRepository) FindByEmail(ctx context.Context, email string) (*domain.Example, error) {
	query := `
		SELECT 
			id, email, token, inviter_id, roles,
			expires_at, created_at, used_at, status
		FROM examples
		WHERE email = $1
		AND status = 'valid'
		ORDER BY created_at DESC
		LIMIT 1
	`

	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var ex domain.Example
	var usedAt sql.NullTime

	err := r.db.QueryRow(ctx, query, email).Scan(
		&ex.ID,
		&ex.Email,
		&ex.Token,
		&ex.InviterID,
		&ex.Roles,
		&ex.ExpiresAt,
		&ex.CreatedAt,
		&usedAt,
		&ex.Status,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, appErrors.ErrExampleNotFound
		}
		return nil, fmt.Errorf("failed to find example: %w", err)
	}

	if usedAt.Valid {
		ex.UsedAt = &usedAt.Time
	}

	return &ex, nil
}

func (r *ExamplePGRepository) UpdateStatus(ctx context.Context, id string, status domain.ExampleStatus) error {
	query := `
		UPDATE examples
		SET status = $1,
			used_at = CASE WHEN $1 = 'used' THEN NOW() ELSE used_at END
		WHERE id = $2
	`

	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	_, err := r.db.Exec(ctx, query, status, id)
	if err != nil {
		return fmt.Errorf("failed to update example status: %w", err)
	}

	return nil
}

func (r *ExamplePGRepository) Revoke(ctx context.Context, email string) error {
	query := `
		UPDATE examples
		SET status = 'revoked'
		WHERE email = $1
		AND status = 'valid'
	`

	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	_, err := r.db.Exec(ctx, query, email)
	if err != nil {
		return fmt.Errorf("failed to revoke example: %w", err)
	}

	return nil
}

func (r *ExamplePGRepository) MarkAsUsed(ctx context.Context, token string) error {
	query := `
		UPDATE examples
		SET status = 'used',
			used_at = NOW()
		WHERE token = $1
		AND status = 'valid'
	`

	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	result, err := r.db.Exec(ctx, query, token)
	if err != nil {
		return fmt.Errorf("failed to mark example as used: %w", err)
	}

	if result.RowsAffected() == 0 {
		return appErrors.ErrExampleNotFound
	}

	return nil
}
