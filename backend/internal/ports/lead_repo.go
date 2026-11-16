package ports

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"showtime-backend/internal/domain"
)

type LeadRepository interface {
	// Upsert saves a lead. Someone who is already on the list keeps their first
	// source and join date; their name, phone and interests are refreshed. It
	// reports whether the person was new.
	Upsert(ctx context.Context, lead *domain.Lead) (bool, error)
	List(ctx context.Context, filter domain.LeadFilter, page, limit int) ([]domain.Lead, int, error)
	// All is every lead matching the filter, newest first, for the CSV export.
	All(ctx context.Context, filter domain.LeadFilter) ([]domain.Lead, error)
	// SourceStats is how many leads each channel brought and how many bought.
	SourceStats(ctx context.Context) ([]domain.LeadSourceStat, error)
}

type PostgresLeadRepository struct {
	db *pgxpool.Pool
}

func NewLeadRepository(db *pgxpool.Pool) *PostgresLeadRepository {
	return &PostgresLeadRepository{db: db}
}

// convertedExpr is true when the lead (aliased l) has paid for a ticket since
// joining, matched by email or phone the same way repeat customers are.
var convertedExpr = `EXISTS (
	SELECT 1 FROM tickets t
	WHERE ` + realSale("t") + ` AND t.created_at >= l.created_at
	  AND (LOWER(t.email) = LOWER(l.email)
	       OR (` + phoneKey("l") + ` IS NOT NULL AND ` + phoneKey("t") + ` = ` + phoneKey("l") + `))
)`

const leadColumns = `l.id::text, l.name, l.email, l.phone, l.interests, l.source, l.consented_at, l.created_at, l.updated_at`

func (r *PostgresLeadRepository) Upsert(ctx context.Context, lead *domain.Lead) (bool, error) {
	var inserted bool
	err := r.db.QueryRow(ctx, `
		INSERT INTO leads (name, email, phone, interests, source)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (LOWER(email)) DO UPDATE SET
			name = EXCLUDED.name,
			phone = EXCLUDED.phone,
			interests = ARRAY(SELECT DISTINCT unnest(leads.interests || EXCLUDED.interests)),
			updated_at = NOW()
		RETURNING id::text, (xmax = 0)`,
		lead.Name, lead.Email, lead.Phone, lead.Interests, lead.Source,
	).Scan(&lead.ID, &inserted)
	return inserted, err
}

// where builds the filter's WHERE clause over leads aliased l.
func (f leadFilterSQL) where() (string, []interface{}) {
	clause := ` WHERE 1=1`
	args := []interface{}{}
	if s := strings.TrimSpace(f.Search); s != "" {
		args = append(args, "%"+strings.ToLower(s)+"%")
		clause += fmt.Sprintf(` AND (LOWER(l.name) LIKE $%d OR LOWER(l.email) LIKE $%d OR l.phone LIKE $%d)`, len(args), len(args), len(args))
	}
	if f.Source != "" {
		args = append(args, f.Source)
		clause += fmt.Sprintf(` AND l.source = $%d`, len(args))
	}
	if f.Interest != "" {
		args = append(args, f.Interest)
		clause += fmt.Sprintf(` AND $%d = ANY(l.interests)`, len(args))
	}
	if f.Converted != nil {
		if *f.Converted {
			clause += ` AND ` + convertedExpr
		} else {
			clause += ` AND NOT ` + convertedExpr
		}
	}
	return clause, args
}

type leadFilterSQL domain.LeadFilter

func (r *PostgresLeadRepository) query(ctx context.Context, filter domain.LeadFilter, tail string, extra ...interface{}) ([]domain.Lead, error) {
	where, args := leadFilterSQL(filter).where()
	rows, err := r.db.Query(ctx,
		`SELECT `+leadColumns+`, `+convertedExpr+` FROM leads l`+where+` ORDER BY l.created_at DESC, l.id ASC`+tail,
		append(args, extra...)...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	leads := []domain.Lead{}
	for rows.Next() {
		var l domain.Lead
		if err := rows.Scan(&l.ID, &l.Name, &l.Email, &l.Phone, &l.Interests, &l.Source,
			&l.ConsentedAt, &l.CreatedAt, &l.UpdatedAt, &l.Converted); err != nil {
			return nil, err
		}
		leads = append(leads, l)
	}
	return leads, rows.Err()
}

func (r *PostgresLeadRepository) List(ctx context.Context, filter domain.LeadFilter, page, limit int) ([]domain.Lead, int, error) {
	where, args := leadFilterSQL(filter).where()
	var total int
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM leads l`+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	page, limit, offset := paging(page, limit, 20)
	leads, err := r.query(ctx, filter,
		fmt.Sprintf(` LIMIT $%d OFFSET $%d`, len(args)+1, len(args)+2), limit, offset)
	if err != nil {
		return nil, 0, err
	}
	return leads, total, nil
}

func (r *PostgresLeadRepository) All(ctx context.Context, filter domain.LeadFilter) ([]domain.Lead, error) {
	return r.query(ctx, filter, "")
}

func (r *PostgresLeadRepository) SourceStats(ctx context.Context) ([]domain.LeadSourceStat, error) {
	rows, err := r.db.Query(ctx, `
		SELECT l.source, COUNT(*), COUNT(*) FILTER (WHERE `+convertedExpr+`)
		FROM leads l
		GROUP BY l.source
		ORDER BY COUNT(*) DESC, l.source ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	stats := []domain.LeadSourceStat{}
	for rows.Next() {
		var s domain.LeadSourceStat
		if err := rows.Scan(&s.Source, &s.Leads, &s.Converted); err != nil {
			return nil, err
		}
		stats = append(stats, s)
	}
	return stats, rows.Err()
}
