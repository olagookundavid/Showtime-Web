package ports

import (
	"context"
	"fmt"
	"showtime-backend/internal/domain"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type NewsRepository interface {
	Create(ctx context.Context, news *domain.News) error
	Update(ctx context.Context, news *domain.News) error
	FindAll(ctx context.Context, limit, offset int) ([]*domain.News, int64, error)
	FindByID(ctx context.Context, id string) (*domain.News, error)
	Delete(ctx context.Context, id string) error
}

type NewsPGRepository struct {
	db *pgxpool.Pool
}

func NewNewsRepository(db *pgxpool.Pool) NewsRepository {
	return &NewsPGRepository{db: db}
}

func (r *NewsPGRepository) Create(ctx context.Context, news *domain.News) error {
	query := `
		INSERT INTO news (title, slug, excerpt, content, featured_image, author, category, published_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id
	`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	err := r.db.QueryRow(ctx, query,
		news.Title, news.Slug, news.Excerpt, news.Content, news.FeaturedImage, news.Author, news.Category, news.PublishedAt, news.CreatedAt, news.UpdatedAt,
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
		SET title = $2, slug = $3, excerpt = $4, content = $5, featured_image = $6, author = $7, category = $8, published_at = $9, updated_at = $10
		WHERE id = $1
	`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	tag, err := r.db.Exec(ctx, query,
		news.ID, news.Title, news.Slug, news.Excerpt, news.Content, news.FeaturedImage, news.Author, news.Category, news.PublishedAt, news.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to update news item: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("news item not found")
	}
	return nil
}

func (r *NewsPGRepository) FindAll(ctx context.Context, limit, offset int) ([]*domain.News, int64, error) {
	query := `
		SELECT id, title, slug, excerpt, content, featured_image, author, category, published_at, created_at, updated_at, count(*) OVER()
		FROM news
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2
	`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	rows, err := r.db.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to fetch news items: %w", err)
	}
	defer rows.Close()

	var newsList []*domain.News
	var total int64

	for rows.Next() {
		var n domain.News
		if err := rows.Scan(
			&n.ID, &n.Title, &n.Slug, &n.Excerpt, &n.Content, &n.FeaturedImage, &n.Author, &n.Category, &n.PublishedAt, &n.CreatedAt, &n.UpdatedAt, &total,
		); err != nil {
			return nil, 0, fmt.Errorf("failed to scan news item: %w", err)
		}
		newsList = append(newsList, &n)
	}

	return newsList, total, nil
}

func (r *NewsPGRepository) FindByID(ctx context.Context, id string) (*domain.News, error) {
	query := `SELECT id, title, slug, excerpt, content, featured_image, author, category, published_at, created_at, updated_at FROM news WHERE id = $1`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var n domain.News
	err := r.db.QueryRow(ctx, query, id).Scan(
		&n.ID, &n.Title, &n.Slug, &n.Excerpt, &n.Content, &n.FeaturedImage, &n.Author, &n.Category, &n.PublishedAt, &n.CreatedAt, &n.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to find news item: %w", err)
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
