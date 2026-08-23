package ports

import (
	"context"
	"fmt"
	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type NewsRepository interface {
	Create(ctx context.Context, news *domain.News) error
	Update(ctx context.Context, news *domain.News) error
	FindAll(ctx context.Context, query dto.PaginationQuery) ([]*domain.News, int64, error)
	FindByID(ctx context.Context, id string) (*domain.News, error)
	FindBySlug(ctx context.Context, slug string) (*domain.News, error)
	Delete(ctx context.Context, id string) error
	UpdateCommentSettings(ctx context.Context, id string, commentsEnabled bool) error
}

type NewsPGRepository struct {
	db *pgxpool.Pool
}

func NewNewsRepository(db *pgxpool.Pool) NewsRepository {
	return &NewsPGRepository{db: db}
}

func (r *NewsPGRepository) Create(ctx context.Context, news *domain.News) error {
	query := `
		INSERT INTO news (title, slug, excerpt, content, featured_image, featured_media_type, featured_youtube_url, author, category, published_at, created_at, updated_at, is_hero_only, comments_enabled)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		RETURNING id
	`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	err := r.db.QueryRow(ctx, query,
		news.Title, news.Slug, news.Excerpt, news.Content, news.FeaturedImage, news.FeaturedMediaType, news.FeaturedYoutubeURL, news.Author, news.Category, news.PublishedAt, news.CreatedAt, news.UpdatedAt, news.IsHeroOnly, news.CommentsEnabled,
	).Scan(&news.ID)

	if err != nil {
		println(err.Error())
		return fmt.Errorf("failed to create news item: %w", err)
	}
	return nil
}

func (r *NewsPGRepository) Update(ctx context.Context, news *domain.News) error {
	query := `
		UPDATE news
		SET title = $2, slug = $3, excerpt = $4, content = $5, featured_image = $6, featured_media_type = $7, featured_youtube_url = $8, author = $9, category = $10, published_at = $11, updated_at = $12, comments_enabled = $13
		WHERE id = $1
	`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	tag, err := r.db.Exec(ctx, query,
		news.ID, news.Title, news.Slug, news.Excerpt, news.Content, news.FeaturedImage, news.FeaturedMediaType, news.FeaturedYoutubeURL, news.Author, news.Category, news.PublishedAt, news.UpdatedAt, news.CommentsEnabled,
	)
	if err != nil {
		return fmt.Errorf("failed to update news item: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("news item not found")
	}
	return nil
}

func (r *NewsPGRepository) FindAll(ctx context.Context, q dto.PaginationQuery) ([]*domain.News, int64, error) {
	offset := (q.Page - 1) * q.Limit
	// is_hero_only articles are authored from the Hero Slides admin and must
	// never appear in the public feed or the admin news list — only reachable
	// directly via FindBySlug from the carousel link.
	baseQuery := ` FROM news WHERE is_hero_only = FALSE `
	args := []any{}
	argCount := 1

	if q.Category != "" {
		baseQuery += ` AND category ILIKE $` + strconv.Itoa(argCount)
		args = append(args, q.Category)
		argCount++
	}
	if q.Author != "" {
		baseQuery += ` AND author ILIKE $` + strconv.Itoa(argCount)
		args = append(args, q.Author)
		argCount++
	}
	if q.Search != "" {
		baseQuery += ` AND (title ILIKE $` + strconv.Itoa(argCount) + ` OR content ILIKE $` + strconv.Itoa(argCount) + ` OR category ILIKE $` + strconv.Itoa(argCount) + ` OR author ILIKE $` + strconv.Itoa(argCount) + `)`
		args = append(args, "%"+q.Search+"%")
		argCount++
	}

	query := `SELECT id, title, slug, excerpt, content, featured_image, featured_media_type, featured_youtube_url, author, category, published_at, created_at, updated_at, comments_enabled, count(*) OVER() ` +
		baseQuery + ` ORDER BY published_at DESC LIMIT $` + strconv.Itoa(argCount) + ` OFFSET $` + strconv.Itoa(argCount+1)

	args = append(args, q.Limit, offset)

	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to fetch news items: %w", err)
	}
	defer rows.Close()

	var newsList []*domain.News
	var total int64

	for rows.Next() {
		var n domain.News
		if err := rows.Scan(
			&n.ID, &n.Title, &n.Slug, &n.Excerpt, &n.Content, &n.FeaturedImage, &n.FeaturedMediaType, &n.FeaturedYoutubeURL, &n.Author, &n.Category, &n.PublishedAt, &n.CreatedAt, &n.UpdatedAt, &n.CommentsEnabled, &total,
		); err != nil {
			return nil, 0, fmt.Errorf("failed to scan news item: %w", err)
		}
		newsList = append(newsList, &n)
	}

	return newsList, total, nil
}

func (r *NewsPGRepository) FindByID(ctx context.Context, id string) (*domain.News, error) {
	query := `SELECT id, title, slug, excerpt, content, featured_image, featured_media_type, featured_youtube_url, author, category, published_at, created_at, updated_at, is_hero_only, comments_enabled FROM news WHERE id = $1`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var n domain.News
	err := r.db.QueryRow(ctx, query, id).Scan(
		&n.ID, &n.Title, &n.Slug, &n.Excerpt, &n.Content, &n.FeaturedImage, &n.FeaturedMediaType, &n.FeaturedYoutubeURL, &n.Author, &n.Category, &n.PublishedAt, &n.CreatedAt, &n.UpdatedAt, &n.IsHeroOnly, &n.CommentsEnabled,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to find news item: %w", err)
	}
	return &n, nil
}

// FindBySlug looks up a single article by slug, WITHOUT filtering is_hero_only
// — a hero-carousel article must still resolve when linked to directly, even
// though it's excluded from the list views.
func (r *NewsPGRepository) FindBySlug(ctx context.Context, slug string) (*domain.News, error) {
	query := `SELECT id, title, slug, excerpt, content, featured_image, featured_media_type, featured_youtube_url, author, category, published_at, created_at, updated_at, is_hero_only, comments_enabled FROM news WHERE slug = $1`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var n domain.News
	err := r.db.QueryRow(ctx, query, slug).Scan(
		&n.ID, &n.Title, &n.Slug, &n.Excerpt, &n.Content, &n.FeaturedImage, &n.FeaturedMediaType, &n.FeaturedYoutubeURL, &n.Author, &n.Category, &n.PublishedAt, &n.CreatedAt, &n.UpdatedAt, &n.IsHeroOnly, &n.CommentsEnabled,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to find news item by slug: %w", err)
	}
	return &n, nil
}

func (r *NewsPGRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM news WHERE id = $1`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	_, err := r.db.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete news item: %w", err)
	}
	return nil
}

func (r *NewsPGRepository) UpdateCommentSettings(ctx context.Context, id string, commentsEnabled bool) error {
	query := `UPDATE news SET comments_enabled = $2, updated_at = NOW() WHERE id = $1`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	tag, err := r.db.Exec(ctx, query, id, commentsEnabled)
	if err != nil {
		return fmt.Errorf("failed to update news comment settings: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("news item not found")
	}
	return nil
}
