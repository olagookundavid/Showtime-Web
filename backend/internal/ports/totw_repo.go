package ports

import (
	"context"
	"showtime-backend/internal/domain"

	"github.com/jackc/pgx/v5/pgxpool"
)

type TOTWRepository interface {
	Create(ctx context.Context, entry *domain.TOTWEntry) error
	Delete(ctx context.Context, id string) error
	GetByFilter(ctx context.Context, competitionID string, eventDay string) ([]domain.TOTWEntry, error)
	GetLatest(ctx context.Context, competitionID string) ([]domain.TOTWEntry, string, error) // Returns entries and the latest date
}

type PostgresTOTWRepository struct {
	db *pgxpool.Pool
}

func NewTOTWRepository(db *pgxpool.Pool) *PostgresTOTWRepository {
	return &PostgresTOTWRepository{db: db}
}

func (r *PostgresTOTWRepository) Create(ctx context.Context, entry *domain.TOTWEntry) error {
	query := `
		INSERT INTO team_of_the_week (competition_id, event_day_date, player_id, position_group)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at, updated_at
	`
	err := r.db.QueryRow(ctx, query, entry.CompetitionID, entry.EventDayDate, entry.PlayerID, entry.PositionGroup).Scan(&entry.ID, &entry.CreatedAt, &entry.UpdatedAt)
	return err
}

func (r *PostgresTOTWRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM team_of_the_week WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *PostgresTOTWRepository) GetByFilter(ctx context.Context, competitionID string, eventDay string) ([]domain.TOTWEntry, error) {
	query := `
		SELECT 
			totw.id, totw.competition_id, totw.event_day_date, totw.player_id, totw.position_group, totw.created_at,
			p.name AS player_name, p.image AS player_image, p.jersey_number AS player_jersey_number, p.position AS player_position,
			t.id AS team_id, t.name AS team_name, t.short_name AS team_short_name, t.logo AS team_logo
		FROM team_of_the_week totw
		JOIN players p ON totw.player_id = p.id
		JOIN teams t ON p.team_id = t.id
		WHERE totw.competition_id = $1 AND totw.event_day_date = $2
		ORDER BY totw.position_group, p.name
	`
	rows, err := r.db.Query(ctx, query, competitionID, eventDay)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []domain.TOTWEntry
	for rows.Next() {
		var e domain.TOTWEntry
		var p domain.Player
		var tm domain.Team
		err := rows.Scan(
			&e.ID, &e.CompetitionID, &e.EventDayDate, &e.PlayerID, &e.PositionGroup, &e.CreatedAt,
			&p.Name, &p.Image, &p.JerseyNumber, &p.Position,
			&tm.ID, &tm.Name, &tm.ShortName, &tm.Logo,
		)
		if err != nil {
			return nil, err
		}
		p.ID = e.PlayerID
		p.TeamID = tm.ID
		p.Team = &tm
		e.Player = &p
		entries = append(entries, e)
	}
	return entries, nil
}

func (r *PostgresTOTWRepository) GetLatest(ctx context.Context, competitionID string) ([]domain.TOTWEntry, string, error) {
	// 1. Get the latest date for which TOTW entries exist
	var latestDate string
	var dateQuery string
	var err error

	if competitionID != "" {
		dateQuery = `SELECT COALESCE(MAX(event_day_date)::TEXT, '') FROM team_of_the_week WHERE competition_id = $1`
		err = r.db.QueryRow(ctx, dateQuery, competitionID).Scan(&latestDate)
	} else {
		dateQuery = `SELECT COALESCE(MAX(event_day_date)::TEXT, '') FROM team_of_the_week`
		err = r.db.QueryRow(ctx, dateQuery).Scan(&latestDate)
	}

	if err != nil || latestDate == "" {
		return nil, "", err
	}

	// 2. Fetch all entries for that date
	// If competitionID wasn't provided, we need to know WHICH competition that max date belonged to (it could be multiple technically)
	// But usually, we want the entries for that specific max Date.
	
	// Let's refine: get the latest date + its associated competition
	var targetCompID string
	if competitionID == "" {
		compQuery := `SELECT competition_id FROM team_of_the_week WHERE event_day_date = $1 LIMIT 1`
		err = r.db.QueryRow(ctx, compQuery, latestDate).Scan(&targetCompID)
		if err != nil {
			return nil, "", err
		}
	} else {
		targetCompID = competitionID
	}

	entries, err := r.GetByFilter(ctx, targetCompID, latestDate)
	return entries, latestDate, err
}
