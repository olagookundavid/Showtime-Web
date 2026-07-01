package ports

import (
	"context"
	"fmt"
	"showtime-backend/internal/domain"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type HeroSlideRepository interface {
	Create(ctx context.Context, slide *domain.HeroSlide) error
	Update(ctx context.Context, id string, imageURL, mobileImageURL *string, displayOrder *int, isActive *bool) error
	FindAll(ctx context.Context, activeOnly bool) ([]*domain.HeroSlide, error)
	FindByID(ctx context.Context, id string) (*domain.HeroSlide, error)
	Count(ctx context.Context) (int, error)
	Delete(ctx context.Context, id string) error
}

type HeroSlidePGRepository struct {
	db *pgxpool.Pool
}

func NewHeroSlideRepository(db *pgxpool.Pool) HeroSlideRepository {
	return &HeroSlidePGRepository{db: db}
}

func (r *HeroSlidePGRepository) Create(ctx context.Context, slide *domain.HeroSlide) error {
	query := `
		INSERT INTO hero_slides (image_url, mobile_image_url, display_order, is_active)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at, updated_at
	`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	err := r.db.QueryRow(ctx, query, slide.ImageURL, slide.MobileImageURL, slide.DisplayOrder, slide.IsActive).
		Scan(&slide.ID, &slide.CreatedAt, &slide.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to create hero slide: %w", err)
	}
	return nil
}

func (r *HeroSlidePGRepository) Update(ctx context.Context, id string, imageURL, mobileImageURL *string, displayOrder *int, isActive *bool) error {
	// Dynamic UPDATE — only set columns the caller actually passed.
	query := `UPDATE hero_slides SET updated_at = NOW()`
	args := []interface{}{}
	argIdx := 1

	if imageURL != nil {
		query += fmt.Sprintf(", image_url = $%d", argIdx)
		args = append(args, *imageURL)
		argIdx++
	}
	if mobileImageURL != nil {
		query += fmt.Sprintf(", mobile_image_url = $%d", argIdx)
		args = append(args, *mobileImageURL)
		argIdx++
	}
	if displayOrder != nil {
		query += fmt.Sprintf(", display_order = $%d", argIdx)
		args = append(args, *displayOrder)
		argIdx++
	}
	if isActive != nil {
		query += fmt.Sprintf(", is_active = $%d", argIdx)
		args = append(args, *isActive)
		argIdx++
	}

	query += fmt.Sprintf(" WHERE id = $%d", argIdx)
	args = append(args, id)

	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	tag, err := r.db.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to update hero slide: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("hero slide not found")
	}
	return nil
}

func (r *HeroSlidePGRepository) FindAll(ctx context.Context, activeOnly bool) ([]*domain.HeroSlide, error) {
	query := `
		SELECT id, image_url, COALESCE(mobile_image_url, ''), display_order, is_active, created_at, updated_at
		FROM hero_slides
	`
	if activeOnly {
		query += ` WHERE is_active = TRUE`
	}
	query += ` ORDER BY display_order ASC, created_at ASC`

	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch hero slides: %w", err)
	}
	defer rows.Close()

	var slides []*domain.HeroSlide
	for rows.Next() {
		var s domain.HeroSlide
		if err := rows.Scan(&s.ID, &s.ImageURL, &s.MobileImageURL, &s.DisplayOrder, &s.IsActive, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan hero slide: %w", err)
		}
		slides = append(slides, &s)
	}
	return slides, nil
}

func (r *HeroSlidePGRepository) FindByID(ctx context.Context, id string) (*domain.HeroSlide, error) {
	query := `
		SELECT id, image_url, COALESCE(mobile_image_url, ''), display_order, is_active, created_at, updated_at
		FROM hero_slides WHERE id = $1
	`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var s domain.HeroSlide
	err := r.db.QueryRow(ctx, query, id).
		Scan(&s.ID, &s.ImageURL, &s.MobileImageURL, &s.DisplayOrder, &s.IsActive, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to find hero slide: %w", err)
	}
	return &s, nil
}

func (r *HeroSlidePGRepository) Count(ctx context.Context) (int, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var n int
	err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM hero_slides`).Scan(&n)
	if err != nil {
		return 0, fmt.Errorf("failed to count hero slides: %w", err)
	}
	return n, nil
}

func (r *HeroSlidePGRepository) Delete(ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	_, err := r.db.Exec(ctx, `DELETE FROM hero_slides WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("failed to delete hero slide: %w", err)
	}
	return nil
}
