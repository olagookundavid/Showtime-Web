package ports

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type SalesByTierResult struct {
	TierName    string
	TotalAmount int
	Quantity    int
}

type IAnalyticsRepository interface {
	GetUsersByRole(ctx context.Context) (map[string]int, error)
	GetSalesByTier(ctx context.Context) ([]SalesByTierResult, error)
}

type PostgresAnalyticsRepository struct {
	db *pgxpool.Pool
}

func NewAnalyticsRepository(db *pgxpool.Pool) IAnalyticsRepository {
	return &PostgresAnalyticsRepository{db: db}
}

func (r *PostgresAnalyticsRepository) GetUsersByRole(ctx context.Context) (map[string]int, error) {
	query := `SELECT role, COUNT(*) FROM users GROUP BY role`
	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[string]int)
	for rows.Next() {
		var role string
		var count int
		if err := rows.Scan(&role, &count); err != nil {
			return nil, err
		}
		result[role] = count
	}
	return result, nil
}

func (r *PostgresAnalyticsRepository) GetSalesByTier(ctx context.Context) ([]SalesByTierResult, error) {
	query := `
		SELECT COALESCE(tt.name, t.tier_name) as tier_name, COALESCE(SUM(t.total_amount), 0) as total_amount, COALESCE(SUM(t.quantity), 0) as quantity
		FROM tickets t
		LEFT JOIN ticket_tiers tt ON t.tier_id = tt.id
		WHERE t.status IN ('PAID', 'USED')
		GROUP BY COALESCE(tt.name, t.tier_name)
		ORDER BY total_amount DESC
	`
	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []SalesByTierResult
	for rows.Next() {
		var res SalesByTierResult
		if err := rows.Scan(&res.TierName, &res.TotalAmount, &res.Quantity); err != nil {
			return nil, err
		}
		results = append(results, res)
	}
	return results, nil
}
