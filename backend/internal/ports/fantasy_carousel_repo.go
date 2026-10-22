package ports

import (
	"context"
	"errors"
	"fmt"
	"time"

	"showtime-backend/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// FantasyCarouselRepository stores the articles featured on the Fantasy page.
type FantasyCarouselRepository interface {
	// List returns the slides in display order, each with its article. With
	// activeOnly it skips hidden slides, which is what the public page reads.
	List(ctx context.Context, activeOnly bool) ([]*domain.FantasyCarouselSlide, error)
	// Count is how many slides exist, hidden ones included.
	Count(ctx context.Context) (int, error)
	// Add features an article, after the last slide. It refuses an article that
	// is already a slide and a carousel already at domain.FantasyCarouselMax.
	Add(ctx context.Context, newsID string, isActive bool) (*domain.FantasyCarouselSlide, error)
	Update(ctx context.Context, id string, displayOrder *int, isActive *bool) error
	// Delete takes the slide off the carousel. The article is left alone.
	Delete(ctx context.Context, id string) error
}

type FantasyCarouselPGRepository struct {
	db *pgxpool.Pool
}

func NewFantasyCarouselRepository(db *pgxpool.Pool) FantasyCarouselRepository {
	return &FantasyCarouselPGRepository{db: db}
}

// fantasyCarouselLockKey serialises Add, so two editors adding at the same
// moment cannot both see nine slides and push the carousel to eleven.
const fantasyCarouselLockKey = 724019

func (r *FantasyCarouselPGRepository) List(ctx context.Context, activeOnly bool) ([]*domain.FantasyCarouselSlide, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	query := `
		SELECT s.id, s.news_id, s.display_order, s.is_active, s.created_at, s.updated_at,
		       n.slug, n.title, COALESCE(n.excerpt, ''), n.content, COALESCE(n.featured_image, ''),
		       n.featured_media_type, n.featured_youtube_url, COALESCE(n.category, ''), n.published_at
		FROM fantasy_carousel_slides s
		JOIN news n ON n.id = s.news_id
	`
	if activeOnly {
		query += ` WHERE s.is_active = TRUE`
	}
	query += ` ORDER BY s.display_order ASC, s.created_at ASC, s.id ASC`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list fantasy carousel slides: %w", err)
	}
	defer rows.Close()

	out := make([]*domain.FantasyCarouselSlide, 0)
	for rows.Next() {
		s := &domain.FantasyCarouselSlide{News: &domain.News{}}
		n := s.News
		if err := rows.Scan(&s.ID, &s.NewsID, &s.DisplayOrder, &s.IsActive, &s.CreatedAt, &s.UpdatedAt,
			&n.Slug, &n.Title, &n.Excerpt, &n.Content, &n.FeaturedImage,
			&n.FeaturedMediaType, &n.FeaturedYoutubeURL, &n.Category, &n.PublishedAt); err != nil {
			return nil, fmt.Errorf("failed to scan fantasy carousel slide: %w", err)
		}
		n.ID = s.NewsID
		out = append(out, s)
	}
	return out, rows.Err()
}

func (r *FantasyCarouselPGRepository) Count(ctx context.Context) (int, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	var n int
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM fantasy_carousel_slides`).Scan(&n); err != nil {
		return 0, fmt.Errorf("failed to count fantasy carousel slides: %w", err)
	}
	return n, nil
}

func (r *FantasyCarouselPGRepository) Add(ctx context.Context, newsID string, isActive bool) (*domain.FantasyCarouselSlide, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, fantasyCarouselLockKey); err != nil {
		return nil, fmt.Errorf("failed to lock the fantasy carousel: %w", err)
	}

	// Only a public article can be featured: a hero-only article exists solely
	// behind a legacy homepage slide and has no page of its own in the feed.
	var visible bool
	if err := tx.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM news WHERE id = $1 AND is_hero_only = FALSE)`, newsID).Scan(&visible); err != nil {
		return nil, fmt.Errorf("failed to look up the article: %w", err)
	}
	if !visible {
		return nil, domain.ErrFantasyCarouselArticleNotFound
	}

	var count, nextOrder int
	if err := tx.QueryRow(ctx,
		`SELECT COUNT(*), COALESCE(MAX(display_order) + 1, 0) FROM fantasy_carousel_slides`).Scan(&count, &nextOrder); err != nil {
		return nil, fmt.Errorf("failed to count fantasy carousel slides: %w", err)
	}
	if count >= domain.FantasyCarouselMax {
		return nil, domain.ErrFantasyCarouselFull
	}

	s := &domain.FantasyCarouselSlide{NewsID: newsID, DisplayOrder: nextOrder, IsActive: isActive}
	err = tx.QueryRow(ctx, `
		INSERT INTO fantasy_carousel_slides (news_id, display_order, is_active)
		VALUES ($1, $2, $3)
		RETURNING id, created_at, updated_at
	`, newsID, nextOrder, isActive).Scan(&s.ID, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, domain.ErrAlreadyOnFantasyCarousel
		}
		return nil, fmt.Errorf("failed to add the fantasy carousel slide: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s, nil
}

func (r *FantasyCarouselPGRepository) Update(ctx context.Context, id string, displayOrder *int, isActive *bool) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	tag, err := r.db.Exec(ctx, `
		UPDATE fantasy_carousel_slides
		SET display_order = COALESCE($2, display_order),
		    is_active = COALESCE($3, is_active),
		    updated_at = NOW()
		WHERE id = $1
	`, id, displayOrder, isActive)
	if err != nil {
		return fmt.Errorf("failed to update the fantasy carousel slide: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (r *FantasyCarouselPGRepository) Delete(ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	tag, err := r.db.Exec(ctx, `DELETE FROM fantasy_carousel_slides WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("failed to remove the fantasy carousel slide: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}
