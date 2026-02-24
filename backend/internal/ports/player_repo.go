package ports

import (
	"context"
	"showtime-backend/internal/domain"

	"github.com/jackc/pgx/v5/pgxpool"
)

type PlayerRepository interface {
	GetPlayers(ctx context.Context, teamID string) ([]domain.Player, error)
	GetPlayerByID(ctx context.Context, id string) (*domain.Player, error)
	CreatePlayer(ctx context.Context, player *domain.Player) error
	UpdatePlayer(ctx context.Context, player *domain.Player) error
	DeletePlayer(ctx context.Context, id string) error
}

type PostgresPlayerRepository struct {
	db *pgxpool.Pool
}

func NewPlayerRepository(db *pgxpool.Pool) *PostgresPlayerRepository {
	return &PostgresPlayerRepository{db: db}
}

func (r *PostgresPlayerRepository) GetPlayers(ctx context.Context, teamID string) ([]domain.Player, error) {
	query := `
		SELECT
			p.id, p.name, p.jersey_number, p.position, p.team_id, p.bio, p.image,
			p.touchdowns, p.yards, p.interceptions, p.tackles,
			p.created_at, p.updated_at,
			t.name, t.short_name, t.logo
		FROM players p
		LEFT JOIN teams t ON p.team_id = t.id
	`
	args := []any{}

	if teamID != "" {
		query += ` WHERE p.team_id = $1`
		args = append(args, teamID)
	}

	query += ` ORDER BY p.jersey_number ASC`

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var players []domain.Player
	for rows.Next() {
		var p domain.Player
		p.Team = &domain.Team{}
		err := rows.Scan(
			&p.ID, &p.Name, &p.JerseyNumber, &p.Position, &p.TeamID, &p.Bio, &p.Image,
			&p.Touchdowns, &p.Yards, &p.Interceptions, &p.Tackles,
			&p.CreatedAt, &p.UpdatedAt,
			&p.Team.Name, &p.Team.ShortName, &p.Team.Logo,
		)
		if err != nil {
			return nil, err
		}
		p.Team.ID = p.TeamID
		players = append(players, p)
	}
	return players, nil
}

func (r *PostgresPlayerRepository) GetPlayerByID(ctx context.Context, id string) (*domain.Player, error) {
	query := `
		SELECT
			p.id, p.name, p.jersey_number, p.position, p.team_id, p.bio, p.image,
			p.touchdowns, p.yards, p.interceptions, p.tackles,
			p.created_at, p.updated_at,
			t.name, t.short_name, t.logo
		FROM players p
		LEFT JOIN teams t ON p.team_id = t.id
		WHERE p.id = $1
	`
	var p domain.Player
	p.Team = &domain.Team{}
	err := r.db.QueryRow(ctx, query, id).Scan(
		&p.ID, &p.Name, &p.JerseyNumber, &p.Position, &p.TeamID, &p.Bio, &p.Image,
		&p.Touchdowns, &p.Yards, &p.Interceptions, &p.Tackles,
		&p.CreatedAt, &p.UpdatedAt,
		&p.Team.Name, &p.Team.ShortName, &p.Team.Logo,
	)
	if err != nil {
		return nil, err
	}
	p.Team.ID = p.TeamID
	return &p, nil
}

func (r *PostgresPlayerRepository) CreatePlayer(ctx context.Context, player *domain.Player) error {
	query := `
		INSERT INTO players (name, jersey_number, position, team_id, bio, image, touchdowns, yards, interceptions, tackles)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, created_at, updated_at
	`
	return r.db.QueryRow(ctx, query,
		player.Name, player.JerseyNumber, player.Position, player.TeamID, player.Bio, player.Image,
		player.Touchdowns, player.Yards, player.Interceptions, player.Tackles,
	).Scan(&player.ID, &player.CreatedAt, &player.UpdatedAt)
}

func (r *PostgresPlayerRepository) UpdatePlayer(ctx context.Context, player *domain.Player) error {
	query := `
		UPDATE players SET
			name=$1, jersey_number=$2, position=$3, team_id=$4, bio=$5, image=$6,
			touchdowns=$7, yards=$8, interceptions=$9, tackles=$10, updated_at=NOW()
		WHERE id=$11
	`
	_, err := r.db.Exec(ctx, query,
		player.Name, player.JerseyNumber, player.Position, player.TeamID, player.Bio, player.Image,
		player.Touchdowns, player.Yards, player.Interceptions, player.Tackles, player.ID,
	)
	return err
}

func (r *PostgresPlayerRepository) DeletePlayer(ctx context.Context, id string) error {
	query := `DELETE FROM players WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}
