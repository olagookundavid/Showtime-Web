package ports

import (
	"context"
	"fmt"
	"showtime-backend/internal/domain"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type GalleryRepository interface {
	Create(ctx context.Context, gallery *domain.Gallery) error
	Update(ctx context.Context, gallery *domain.Gallery) error
	FindAll(ctx context.Context, limit, offset int) ([]*domain.Gallery, int64, error)
	FindByID(ctx context.Context, id string) (*domain.Gallery, error)
	Delete(ctx context.Context, id string) error
}

type GalleryPGRepository struct {
	db *pgxpool.Pool
}

func NewGalleryRepository(db *pgxpool.Pool) GalleryRepository {
	return &GalleryPGRepository{db: db}
}

func (r *GalleryPGRepository) Create(ctx context.Context, gallery *domain.Gallery) error {
	query := `
		INSERT INTO gallery (game_week, date, players_photo_url, fans_photo_url, created_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	err := r.db.QueryRow(ctx, query,
		gallery.GameWeek, gallery.Date, gallery.PlayersPhotoURL, gallery.FansPhotoURL, gallery.CreatedAt,
	).Scan(&gallery.ID)

	if err != nil {
		return fmt.Errorf("failed to create gallery item: %w", err)
	}
	return nil
}

func (r *GalleryPGRepository) Update(ctx context.Context, gallery *domain.Gallery) error {
	query := `
		UPDATE gallery
		SET game_week = $2, date = $3, players_photo_url = $4, fans_photo_url = $5
		WHERE id = $1
	`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	tag, err := r.db.Exec(ctx, query,
		gallery.ID, gallery.GameWeek, gallery.Date, gallery.PlayersPhotoURL, gallery.FansPhotoURL,
	)
	if err != nil {
		return fmt.Errorf("failed to update gallery item: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("gallery item not found")
	}
	return nil
}

func (r *GalleryPGRepository) FindAll(ctx context.Context, limit, offset int) ([]*domain.Gallery, int64, error) {
	query := `
		SELECT id, game_week, date, players_photo_url, fans_photo_url, created_at, count(*) OVER()
		FROM gallery
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2
	`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	rows, err := r.db.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to fetch gallery items: %w", err)
	}
	defer rows.Close()

	var galleryList []*domain.Gallery
	var total int64

	for rows.Next() {
		var g domain.Gallery
		if err := rows.Scan(
			&g.ID, &g.GameWeek, &g.Date, &g.PlayersPhotoURL, &g.FansPhotoURL, &g.CreatedAt, &total,
		); err != nil {
			return nil, 0, fmt.Errorf("failed to scan gallery item: %w", err)
		}
		galleryList = append(galleryList, &g)
	}

	return galleryList, total, nil
}

func (r *GalleryPGRepository) FindByID(ctx context.Context, id string) (*domain.Gallery, error) {
	query := `SELECT id, game_week, date, players_photo_url, fans_photo_url, created_at FROM gallery WHERE id = $1`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var g domain.Gallery
	err := r.db.QueryRow(ctx, query, id).Scan(
		&g.ID, &g.GameWeek, &g.Date, &g.PlayersPhotoURL, &g.FansPhotoURL, &g.CreatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to find gallery item: %w", err)
	}
	return &g, nil
}

func (r *GalleryPGRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM gallery WHERE id = $1`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	_, err := r.db.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete gallery item: %w", err)
	}
	return nil
}
