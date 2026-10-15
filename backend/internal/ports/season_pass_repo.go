package ports

import (
	"context"
	"fmt"

	"showtime-backend/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// SeasonPassRepository stores season passes: a name, a price and an end date.
type SeasonPassRepository interface {
	Create(ctx context.Context, p *domain.SeasonPass) error
	Update(ctx context.Context, p *domain.SeasonPass) error
	GetByID(ctx context.Context, id string) (*domain.SeasonPass, error)
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

const seasonPassColumns = `id, name, description, price, ends_on, is_active, created_at, updated_at`

func scanSeasonPass(row pgx.Row, p *domain.SeasonPass) error {
	return row.Scan(&p.ID, &p.Name, &p.Description, &p.Price, &p.EndsOn, &p.IsActive, &p.CreatedAt, &p.UpdatedAt)
}

func (r *PostgresSeasonPassRepository) Create(ctx context.Context, p *domain.SeasonPass) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO season_passes (name, description, price, ends_on, is_active)
		VALUES ($1, $2, $3, $4::date, $5)
		RETURNING id, created_at, updated_at`,
		p.Name, p.Description, p.Price, p.EndsOn.Format("2006-01-02"), p.IsActive,
	).Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)
}

func (r *PostgresSeasonPassRepository) Update(ctx context.Context, p *domain.SeasonPass) error {
	return r.db.QueryRow(ctx, `
		UPDATE season_passes
		SET name = $1, description = $2, price = $3, ends_on = $4::date, is_active = $5, updated_at = NOW()
		WHERE id = $6
		RETURNING updated_at`,
		p.Name, p.Description, p.Price, p.EndsOn.Format("2006-01-02"), p.IsActive, p.ID,
	).Scan(&p.UpdatedAt)
}

func (r *PostgresSeasonPassRepository) GetByID(ctx context.Context, id string) (*domain.SeasonPass, error) {
	var p domain.SeasonPass
	if err := scanSeasonPass(r.db.QueryRow(ctx, `SELECT `+seasonPassColumns+` FROM season_passes WHERE id = $1`, id), &p); err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *PostgresSeasonPassRepository) List(ctx context.Context, activeOnly bool) ([]domain.SeasonPass, error) {
	query := `SELECT ` + seasonPassColumns + ` FROM season_passes`
	if activeOnly {
		query += ` WHERE is_active = TRUE`
	}
	query += ` ORDER BY ends_on ASC, created_at ASC`
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
