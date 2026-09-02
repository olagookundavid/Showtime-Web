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
	// GetManagerAssignment returns the team a user currently manages (if any),
	// including its name, so callers can build a clear "already managing X"
	// message instead of silently reassigning them.
	GetManagerAssignment(ctx context.Context, userID string) (teamID string, teamName string, found bool, err error)
	// ListTeamHeadCandidates returns every team_head user with whichever team
	// they currently manage (nil if unassigned) — powers the "Assign Team
	// Head" dropdown so it can show ALL team_head users, not just free ones.
	ListTeamHeadCandidates(ctx context.Context) ([]domain.TeamHeadCandidate, error)
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
	query := `
		SELECT tm.id, tm.user_id, tm.team_id, tm.created_at, u.full_name, u.email
		FROM team_managers tm
		JOIN users u ON u.id = tm.user_id
		WHERE tm.team_id = $1
		ORDER BY tm.created_at ASC
	`
	rows, err := r.Db.Query(ctx, query, teamID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var managers []domain.TeamManager
	for rows.Next() {
		var tm domain.TeamManager
		if err := rows.Scan(&tm.ID, &tm.UserID, &tm.TeamID, &tm.CreatedAt, &tm.UserFullName, &tm.UserEmail); err != nil {
			return nil, err
		}
		managers = append(managers, tm)
	}
	return managers, nil
}

func (r *TeamManagerRepository) GetManagerAssignment(ctx context.Context, userID string) (string, string, bool, error) {
	query := `SELECT tm.team_id, t.name FROM team_managers tm JOIN teams t ON t.id = tm.team_id WHERE tm.user_id = $1`
	var teamID, teamName string
	err := r.Db.QueryRow(ctx, query, userID).Scan(&teamID, &teamName)
	if err != nil {
		if err == pgx.ErrNoRows {
			return "", "", false, nil
		}
		return "", "", false, err
	}
	return teamID, teamName, true, nil
}

func (r *TeamManagerRepository) ListTeamHeadCandidates(ctx context.Context) ([]domain.TeamHeadCandidate, error) {
	query := `
		SELECT u.id, u.full_name, u.email, tm.team_id, t.name
		FROM users u
		LEFT JOIN team_managers tm ON tm.user_id = u.id
		LEFT JOIN teams t ON t.id = tm.team_id
		WHERE u.role = 'team_head'
		ORDER BY u.full_name ASC
	`
	rows, err := r.Db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var candidates []domain.TeamHeadCandidate
	for rows.Next() {
		var c domain.TeamHeadCandidate
		if err := rows.Scan(&c.UserID, &c.FullName, &c.Email, &c.AssignedTeamID, &c.AssignedTeamName); err != nil {
			return nil, err
		}
		candidates = append(candidates, c)
	}
	return candidates, nil
}
