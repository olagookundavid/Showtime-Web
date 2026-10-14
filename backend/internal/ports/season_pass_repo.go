package ports

import (
	"context"
	"fmt"

	"showtime-backend/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// SeasonPassRepository stores season passes. A pass holds no price: what it costs
// is worked out from the match days that remain.
type SeasonPassRepository interface {
	Create(ctx context.Context, p *domain.SeasonPass) error
	Update(ctx context.Context, p *domain.SeasonPass) error
	GetByID(ctx context.Context, id string) (*domain.SeasonPass, error)
	GetByProduct(ctx context.Context, productID string) (*domain.SeasonPass, error)
	List(ctx context.Context, activeOnly bool) ([]domain.SeasonPass, error)
	// Delete refuses while anyone has paid for the pass; turn it off instead.
	Delete(ctx context.Context, id string) error
}

type PostgresSeasonPassRepository struct {
	db *pgxpool.Pool
}

func NewSeasonPassRepository(db *pgxpool.Pool) *PostgresSeasonPassRepository {
	return &PostgresSeasonPassRepository{db: db}
}

const seasonPassColumns = `id, product_id, name, description, percent_off::float8, is_active, created_at, updated_at`

func scanSeasonPass(row pgx.Row, p *domain.SeasonPass) error {
	return row.Scan(&p.ID, &p.ProductID, &p.Name, &p.Description, &p.PercentOff, &p.IsActive, &p.CreatedAt, &p.UpdatedAt)
}

func (r *PostgresSeasonPassRepository) Create(ctx context.Context, p *domain.SeasonPass) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO season_passes (product_id, name, description, percent_off, is_active)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at`,
		p.ProductID, p.Name, p.Description, p.PercentOff, p.IsActive,
	).Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)
}

func (r *PostgresSeasonPassRepository) Update(ctx context.Context, p *domain.SeasonPass) error {
	return r.db.QueryRow(ctx, `
		UPDATE season_passes
		SET name = $1, description = $2, percent_off = $3, is_active = $4, updated_at = NOW()
		WHERE id = $5
		RETURNING updated_at`,
		p.Name, p.Description, p.PercentOff, p.IsActive, p.ID,
	).Scan(&p.UpdatedAt)
}

func (r *PostgresSeasonPassRepository) GetByID(ctx context.Context, id string) (*domain.SeasonPass, error) {
	var p domain.SeasonPass
	if err := scanSeasonPass(r.db.QueryRow(ctx, `SELECT `+seasonPassColumns+` FROM season_passes WHERE id = $1`, id), &p); err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *PostgresSeasonPassRepository) GetByProduct(ctx context.Context, productID string) (*domain.SeasonPass, error) {
	var p domain.SeasonPass
	if err := scanSeasonPass(r.db.QueryRow(ctx, `SELECT `+seasonPassColumns+` FROM season_passes WHERE product_id = $1`, productID), &p); err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *PostgresSeasonPassRepository) List(ctx context.Context, activeOnly bool) ([]domain.SeasonPass, error) {
	query := `SELECT ` + seasonPassColumns + ` FROM season_passes`
	if activeOnly {
		query += ` WHERE is_active = TRUE`
	}
	query += ` ORDER BY created_at ASC`
	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []domain.SeasonPass{}
	for rows.Next() {
		var p domain.SeasonPass
		if err := scanSeasonPass(rows, &p); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *PostgresSeasonPassRepository) Delete(ctx context.Context, id string) error {
	var sold int
	if err := r.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM tickets WHERE season_pass_id = $1 AND status IN ('PAID', 'USED')`, id,
	).Scan(&sold); err != nil {
		return err
	}
	if sold > 0 {
		return fmt.Errorf("cannot delete a season pass with %d paid purchase(s); turn it off instead", sold)
	}
	_, err := r.db.Exec(ctx, `DELETE FROM season_passes WHERE id = $1`, id)
	return err
}
