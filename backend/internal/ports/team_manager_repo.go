package ports

import (
	"context"
	"showtime-backend/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ITeamManagerRepository interface {
	AssignManager(ctx context.Context, userID, teamID string) error
	RemoveManager(ctx context.Context, userID string) error
	GetManagerByUserID(ctx context.Context, userID string) (*domain.TeamManager, error)
	GetManagersByTeamID(ctx context.Context, teamID string) ([]domain.TeamManager, error)
}

type TeamManagerRepository struct {
	Db *pgxpool.Pool
}

func NewTeamManagerRepository(db *pgxpool.Pool) ITeamManagerRepository {
	return &TeamManagerRepository{Db: db}
}

func (r *TeamManagerRepository) AssignManager(ctx context.Context, userID, teamID string) error {
	query := `INSERT INTO team_managers (user_id, team_id) VALUES ($1, $2)
		ON CONFLICT (user_id) DO UPDATE SET team_id = EXCLUDED.team_id`
	_, err := r.Db.Exec(ctx, query, userID, teamID)
	return err
}

func (r *TeamManagerRepository) RemoveManager(ctx context.Context, userID string) error {
	query := `DELETE FROM team_managers WHERE user_id = $1`
	_, err := r.Db.Exec(ctx, query, userID)
	return err
}

func (r *TeamManagerRepository) GetManagerByUserID(ctx context.Context, userID string) (*domain.TeamManager, error) {
	query := `SELECT id, user_id, team_id, created_at FROM team_managers WHERE user_id = $1`
	var tm domain.TeamManager
	err := r.Db.QueryRow(ctx, query, userID).Scan(&tm.ID, &tm.UserID, &tm.TeamID, &tm.CreatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil // No assignment found
		}
		return nil, err
	}
	return &tm, nil
}

func (r *TeamManagerRepository) GetManagersByTeamID(ctx context.Context, teamID string) ([]domain.TeamManager, error) {
	query := `SELECT id, user_id, team_id, created_at FROM team_managers WHERE team_id = $1`
	rows, err := r.Db.Query(ctx, query, teamID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var managers []domain.TeamManager
	for rows.Next() {
		var tm domain.TeamManager
		if err := rows.Scan(&tm.ID, &tm.UserID, &tm.TeamID, &tm.CreatedAt); err != nil {
			return nil, err
		}
		managers = append(managers, tm)
	}
	return managers, nil
}
