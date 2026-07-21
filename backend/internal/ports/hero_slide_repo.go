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
	// LinkNews sets news_id directly — only used to attach an article to a
	// legacy slide (created before this feature) that doesn't have one yet.
	// The normal Update path never touches news_id once a slide is linked.
	LinkNews(ctx context.Context, id string, newsID *string) error
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

// heroSlideSelectColumns LEFT JOINs the linked article so reads can hydrate
// slide.News. Non-id article columns are COALESCEd to ” since they're only
// meaningful when the join matched (guarded by newsIDPtr != nil at scan time).
const heroSlideSelectColumns = `
	hs.id, hs.image_url, COALESCE(hs.mobile_image_url, ''), hs.display_order, hs.is_active, hs.created_at, hs.updated_at,
	hs.news_id,
	COALESCE(n.slug, ''), COALESCE(n.title, ''), COALESCE(n.excerpt, ''), COALESCE(n.content, ''),
	COALESCE(n.category, ''), COALESCE(n.featured_media_type, ''), COALESCE(n.featured_youtube_url, '')
`
const heroSlideSelectFrom = `FROM hero_slides hs LEFT JOIN news n ON hs.news_id = n.id`

func scanHeroSlide(row pgx.Row) (*domain.HeroSlide, error) {
	var s domain.HeroSlide
	var newsIDPtr *string
	var newsSlug, newsTitle, newsExcerpt, newsContent, newsCategory, newsMediaType, newsYoutubeURL string

	if err := row.Scan(
		&s.ID, &s.ImageURL, &s.MobileImageURL, &s.DisplayOrder, &s.IsActive, &s.CreatedAt, &s.UpdatedAt,
		&newsIDPtr,
		&newsSlug, &newsTitle, &newsExcerpt, &newsContent, &newsCategory, &newsMediaType, &newsYoutubeURL,
	); err != nil {
		return nil, err
	}

	if newsIDPtr != nil {
		s.NewsID = newsIDPtr
		s.News = &domain.News{
			ID:                 *newsIDPtr,
			Slug:               newsSlug,
			Title:              newsTitle,
			Excerpt:            newsExcerpt,
			Content:            newsContent,
			Category:           newsCategory,
			FeaturedMediaType:  newsMediaType,
			FeaturedYoutubeURL: newsYoutubeURL,
		}
	}
	return &s, nil
}

func (r *HeroSlidePGRepository) Create(ctx context.Context, slide *domain.HeroSlide) error {
	query := `
		INSERT INTO hero_slides (image_url, mobile_image_url, display_order, is_active, news_id)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at
	`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	err := r.db.QueryRow(ctx, query, slide.ImageURL, slide.MobileImageURL, slide.DisplayOrder, slide.IsActive, slide.NewsID).
		Scan(&slide.ID, &slide.CreatedAt, &slide.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to create hero slide: %w", err)
	}
	return nil
}

func (r *HeroSlidePGRepository) LinkNews(ctx context.Context, id string, newsID *string) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	tag, err := r.db.Exec(ctx, `UPDATE hero_slides SET news_id = $2, updated_at = NOW() WHERE id = $1`, id, newsID)
	if err != nil {
		return fmt.Errorf("failed to link hero slide to news: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("hero slide not found")
	}
	return nil
}

func (r *HeroSlidePGRepository) Update(ctx context.Context, id string, imageURL, mobileImageURL *string, displayOrder *int, isActive *bool) error {
	// Dynamic UPDATE — only set columns the caller actually passed. news_id is
	// intentionally never changed here: a slide's linked article identity is
	// fixed at creation; only the article's own content changes (handled via
	// the news repo directly by the service).
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
	query := `SELECT ` + heroSlideSelectColumns + ` ` + heroSlideSelectFrom
	if activeOnly {
		query += ` WHERE hs.is_active = TRUE`
	}
	query += ` ORDER BY hs.display_order ASC, hs.created_at ASC`

	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch hero slides: %w", err)
	}
	defer rows.Close()

	var slides []*domain.HeroSlide
	for rows.Next() {
		s, err := scanHeroSlide(rows)
		if err != nil {
			return nil, fmt.Errorf("failed to scan hero slide: %w", err)
		}
		slides = append(slides, s)
	}
	return slides, nil
}

func (r *HeroSlidePGRepository) FindByID(ctx context.Context, id string) (*domain.HeroSlide, error) {
	query := `SELECT ` + heroSlideSelectColumns + ` ` + heroSlideSelectFrom + ` WHERE hs.id = $1`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	s, err := scanHeroSlide(r.db.QueryRow(ctx, query, id))
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to find hero slide: %w", err)
	}
	return s, nil
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
