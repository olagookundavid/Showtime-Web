package ports

import (
	"context"
	"errors"
	"showtime-backend/internal/domain"
	appErrors "showtime-backend/internal/errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type IAuthRepository interface {
	Register(ctx context.Context, user domain.User) (*string, error)
	GetUserByEmail(ctx context.Context, email string) (*domain.User, error)
	GetUserByID(ctx context.Context, id string) (*domain.User, error)
	ResetPassword(ctx context.Context, user domain.User) error
}

type AuthRepository struct {
	Db *pgxpool.Pool
}

func NewAuthRepository(Db *pgxpool.Pool) *AuthRepository {
	return &AuthRepository{Db: Db}
}

func (m AuthRepository) Register(ctx context.Context, user domain.User) (*string, error) {
	query := ` INSERT INTO users (full_name, email, password_hash) 
		VALUES ($1, $2, $3) 
		RETURNING id`
	args := []any{user.FullName, user.Email, user.Password.Hash}
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	var id string
	err := m.Db.QueryRow(ctx, query, args...).Scan(&id)
	if err != nil {
		switch {
		case strings.Contains(err.Error(), `duplicate key value violates unique constraint "users_email_key"`):
			return nil, appErrors.ErrDuplicateEmail
		default:
			return nil, err
		}
	}
	return &id, nil
}

func (m AuthRepository) GetUserByEmail(ctx context.Context, email string) (*domain.User, error) {
	query := ` SELECT id, full_name, email, email_verified, auth_provider, enabled,  password_hash, created_at, updated_at FROM users WHERE email = $1`
	var user domain.User
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	err := m.Db.QueryRow(ctx, query, email).Scan(
		&user.ID,
		&user.FullName,
		&user.Email,
		&user.Password.Hash,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			return nil, appErrors.ErrNoUserRecordExist
		default:
			return nil, appErrors.ErrServerError
		}
	}
	return &user, nil
}

func (m AuthRepository) GetUserByID(ctx context.Context, id string) (*domain.User, error) {
	query := ` SELECT id, full_name, email, email_verified, auth_provider, enabled,  password_hash, created_at, updated_at FROM users WHERE id = $1`
	var user domain.User
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	err := m.Db.QueryRow(ctx, query, id).Scan(
		&user.ID,
		&user.FullName,
		&user.Email,
		&user.Password.Hash,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			return nil, appErrors.ErrNoUserRecordExist
		default:
			return nil, appErrors.ErrServerError
		}
	}
	return &user, nil
}

func (m AuthRepository) updatePassword(ctx context.Context, user domain.User) error {
	query := `UPDATE users SET password_hash = $1 WHERE email = $2;`
	args := []any{user.Password.Hash, user.Email}

	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	if _, err := m.Db.Exec(ctx, query, args...); err != nil {
		return err
	}
	return nil
}

func (m AuthRepository) ResetPassword(ctx context.Context, user domain.User) error {
	return m.updatePassword(ctx, user)
}
