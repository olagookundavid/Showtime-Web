package ports

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type IAppSettingRepository interface {
	// Get returns the stored value, or "" when the key has never been set.
	Get(ctx context.Context, key string) (string, error)
	Set(ctx context.Context, key, value string) error
	// SetMany writes several settings in one transaction: all of them or none.
	SetMany(ctx context.Context, values map[string]string) error
}

type PostgresAppSettingRepository struct {
	db *pgxpool.Pool
}

func NewAppSettingRepository(db *pgxpool.Pool) IAppSettingRepository {
	return &PostgresAppSettingRepository{db: db}
}

func (r *PostgresAppSettingRepository) Get(ctx context.Context, key string) (string, error) {
	query := `SELECT setting_value FROM app_settings WHERE setting_key = $1`

	var value string
	err := r.db.QueryRow(ctx, query, key).Scan(&value)
	if errors.Is(err, pgx.ErrNoRows) {
		// An unset key is not an error — the caller falls back to its default.
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return value, nil
}

func (r *PostgresAppSettingRepository) SetMany(ctx context.Context, values map[string]string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	for key, value := range values {
		if _, err := tx.Exec(ctx, `
			INSERT INTO app_settings (setting_key, setting_value, updated_at)
			VALUES ($1, $2, NOW())
			ON CONFLICT (setting_key)
			DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW()
		`, key, value); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (r *PostgresAppSettingRepository) Set(ctx context.Context, key, value string) error {
	query := `
		INSERT INTO app_settings (setting_key, setting_value, updated_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (setting_key)
		DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW()
	`
	_, err := r.db.Exec(ctx, query, key, value)
	return err
}
