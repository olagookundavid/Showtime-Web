package ports

import (
	"context"
	"fmt"
	"time"

	"showtime-backend/internal/domain"

	"github.com/jackc/pgx/v5/pgxpool"
)

type SeasonRepository interface {
	// Team of the Season graphics
	UpsertGraphic(ctx context.Context, g *domain.SeasonGraphic) error
	FindAllGraphics(ctx context.Context) ([]*domain.SeasonGraphic, error)

	// MVPs
	CreateMVP(ctx context.Context, m *domain.SeasonMVP) error
	UpdateMVP(ctx context.Context, id string, label *string, displayOrder *int, isActive *bool) error
	DeleteMVP(ctx context.Context, id string) error
	FindAllMVPs(ctx context.Context, activeOnly bool) ([]*domain.SeasonMVP, error)
}

type SeasonPGRepository struct {
	db *pgxpool.Pool
}

func NewSeasonRepository(db *pgxpool.Pool) SeasonRepository {
	return &SeasonPGRepository{db: db}
}

// ── Graphics ─────────────────────────────────────────────────────────────────

func (r *SeasonPGRepository) UpsertGraphic(ctx context.Context, g *domain.SeasonGraphic) error {
	query := `
		INSERT INTO season_graphics (category, image_url, mobile_image_url)
		VALUES ($1, $2, $3)
		ON CONFLICT (category) DO UPDATE
			SET image_url = EXCLUDED.image_url,
			    mobile_image_url = EXCLUDED.mobile_image_url,
			    updated_at = NOW()
		RETURNING id, created_at, updated_at
	`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	err := r.db.QueryRow(ctx, query, g.Category, g.ImageURL, g.MobileImageURL).
		Scan(&g.ID, &g.CreatedAt, &g.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to upsert season graphic: %w", err)
	}
	return nil
}

func (r *SeasonPGRepository) FindAllGraphics(ctx context.Context) ([]*domain.SeasonGraphic, error) {
	query := `
		SELECT id, category, image_url, COALESCE(mobile_image_url, ''), created_at, updated_at
		FROM season_graphics
		ORDER BY category ASC
	`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch season graphics: %w", err)
	}
	defer rows.Close()

	var out []*domain.SeasonGraphic
	for rows.Next() {
		var g domain.SeasonGraphic
		if err := rows.Scan(&g.ID, &g.Category, &g.ImageURL, &g.MobileImageURL, &g.CreatedAt, &g.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan season graphic: %w", err)
		}
		out = append(out, &g)
	}
	return out, nil
}

// ── MVPs ─────────────────────────────────────────────────────────────────────

func (r *SeasonPGRepository) CreateMVP(ctx context.Context, m *domain.SeasonMVP) error {
	query := `
		INSERT INTO season_mvps (player_id, label, display_order, is_active)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at, updated_at
	`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	err := r.db.QueryRow(ctx, query, m.PlayerID, m.Label, m.DisplayOrder, m.IsActive).
		Scan(&m.ID, &m.CreatedAt, &m.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to create MVP: %w", err)
	}
	return nil
}

func (r *SeasonPGRepository) UpdateMVP(ctx context.Context, id string, label *string, displayOrder *int, isActive *bool) error {
	query := `UPDATE season_mvps SET updated_at = NOW()`
	args := []interface{}{}
	argIdx := 1

	if label != nil {
		query += fmt.Sprintf(", label = $%d", argIdx)
		args = append(args, *label)
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
		return fmt.Errorf("failed to update MVP: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("MVP not found")
	}
	return nil
}

func (r *SeasonPGRepository) DeleteMVP(ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	_, err := r.db.Exec(ctx, `DELETE FROM season_mvps WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("failed to delete MVP: %w", err)
	}
	return nil
}

func (r *SeasonPGRepository) FindAllMVPs(ctx context.Context, activeOnly bool) ([]*domain.SeasonMVP, error) {
	query := `
		SELECT
			m.id, m.player_id, m.label, m.display_order, m.is_active, m.created_at, m.updated_at,
			p.name, COALESCE(p.image, ''), p.jersey_number, COALESCE(p.position, ''),
			COALESCE(t.id::text, ''), COALESCE(t.name, ''), COALESCE(t.logo, '')
		FROM season_mvps m
		JOIN players p ON m.player_id = p.id
		LEFT JOIN teams t ON p.team_id = t.id
	`
	if activeOnly {
		query += ` WHERE m.is_active = TRUE`
	}
	query += ` ORDER BY m.display_order ASC, m.created_at ASC`

	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch MVPs: %w", err)
	}
	defer rows.Close()

	var out []*domain.SeasonMVP
	for rows.Next() {
		var m domain.SeasonMVP
		var p domain.Player
		var tm domain.Team
		if err := rows.Scan(
			&m.ID, &m.PlayerID, &m.Label, &m.DisplayOrder, &m.IsActive, &m.CreatedAt, &m.UpdatedAt,
			&p.Name, &p.Image, &p.JerseyNumber, &p.Position,
			&tm.ID, &tm.Name, &tm.Logo,
		); err != nil {
			return nil, fmt.Errorf("failed to scan MVP: %w", err)
		}
		p.ID = m.PlayerID
		p.TeamID = tm.ID
		p.Team = &tm
		m.Player = &p
		out = append(out, &m)
	}
	return out, nil
}
