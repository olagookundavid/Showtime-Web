package ports

import (
	"context"

	"showtime-backend/internal/domain"

	"github.com/jackc/pgx/v5/pgxpool"
)

type TeamTicketAllocationRepository interface {
	CreateOrUpdate(ctx context.Context, allocation *domain.TeamTicketAllocation) error
	GetByTeamAndEventDay(ctx context.Context, teamID string, eventDayID string) (*domain.TeamTicketAllocation, error)
	ListByEventDay(ctx context.Context, eventDayID string) ([]domain.TeamTicketAllocation, error)
	ListByTeam(ctx context.Context, teamID string) ([]domain.TeamTicketAllocation, error)
	Delete(ctx context.Context, id string) error
}

type PostgresTeamTicketAllocationRepository struct {
	db *pgxpool.Pool
}

func NewTeamTicketAllocationRepository(db *pgxpool.Pool) *PostgresTeamTicketAllocationRepository {
	return &PostgresTeamTicketAllocationRepository{db: db}
}

func (r *PostgresTeamTicketAllocationRepository) CreateOrUpdate(ctx context.Context, req *domain.TeamTicketAllocation) error {
	query := `
		INSERT INTO team_ticket_allocations (event_day_id, team_id, allocated_count)
		VALUES ($1, $2, $3)
		ON CONFLICT (event_day_id, team_id) 
		DO UPDATE SET allocated_count = EXCLUDED.allocated_count, updated_at = NOW()
		RETURNING id, created_at, updated_at
	`
	return r.db.QueryRow(ctx, query,
		req.EventDayID, req.TeamID, req.AllocatedCount,
	).Scan(&req.ID, &req.CreatedAt, &req.UpdatedAt)
}

func (r *PostgresTeamTicketAllocationRepository) GetByTeamAndEventDay(ctx context.Context, teamID string, eventDayID string) (*domain.TeamTicketAllocation, error) {
	query := `
		SELECT id, event_day_id, team_id, allocated_count, created_at, updated_at
		FROM team_ticket_allocations
		WHERE team_id = $1 AND event_day_id = $2
	`
	var a domain.TeamTicketAllocation
	err := r.db.QueryRow(ctx, query, teamID, eventDayID).Scan(
		&a.ID, &a.EventDayID, &a.TeamID, &a.AllocatedCount, &a.CreatedAt, &a.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (r *PostgresTeamTicketAllocationRepository) ListByEventDay(ctx context.Context, eventDayID string) ([]domain.TeamTicketAllocation, error) {
	query := `
		SELECT a.id, a.event_day_id, a.team_id, a.allocated_count, a.created_at, a.updated_at, t.name, t.logo
		FROM team_ticket_allocations a
		JOIN teams t ON a.team_id = t.id
		WHERE a.event_day_id = $1
	`
	rows, err := r.db.Query(ctx, query, eventDayID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var allocations []domain.TeamTicketAllocation
	for rows.Next() {
		var a domain.TeamTicketAllocation
		var teamName string
		var teamLogo *string
		if err := rows.Scan(
			&a.ID, &a.EventDayID, &a.TeamID, &a.AllocatedCount, &a.CreatedAt, &a.UpdatedAt,
			&teamName, &teamLogo,
		); err != nil {
			return nil, err
		}
		a.Team = &domain.Team{
			ID:   a.TeamID,
			Name: teamName,
		}
		allocations = append(allocations, a)
	}
	return allocations, nil
}

func (r *PostgresTeamTicketAllocationRepository) ListByTeam(ctx context.Context, teamID string) ([]domain.TeamTicketAllocation, error) {
	query := `
		SELECT a.id, a.event_day_id, a.team_id, a.allocated_count, a.created_at, a.updated_at,
		       ed.title, ed.date
		FROM team_ticket_allocations a
		JOIN event_days ed ON a.event_day_id = ed.id
		WHERE a.team_id = $1
		ORDER BY ed.date DESC
	`
	rows, err := r.db.Query(ctx, query, teamID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var allocations []domain.TeamTicketAllocation
	for rows.Next() {
		var a domain.TeamTicketAllocation
		var edTitle string
		var edDate interface{}
		if err := rows.Scan(
			&a.ID, &a.EventDayID, &a.TeamID, &a.AllocatedCount, &a.CreatedAt, &a.UpdatedAt,
			&edTitle, &edDate,
		); err != nil {
			return nil, err
		}
		a.EventDay = &domain.EventDay{
			ID:    a.EventDayID,
			Title: edTitle,
		}
		// Date casting would be needed here depending on how it returns from PGX
		allocations = append(allocations, a)
	}
	return allocations, nil
}

func (r *PostgresTeamTicketAllocationRepository) Delete(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM team_ticket_allocations WHERE id = $1`, id)
	return err
}
