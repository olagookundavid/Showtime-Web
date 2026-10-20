package ports

import (
	"context"
	"errors"
	"fmt"
	"time"

	"showtime-backend/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type FAQRepository interface {
	ListPages(ctx context.Context) ([]domain.FAQPageSummary, error)
	// FindPage returns nil, nil when the key is unknown.
	FindPage(ctx context.Context, key string) (*domain.FAQPage, error)
	CreatePage(ctx context.Context, page *domain.FAQPage) error
	UpdatePage(ctx context.Context, key, name, path, description string) error
	// DeletePage also removes the page's categories and questions.
	DeletePage(ctx context.Context, key string) error

	ListCategories(ctx context.Context, pageKey string) ([]*domain.FAQCategory, error)
	// FindCategory returns nil, nil when the id is unknown.
	FindCategory(ctx context.Context, id string) (*domain.FAQCategory, error)
	CategorySlugExists(ctx context.Context, pageKey, slug string) (bool, error)
	NextCategoryOrder(ctx context.Context, pageKey string) (int, error)
	CreateCategory(ctx context.Context, c *domain.FAQCategory) error
	UpdateCategory(ctx context.Context, id, title, icon string) error
	// DeleteCategory also removes the category's questions.
	DeleteCategory(ctx context.Context, id string) error

	ListItems(ctx context.Context, pageKey string, activeOnly bool) ([]*domain.FAQItem, error)
	// FindItem returns nil, nil when the id is unknown.
	FindItem(ctx context.Context, id string) (*domain.FAQItem, error)
	// NextItemOrder is one past the highest order within a category (or, for nil, among the page's ungrouped questions).
	NextItemOrder(ctx context.Context, pageKey string, categoryID *string) (int, error)
	CreateItem(ctx context.Context, item *domain.FAQItem) error
	UpdateItem(ctx context.Context, item *domain.FAQItem) error
	DeleteItem(ctx context.Context, id string) error

	// ReorderCategories / ReorderItems set display_order to each id's position, atomically.
	ReorderCategories(ctx context.Context, ids []string) error
	ReorderItems(ctx context.Context, ids []string) error
}

type FAQPGRepository struct {
	db *pgxpool.Pool
}

func NewFAQRepository(db *pgxpool.Pool) FAQRepository {
	return &FAQPGRepository{db: db}
}

const faqTimeout = 3 * time.Second

