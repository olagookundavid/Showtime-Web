package ports

import (
	"context"
	"time"

	"showtime-backend/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ITransferWindowRepository interface {
	CreateWindow(ctx context.Context, w *domain.TransferWindow) error
	GetActiveWindow(ctx context.Context) (*domain.TransferWindow, error)
	GetAllWindows(ctx context.Context) ([]domain.TransferWindow, error)
	GetWindowByID(ctx context.Context, id string) (*domain.TransferWindow, error)
	UpdateWindow(ctx context.Context, w *domain.TransferWindow) error
	DeleteWindow(ctx context.Context, id string) error
	IsWindowOpen(ctx context.Context) (bool, error)
}

type PostgresTransferWindowRepository struct {
	db *pgxpool.Pool
}

func NewTransferWindowRepository(db *pgxpool.Pool) ITransferWindowRepository {
	return &PostgresTransferWindowRepository{db: db}
}

func (r *PostgresTransferWindowRepository) CreateWindow(ctx context.Context, w *domain.TransferWindow) error {
	query := `
		INSERT INTO transfer_windows (name, opens_at, closes_at, is_active)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at, updated_at
	`
	return r.db.QueryRow(ctx, query, w.Name, w.OpensAt, w.ClosesAt, w.IsActive).Scan(&w.ID, &w.CreatedAt, &w.UpdatedAt)
}

func (r *PostgresTransferWindowRepository) GetActiveWindow(ctx context.Context) (*domain.TransferWindow, error) {
	query := `
		SELECT id, name, opens_at, closes_at, is_active, created_at, updated_at
		FROM transfer_windows
		WHERE is_active = true AND NOW() BETWEEN opens_at AND closes_at
		ORDER BY opens_at DESC LIMIT 1
	`
	var w domain.TransferWindow
	err := r.db.QueryRow(ctx, query).Scan(&w.ID, &w.Name, &w.OpensAt, &w.ClosesAt, &w.IsActive, &w.CreatedAt, &w.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil // No active window currently open
		}
		return nil, err
	}
	w.IsOpen = true
	return &w, nil
}

func (r *PostgresTransferWindowRepository) IsWindowOpen(ctx context.Context) (bool, error) {
	w, err := r.GetActiveWindow(ctx)
	if err != nil {
		return false, err
	}
	return w != nil, nil
}

func (r *PostgresTransferWindowRepository) GetAllWindows(ctx context.Context) ([]domain.TransferWindow, error) {
	query := `
		SELECT id, name, opens_at, closes_at, is_active, created_at, updated_at
		FROM transfer_windows
		ORDER BY opens_at DESC
	`
	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	now := time.Now()
	var windows []domain.TransferWindow
	for rows.Next() {
		var w domain.TransferWindow
		if err := rows.Scan(&w.ID, &w.Name, &w.OpensAt, &w.ClosesAt, &w.IsActive, &w.CreatedAt, &w.UpdatedAt); err != nil {
			return nil, err
		}
		w.IsOpen = w.IsActive && now.After(w.OpensAt) && now.Before(w.ClosesAt)
		windows = append(windows, w)
	}
	return windows, nil
}

func (r *PostgresTransferWindowRepository) GetWindowByID(ctx context.Context, id string) (*domain.TransferWindow, error) {
	query := `
		SELECT id, name, opens_at, closes_at, is_active, created_at, updated_at
		FROM transfer_windows
		WHERE id = $1
	`
	var w domain.TransferWindow
	err := r.db.QueryRow(ctx, query, id).Scan(&w.ID, &w.Name, &w.OpensAt, &w.ClosesAt, &w.IsActive, &w.CreatedAt, &w.UpdatedAt)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	w.IsOpen = w.IsActive && now.After(w.OpensAt) && now.Before(w.ClosesAt)
	return &w, nil
}

func (r *PostgresTransferWindowRepository) UpdateWindow(ctx context.Context, w *domain.TransferWindow) error {
	query := `
		UPDATE transfer_windows
		SET name = $1, opens_at = $2, closes_at = $3, is_active = $4, updated_at = NOW()
		WHERE id = $5
	`
	_, err := r.db.Exec(ctx, query, w.Name, w.OpensAt, w.ClosesAt, w.IsActive, w.ID)
	return err
}

func (r *PostgresTransferWindowRepository) DeleteWindow(ctx context.Context, id string) error {
	query := `DELETE FROM transfer_windows WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}
