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

type IAuthRepository interface {
	Register(ctx context.Context, user domain.User) (*string, error)
	GetUserByEmail(ctx context.Context, email string) (*domain.User, error)
	GetUserByID(ctx context.Context, id string) (*domain.User, error)
	ResetPassword(ctx context.Context, user domain.User) error
	ListUsers(ctx context.Context, page, limit int, searchFilter string) ([]domain.User, int, error)
	UpdateUserRole(ctx context.Context, userID, newRole string) error
	UpdateUserInfo(ctx context.Context, userID, fullName, phone string) error
	CountTotalUsers(ctx context.Context) (int, error)
	// OTP methods
	SaveOTP(ctx context.Context, email, code, purpose string, expiry time.Duration) error
	VerifyOTP(ctx context.Context, email, code, purpose string) (bool, error)
	MarkOTPUsed(ctx context.Context, email, code, purpose string) error
	InvalidateActiveOTPs(ctx context.Context, email, purpose string) error
	DeleteExpiredOTPs(ctx context.Context) error
}

type AuthRepository struct {
	Db *pgxpool.Pool
}

func NewAuthRepository(Db *pgxpool.Pool) IAuthRepository {
	return &AuthRepository{Db: Db}
}

func (m AuthRepository) Register(ctx context.Context, user domain.User) (*string, error) {
	query := ` INSERT INTO users (full_name, email, password_hash, role, phone) 
		VALUES ($1, $2, $3, $4, $5) 
		RETURNING id`
	args := []any{user.FullName, user.Email, user.Password.Hash, user.Role, user.Phone}
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
	query := `SELECT id, full_name, email, password_hash, role, phone, created_at, updated_at FROM users WHERE LOWER(email) = LOWER($1)`
	var user domain.User
	var phone sql.NullString

	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	err := m.Db.QueryRow(ctx, query, email).Scan(
		&user.ID,
		&user.FullName,
		&user.Email,
		&user.Password.Hash,
		&user.Role,
		&phone,
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

	if phone.Valid {
		user.Phone = phone.String
	}

	return &user, nil
}

func (m AuthRepository) GetUserByID(ctx context.Context, id string) (*domain.User, error) {
	query := `SELECT id, full_name, email, password_hash, role, phone, created_at, updated_at FROM users WHERE id = $1`
	var user domain.User
	var phone sql.NullString

	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	err := m.Db.QueryRow(ctx, query, id).Scan(
		&user.ID,
		&user.FullName,
		&user.Email,
		&user.Password.Hash,
		&user.Role,
		&phone,
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

	if phone.Valid {
		user.Phone = phone.String
	}

	return &user, nil
}

func (m AuthRepository) updatePassword(ctx context.Context, user domain.User) error {
	query := `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2;`
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

func (m AuthRepository) ListUsers(ctx context.Context, page, limit int, searchFilter string) ([]domain.User, int, error) {
	offset := (page - 1) * limit
	var users []domain.User

	countQuery := `SELECT COUNT(*) FROM users WHERE 1=1`
	query := `SELECT id, full_name, email, role, phone, created_at, updated_at FROM users WHERE 1=1`

	args := []interface{}{}
	argIndex := 1

	if searchFilter != "" {
		filter := "%" + searchFilter + "%"
		countQuery += ` AND (email ILIKE $` + fmt.Sprint(argIndex) + ` OR full_name ILIKE $` + fmt.Sprint(argIndex) + `)`
		query += ` AND (email ILIKE $` + fmt.Sprint(argIndex) + ` OR full_name ILIKE $` + fmt.Sprint(argIndex) + `)`
		args = append(args, filter)
		argIndex++
	}

	// Get total count
	var total int
	err := m.Db.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Get paginated users
	query += ` ORDER BY created_at DESC LIMIT $` + fmt.Sprint(argIndex) + ` OFFSET $` + fmt.Sprint(argIndex+1)
	args = append(args, limit, offset)

	rows, err := m.Db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	for rows.Next() {
		var user domain.User
		var phone sql.NullString

		err := rows.Scan(
			&user.ID,
			&user.FullName,
			&user.Email,
			&user.Role,
			&phone,
			&user.CreatedAt,
			&user.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}

		if phone.Valid {
			user.Phone = phone.String
		}

		users = append(users, user)
	}

	return users, total, nil
}

func (m AuthRepository) UpdateUserRole(ctx context.Context, userID, newRole string) error {
	query := `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2`

	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	result, err := m.Db.Exec(ctx, query, newRole, userID)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return appErrors.ErrNoUserRecordExist
	}

	return nil
}

func (m AuthRepository) UpdateUserInfo(ctx context.Context, userID, fullName, phone string) error {
	query := `UPDATE users SET full_name = $1, phone = $2, updated_at = NOW() WHERE id = $3`

	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	result, err := m.Db.Exec(ctx, query, fullName, phone, userID)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return appErrors.ErrNoUserRecordExist
	}

	return nil
}

func (m AuthRepository) CountTotalUsers(ctx context.Context) (int, error) {
	query := `SELECT COUNT(*) FROM users`
	var total int
	err := m.Db.QueryRow(ctx, query).Scan(&total)
	return total, err
}

func (m AuthRepository) SaveOTP(ctx context.Context, email, code, purpose string, expiry time.Duration) error {
	query := `INSERT INTO otps (email, otp_code, purpose, expires_at) VALUES ($1, $2, $3, $4)`
	expiresAt := time.Now().Add(expiry)
	_, err := m.Db.Exec(ctx, query, email, code, purpose, expiresAt)
	return err
}

func (m AuthRepository) VerifyOTP(ctx context.Context, email, code, purpose string) (bool, error) {
	query := `SELECT EXISTS (
		SELECT 1 FROM otps 
		WHERE LOWER(email) = LOWER($1) AND otp_code = $2 AND purpose = $3 AND used = FALSE AND expires_at > NOW()
	)`
	var exists bool
	err := m.Db.QueryRow(ctx, query, email, code, purpose).Scan(&exists)
	return exists, err
}

func (m AuthRepository) MarkOTPUsed(ctx context.Context, email, code, purpose string) error {
	query := `UPDATE otps SET used = TRUE WHERE LOWER(email) = LOWER($1) AND otp_code = $2 AND purpose = $3`
	_, err := m.Db.Exec(ctx, query, email, code, purpose)
	return err
}

// InvalidateActiveOTPs burns every still-valid OTP for an email+purpose. Called
// after a wrong reset-password guess so each issued OTP allows only a single
// attempt — turning the 6-digit code from brute-forceable into one-shot.
func (m AuthRepository) InvalidateActiveOTPs(ctx context.Context, email, purpose string) error {
	query := `UPDATE otps SET used = TRUE WHERE LOWER(email) = LOWER($1) AND purpose = $2 AND used = FALSE`
	_, err := m.Db.Exec(ctx, query, email, purpose)
	return err
}

func (m AuthRepository) DeleteExpiredOTPs(ctx context.Context) error {
	query := `DELETE FROM otps WHERE expires_at < NOW() OR used = TRUE`
	_, err := m.Db.Exec(ctx, query)
	return err
}