func (r *FAQPGRepository) ListPages(ctx context.Context) ([]domain.FAQPageSummary, error) {
	ctx, cancel := context.WithTimeout(ctx, faqTimeout)
	defer cancel()

	rows, err := r.db.Query(ctx, `
		SELECT p.key, p.name, p.path, p.description, p.created_at, p.updated_at,
		       (SELECT COUNT(*) FROM faq_categories c WHERE c.page_key = p.key),
		       (SELECT COUNT(*) FROM faq_items i WHERE i.page_key = p.key)
		FROM faq_pages p
		ORDER BY p.created_at ASC, p.key ASC`)
	if err != nil {
		return nil, fmt.Errorf("failed to list faq pages: %w", err)
	}
	defer rows.Close()

	out := []domain.FAQPageSummary{}
	for rows.Next() {
		var s domain.FAQPageSummary
		if err := rows.Scan(&s.Key, &s.Name, &s.Path, &s.Description, &s.CreatedAt, &s.UpdatedAt, &s.CategoryCount, &s.ItemCount); err != nil {
			return nil, fmt.Errorf("failed to scan faq page: %w", err)
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func (r *FAQPGRepository) FindPage(ctx context.Context, key string) (*domain.FAQPage, error) {
	ctx, cancel := context.WithTimeout(ctx, faqTimeout)
	defer cancel()

	var p domain.FAQPage
	err := r.db.QueryRow(ctx,
		`SELECT key, name, path, description, created_at, updated_at FROM faq_pages WHERE key = $1`, key).
		Scan(&p.Key, &p.Name, &p.Path, &p.Description, &p.CreatedAt, &p.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to find faq page: %w", err)
	}
	return &p, nil
}

func (r *FAQPGRepository) CreatePage(ctx context.Context, page *domain.FAQPage) error {
	ctx, cancel := context.WithTimeout(ctx, faqTimeout)
	defer cancel()

	err := r.db.QueryRow(ctx,
		`INSERT INTO faq_pages (key, name, path, description) VALUES ($1, $2, $3, $4) RETURNING created_at, updated_at`,
		page.Key, page.Name, page.Path, page.Description).Scan(&page.CreatedAt, &page.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to create faq page: %w", err)
	}
	return nil
}

func (r *FAQPGRepository) UpdatePage(ctx context.Context, key, name, path, description string) error {
	ctx, cancel := context.WithTimeout(ctx, faqTimeout)
	defer cancel()

	_, err := r.db.Exec(ctx,
		`UPDATE faq_pages SET name = $1, path = $2, description = $3, updated_at = NOW() WHERE key = $4`,
		name, path, description, key)
	if err != nil {
		return fmt.Errorf("failed to update faq page: %w", err)
	}
	return nil
}

func (r *FAQPGRepository) DeletePage(ctx context.Context, key string) error {
	ctx, cancel := context.WithTimeout(ctx, faqTimeout)
	defer cancel()

	if _, err := r.db.Exec(ctx, `DELETE FROM faq_pages WHERE key = $1`, key); err != nil {
		return fmt.Errorf("failed to delete faq page: %w", err)
	}
	return nil
}

const faqCategoryColumns = `id, page_key, slug, title, icon, display_order, created_at, updated_at`

func scanFAQCategory(row pgx.Row) (*domain.FAQCategory, error) {
	var c domain.FAQCategory
	if err := row.Scan(&c.ID, &c.PageKey, &c.Slug, &c.Title, &c.Icon, &c.DisplayOrder, &c.CreatedAt, &c.UpdatedAt); err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *FAQPGRepository) ListCategories(ctx context.Context, pageKey string) ([]*domain.FAQCategory, error) {
	ctx, cancel := context.WithTimeout(ctx, faqTimeout)
	defer cancel()

	rows, err := r.db.Query(ctx,
		`SELECT `+faqCategoryColumns+` FROM faq_categories WHERE page_key = $1 ORDER BY display_order ASC, created_at ASC`, pageKey)
	if err != nil {
		return nil, fmt.Errorf("failed to list faq categories: %w", err)
	}
	defer rows.Close()

	out := []*domain.FAQCategory{}
	for rows.Next() {
		c, err := scanFAQCategory(rows)
		if err != nil {
			return nil, fmt.Errorf("failed to scan faq category: %w", err)
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (r *FAQPGRepository) FindCategory(ctx context.Context, id string) (*domain.FAQCategory, error) {
	ctx, cancel := context.WithTimeout(ctx, faqTimeout)
	defer cancel()

	c, err := scanFAQCategory(r.db.QueryRow(ctx, `SELECT `+faqCategoryColumns+` FROM faq_categories WHERE id = $1`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to find faq category: %w", err)
	}
	return c, nil
}

func (r *FAQPGRepository) CategorySlugExists(ctx context.Context, pageKey, slug string) (bool, error) {
	ctx, cancel := context.WithTimeout(ctx, faqTimeout)
	defer cancel()

	var exists bool
	err := r.db.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM faq_categories WHERE page_key = $1 AND slug = $2)`, pageKey, slug).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check faq category slug: %w", err)
	}
	return exists, nil
}

func (r *FAQPGRepository) NextCategoryOrder(ctx context.Context, pageKey string) (int, error) {
	ctx, cancel := context.WithTimeout(ctx, faqTimeout)
	defer cancel()

	var max int
	err := r.db.QueryRow(ctx,
		`SELECT COALESCE(MAX(display_order), -1) FROM faq_categories WHERE page_key = $1`, pageKey).Scan(&max)
	if err != nil {
		return 0, fmt.Errorf("failed to get next faq category order: %w", err)
	}
	return max + 1, nil
}

func (r *FAQPGRepository) CreateCategory(ctx context.Context, c *domain.FAQCategory) error {
	ctx, cancel := context.WithTimeout(ctx, faqTimeout)
	defer cancel()

	err := r.db.QueryRow(ctx,
		`INSERT INTO faq_categories (page_key, slug, title, icon, display_order) VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, created_at, updated_at`,
		c.PageKey, c.Slug, c.Title, c.Icon, c.DisplayOrder).Scan(&c.ID, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to create faq category: %w", err)
	}
	return nil
}

func (r *FAQPGRepository) UpdateCategory(ctx context.Context, id, title, icon string) error {
	ctx, cancel := context.WithTimeout(ctx, faqTimeout)
	defer cancel()

	_, err := r.db.Exec(ctx, `UPDATE faq_categories SET title = $1, icon = $2, updated_at = NOW() WHERE id = $3`, title, icon, id)
	if err != nil {
		return fmt.Errorf("failed to update faq category: %w", err)
	}
	return nil
}

func (r *FAQPGRepository) DeleteCategory(ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(ctx, faqTimeout)
	defer cancel()

	if _, err := r.db.Exec(ctx, `DELETE FROM faq_categories WHERE id = $1`, id); err != nil {
		return fmt.Errorf("failed to delete faq category: %w", err)
	}
	return nil
}

const faqItemColumns = `id, page_key, category_id, question, answer, display_order, is_active, created_at, updated_at`

func scanFAQItem(row pgx.Row) (*domain.FAQItem, error) {
	var i domain.FAQItem
	if err := row.Scan(&i.ID, &i.PageKey, &i.CategoryID, &i.Question, &i.Answer, &i.DisplayOrder, &i.IsActive, &i.CreatedAt, &i.UpdatedAt); err != nil {
		return nil, err
	}
	return &i, nil
}

func (r *FAQPGRepository) ListItems(ctx context.Context, pageKey string, activeOnly bool) ([]*domain.FAQItem, error) {
	ctx, cancel := context.WithTimeout(ctx, faqTimeout)
	defer cancel()

	query := `SELECT ` + faqItemColumns + ` FROM faq_items WHERE page_key = $1`
	if activeOnly {
		query += ` AND is_active = TRUE`
	}
	query += ` ORDER BY display_order ASC, created_at ASC`

	rows, err := r.db.Query(ctx, query, pageKey)
	if err != nil {
		return nil, fmt.Errorf("failed to list faq items: %w", err)
	}
	defer rows.Close()

	out := []*domain.FAQItem{}
	for rows.Next() {
		i, err := scanFAQItem(rows)
		if err != nil {
			return nil, fmt.Errorf("failed to scan faq item: %w", err)
		}
		out = append(out, i)
	}
	return out, rows.Err()
}

func (r *FAQPGRepository) FindItem(ctx context.Context, id string) (*domain.FAQItem, error) {
	ctx, cancel := context.WithTimeout(ctx, faqTimeout)
	defer cancel()

	i, err := scanFAQItem(r.db.QueryRow(ctx, `SELECT `+faqItemColumns+` FROM faq_items WHERE id = $1`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to find faq item: %w", err)
	}
	return i, nil
}

func (r *FAQPGRepository) NextItemOrder(ctx context.Context, pageKey string, categoryID *string) (int, error) {
	ctx, cancel := context.WithTimeout(ctx, faqTimeout)
	defer cancel()

	var max int
	err := r.db.QueryRow(ctx,
		`SELECT COALESCE(MAX(display_order), -1) FROM faq_items
		 WHERE page_key = $1 AND category_id IS NOT DISTINCT FROM $2::uuid`, pageKey, categoryID).Scan(&max)
	if err != nil {
		return 0, fmt.Errorf("failed to get next faq item order: %w", err)
	}
	return max + 1, nil
}

func (r *FAQPGRepository) CreateItem(ctx context.Context, item *domain.FAQItem) error {
	ctx, cancel := context.WithTimeout(ctx, faqTimeout)
	defer cancel()

	err := r.db.QueryRow(ctx,
		`INSERT INTO faq_items (page_key, category_id, question, answer, display_order, is_active)
		 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at, updated_at`,
		item.PageKey, item.CategoryID, item.Question, item.Answer, item.DisplayOrder, item.IsActive).
		Scan(&item.ID, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to create faq item: %w", err)
	}
	return nil
}

func (r *FAQPGRepository) UpdateItem(ctx context.Context, item *domain.FAQItem) error {
	ctx, cancel := context.WithTimeout(ctx, faqTimeout)
	defer cancel()

	_, err := r.db.Exec(ctx,
		`UPDATE faq_items SET category_id = $1, question = $2, answer = $3, display_order = $4, is_active = $5, updated_at = NOW()
		 WHERE id = $6`,
		item.CategoryID, item.Question, item.Answer, item.DisplayOrder, item.IsActive, item.ID)
	if err != nil {
		return fmt.Errorf("failed to update faq item: %w", err)
	}
	return nil
}

func (r *FAQPGRepository) DeleteItem(ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(ctx, faqTimeout)
	defer cancel()

	if _, err := r.db.Exec(ctx, `DELETE FROM faq_items WHERE id = $1`, id); err != nil {
		return fmt.Errorf("failed to delete faq item: %w", err)
	}
	return nil
}

func (r *FAQPGRepository) ReorderCategories(ctx context.Context, ids []string) error {
	return r.reorder(ctx, `UPDATE faq_categories SET display_order = $1, updated_at = NOW() WHERE id = $2`, ids)
}

func (r *FAQPGRepository) ReorderItems(ctx context.Context, ids []string) error {
	return r.reorder(ctx, `UPDATE faq_items SET display_order = $1, updated_at = NOW() WHERE id = $2`, ids)
}

// reorder numbers the rows 0..n-1 in the order given, in one transaction so a
// failure never leaves the list half renumbered.
func (r *FAQPGRepository) reorder(ctx context.Context, update string, ids []string) error {
	ctx, cancel := context.WithTimeout(ctx, 2*faqTimeout)
	defer cancel()

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to start faq reorder: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op once committed

	for i, id := range ids {
		if _, err := tx.Exec(ctx, update, i, id); err != nil {
			return fmt.Errorf("failed to reorder faq: %w", err)
		}
	}
	return tx.Commit(ctx)
}
