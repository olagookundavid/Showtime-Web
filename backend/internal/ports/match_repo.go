package ports

import (
	"context"
	"fmt"
	"showtime-backend/internal/domain"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type MatchRepository interface {
	// Competitions
	GetCompetitions(ctx context.Context, page, limit int, search string, status string) ([]domain.Competition, int64, error)
	GetCompetitionByID(ctx context.Context, id string) (*domain.Competition, error)
	CreateCompetition(ctx context.Context, comp *domain.Competition) error
	UpdateCompetition(ctx context.Context, comp *domain.Competition) error
	DeleteCompetition(ctx context.Context, id string) error

	// Teams
	GetTeams(ctx context.Context, page, limit int, search string) ([]domain.Team, int64, error)
	GetAllTeams(ctx context.Context) ([]domain.Team, error)
	GetTeamByID(ctx context.Context, id string) (*domain.Team, error)
	CreateTeam(ctx context.Context, team *domain.Team) error
	UpdateTeam(ctx context.Context, team *domain.Team) error
	DeleteTeam(ctx context.Context, id string) error
	GetTeamsByCompetition(ctx context.Context, competitionID string) ([]domain.Team, error)

	// Matches
	GetMatches(ctx context.Context, competitionID string, status string, page, limit int, search string, date ...string) ([]domain.Match, int64, error)
	GetMatchByID(ctx context.Context, id string) (*domain.Match, error)
	CreateMatch(ctx context.Context, match *domain.Match) error
	UpdateMatch(ctx context.Context, match *domain.Match) error
	DeleteMatch(ctx context.Context, id string) error

	// Standings
	GetStandings(ctx context.Context, competitionID string) ([]domain.Standing, error)
	CreateStanding(ctx context.Context, standing *domain.Standing) error
	UpdateStanding(ctx context.Context, standing *domain.Standing) error
	DeleteStanding(ctx context.Context, id string) error
	RecalculateStandings(ctx context.Context, competitionID string) error
}

type PostgresMatchRepository struct {
	db *pgxpool.Pool
}

func NewMatchRepository(db *pgxpool.Pool) *PostgresMatchRepository {
	return &PostgresMatchRepository{db: db}
}

// --- Competitions ---
func (r *PostgresMatchRepository) GetCompetitions(ctx context.Context, page, limit int, search string, status string) ([]domain.Competition, int64, error) {
	offset := (page - 1) * limit
	baseQuery := ` FROM competitions WHERE 1=1 `
	args := []any{}
	argCount := 1

	if search != "" {
		baseQuery += ` AND name ILIKE $` + strconv.Itoa(argCount)
		args = append(args, "%"+search+"%")
		argCount++
	}

	if status != "" {
		baseQuery += ` AND status = $` + strconv.Itoa(argCount)
		args = append(args, status)
		argCount++
	}

	countQuery := `SELECT COUNT(*) ` + baseQuery
	var total int64
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := `SELECT id, name, logo, status, created_at, updated_at ` + baseQuery +
		` ORDER BY created_at DESC LIMIT $` + strconv.Itoa(argCount) + ` OFFSET $` + strconv.Itoa(argCount+1)
	args = append(args, limit, offset)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var competitions []domain.Competition
	for rows.Next() {
		var c domain.Competition
		if err := rows.Scan(&c.ID, &c.Name, &c.Logo, &c.Status, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, 0, err
		}
		competitions = append(competitions, c)
	}
	return competitions, total, nil
}

func (r *PostgresMatchRepository) GetCompetitionByID(ctx context.Context, id string) (*domain.Competition, error) {
	query := `SELECT id, name, logo, status, created_at, updated_at FROM competitions WHERE id = $1`
	var c domain.Competition
	err := r.db.QueryRow(ctx, query, id).Scan(&c.ID, &c.Name, &c.Logo, &c.Status, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *PostgresMatchRepository) CreateCompetition(ctx context.Context, comp *domain.Competition) error {
	query := `INSERT INTO competitions (name, logo, status) VALUES ($1, $2, $3) RETURNING id, created_at, updated_at`
	return r.db.QueryRow(ctx, query, comp.Name, comp.Logo, comp.Status).Scan(&comp.ID, &comp.CreatedAt, &comp.UpdatedAt)
}

func (r *PostgresMatchRepository) UpdateCompetition(ctx context.Context, comp *domain.Competition) error {
	query := `UPDATE competitions SET name=$1, logo=$2, status=$3, updated_at=NOW() WHERE id=$4`
	_, err := r.db.Exec(ctx, query, comp.Name, comp.Logo, comp.Status, comp.ID)
	return err
}

func (r *PostgresMatchRepository) DeleteCompetition(ctx context.Context, id string) error {
	query := `DELETE FROM competitions WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

// --- Teams ---
func (r *PostgresMatchRepository) GetTeams(ctx context.Context, page, limit int, search string) ([]domain.Team, int64, error) {
	offset := (page - 1) * limit

	countQuery := `SELECT COUNT(*) FROM teams WHERE 1=1`
	query := `SELECT id, name, short_name, logo, created_at, updated_at FROM teams WHERE 1=1`

	args := []interface{}{}
	argIndex := 1

	if search != "" {
		filter := "%" + search + "%"
		countQuery += ` AND (name ILIKE $` + fmt.Sprint(argIndex) + ` OR short_name ILIKE $` + fmt.Sprint(argIndex) + `)`
		query += ` AND (name ILIKE $` + fmt.Sprint(argIndex) + ` OR short_name ILIKE $` + fmt.Sprint(argIndex) + `)`
		args = append(args, filter)
		argIndex++
	}

	var total int64
	err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	query += ` ORDER BY name ASC LIMIT $` + fmt.Sprint(argIndex) + ` OFFSET $` + fmt.Sprint(argIndex+1)
	args = append(args, limit, offset)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var teams []domain.Team
	for rows.Next() {
		var t domain.Team
		if err := rows.Scan(&t.ID, &t.Name, &t.ShortName, &t.Logo, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, 0, err
		}
		teams = append(teams, t)
	}
	return teams, total, nil
}

func (r *PostgresMatchRepository) GetAllTeams(ctx context.Context) ([]domain.Team, error) {
	query := `SELECT id, name, short_name, logo, created_at, updated_at FROM teams ORDER BY name ASC`
	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var teams []domain.Team
	for rows.Next() {
		var t domain.Team
		if err := rows.Scan(&t.ID, &t.Name, &t.ShortName, &t.Logo, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		teams = append(teams, t)
	}
	return teams, nil
}

func (r *PostgresMatchRepository) GetTeamByID(ctx context.Context, id string) (*domain.Team, error) {
	query := `SELECT id, name, short_name, logo, created_at, updated_at FROM teams WHERE id = $1`
	var t domain.Team
	err := r.db.QueryRow(ctx, query, id).Scan(&t.ID, &t.Name, &t.ShortName, &t.Logo, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *PostgresMatchRepository) CreateTeam(ctx context.Context, team *domain.Team) error {
	query := `INSERT INTO teams (name, short_name, logo) VALUES ($1, $2, $3) RETURNING id, created_at, updated_at`
	return r.db.QueryRow(ctx, query, team.Name, team.ShortName, team.Logo).Scan(&team.ID, &team.CreatedAt, &team.UpdatedAt)
}

func (r *PostgresMatchRepository) UpdateTeam(ctx context.Context, team *domain.Team) error {
	query := `UPDATE teams SET name=$1, short_name=$2, logo=$3, updated_at=NOW() WHERE id=$4`
	_, err := r.db.Exec(ctx, query, team.Name, team.ShortName, team.Logo, team.ID)
	return err
}

func (r *PostgresMatchRepository) DeleteTeam(ctx context.Context, id string) error {
	query := `DELETE FROM teams WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *PostgresMatchRepository) GetTeamsByCompetition(ctx context.Context, competitionID string) ([]domain.Team, error) {
	query := `SELECT DISTINCT t.id, t.name, t.short_name, t.logo, t.created_at, t.updated_at
		FROM teams t
		INNER JOIN standings s ON s.team_id = t.id
		WHERE s.competition_id = $1
		ORDER BY t.name ASC`
	rows, err := r.db.Query(ctx, query, competitionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var teams []domain.Team
	for rows.Next() {
		var t domain.Team
		if err := rows.Scan(&t.ID, &t.Name, &t.ShortName, &t.Logo, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		teams = append(teams, t)
	}
	return teams, nil
}

// --- Matches ---
func (r *PostgresMatchRepository) GetMatches(ctx context.Context, competitionID string, status string, page, limit int, search string, date ...string) ([]domain.Match, int64, error) {
	offset := (page - 1) * limit

	// Base query
	query := `
		SELECT 
			m.id, m.competition_id, m.home_team_id, m.away_team_id, m.date, m.time, m.venue, m.status, m.home_score, m.away_score, m.highlights_url, m.ticket_url, m.created_at, m.updated_at,
			c.id, c.name, c.logo,
			ht.id, ht.name, ht.short_name, ht.logo,
			at.id, at.name, at.short_name, at.logo
		FROM matches m
		LEFT JOIN competitions c ON m.competition_id = c.id
		LEFT JOIN teams ht ON m.home_team_id = ht.id
		LEFT JOIN teams at ON m.away_team_id = at.id
	`
	countQuery := `
		SELECT COUNT(*) 
		FROM matches m
		LEFT JOIN competitions c ON m.competition_id = c.id
		LEFT JOIN teams ht ON m.home_team_id = ht.id
		LEFT JOIN teams at ON m.away_team_id = at.id
	`

	args := []any{}
	whereClause := " WHERE 1=1"

	if competitionID != "" {
		args = append(args, competitionID)
		whereClause += fmt.Sprintf(" AND m.competition_id = $%d", len(args))
	}

	if status != "" {
		args = append(args, status)
		whereClause += fmt.Sprintf(" AND m.status = $%d", len(args))
	}

	if search != "" {
		args = append(args, "%"+search+"%")
		whereClause += fmt.Sprintf(" AND (ht.name ILIKE $%d OR at.name ILIKE $%d OR c.name ILIKE $%d)", len(args), len(args), len(args))
	}

	if len(date) > 0 && date[0] != "" {
		parsedDate, parseErr := time.Parse("2006-01-02", date[0])
		if parseErr == nil {
			args = append(args, parsedDate)
			whereClause += fmt.Sprintf(" AND m.date = $%d", len(args))
		}
	}

	// Get Total Count
	var total int64
	err := r.db.QueryRow(ctx, countQuery+whereClause, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Add Ordering and Pagination
	query += whereClause + ` ORDER BY m.date DESC, m.time DESC LIMIT $` + fmt.Sprintf("%d", len(args)+1) + ` OFFSET $` + fmt.Sprintf("%d", len(args)+2)
	args = append(args, limit, offset)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var matches []domain.Match
	for rows.Next() {
		var m domain.Match
		m.Competition = &domain.Competition{}
		m.HomeTeam = &domain.Team{}
		m.AwayTeam = &domain.Team{}
		var startTime time.Time
		err := rows.Scan(
			&m.ID, &m.CompetitionID, &m.HomeTeamID, &m.AwayTeamID, &m.Date, &startTime, &m.Venue, &m.Status, &m.HomeScore, &m.AwayScore, &m.HighlightsURL, &m.TicketURL, &m.CreatedAt, &m.UpdatedAt,
			&m.Competition.ID, &m.Competition.Name, &m.Competition.Logo,
			&m.HomeTeam.ID, &m.HomeTeam.Name, &m.HomeTeam.ShortName, &m.HomeTeam.Logo,
			&m.AwayTeam.ID, &m.AwayTeam.Name, &m.AwayTeam.ShortName, &m.AwayTeam.Logo,
		)
		if err != nil {
			return nil, 0, err
		}
		m.StartTime = startTime
		matches = append(matches, m)
	}
	return matches, total, nil
}

func (r *PostgresMatchRepository) GetMatchByID(ctx context.Context, id string) (*domain.Match, error) {
	query := `SELECT id, competition_id, status FROM matches WHERE id = $1`
	var m domain.Match
	err := r.db.QueryRow(ctx, query, id).Scan(&m.ID, &m.CompetitionID, &m.Status)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *PostgresMatchRepository) CreateMatch(ctx context.Context, match *domain.Match) error {
	query := `
		INSERT INTO matches (competition_id, home_team_id, away_team_id, date, time, venue, status, home_score, away_score, highlights_url, ticket_url)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, created_at, updated_at
	`
	return r.db.QueryRow(ctx, query,
		match.CompetitionID, match.HomeTeamID, match.AwayTeamID, match.Date, match.StartTime, match.Venue, match.Status, match.HomeScore, match.AwayScore, match.HighlightsURL, match.TicketURL,
	).Scan(&match.ID, &match.CreatedAt, &match.UpdatedAt)
}

func (r *PostgresMatchRepository) UpdateMatch(ctx context.Context, match *domain.Match) error {
	query := `
        UPDATE matches SET competition_id=$1, home_team_id=$2, away_team_id=$3, date=$4, time=$5, venue=$6, status=$7, home_score=$8, away_score=$9, highlights_url=$10, ticket_url=$11, updated_at=NOW()
        WHERE id=$12
    `
	_, err := r.db.Exec(ctx, query,
		match.CompetitionID, match.HomeTeamID, match.AwayTeamID, match.Date, match.StartTime, match.Venue, match.Status, match.HomeScore, match.AwayScore, match.HighlightsURL, match.TicketURL, match.ID,
	)
	return err
}

func (r *PostgresMatchRepository) DeleteMatch(ctx context.Context, id string) error {
	query := `DELETE FROM matches WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

// --- Standings ---
func (r *PostgresMatchRepository) GetStandings(ctx context.Context, competitionID string) ([]domain.Standing, error) {
	query := `
        SELECT 
            s.id, s.competition_id, s.team_id, 
            ROW_NUMBER() OVER (ORDER BY s.pct DESC, s.goals_for DESC, s.goal_difference DESC, t.name ASC) as position, 
            s.played, s.won, s.drawn, s.lost, s.goals_for, s.goals_against, s.goal_difference, s.pct, s.l5,
            t.id, t.name, t.short_name, t.logo
        FROM standings s
        JOIN teams t ON s.team_id = t.id
        WHERE s.competition_id = $1
        ORDER BY position ASC
    `
	rows, err := r.db.Query(ctx, query, competitionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var standings []domain.Standing
	for rows.Next() {
		var s domain.Standing
		s.Team = &domain.Team{}
		err := rows.Scan(
			&s.ID, &s.CompetitionID, &s.TeamID, &s.Position, &s.Played, &s.Won, &s.Drawn, &s.Lost, &s.GoalsFor, &s.GoalsAgainst, &s.GoalDiff, &s.PCT, &s.L5,
			&s.Team.ID, &s.Team.Name, &s.Team.ShortName, &s.Team.Logo,
		)
		if err != nil {
			return nil, err
		}
		standings = append(standings, s)
	}
	return standings, nil
}

func (r *PostgresMatchRepository) CreateStanding(ctx context.Context, standing *domain.Standing) error {
	query := `
		INSERT INTO standings (competition_id, team_id, position, played, won, drawn, lost, goals_for, goals_against, pct, l5)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, created_at, updated_at
	`
	return r.db.QueryRow(ctx, query,
		standing.CompetitionID, standing.TeamID, standing.Position, standing.Played, standing.Won, standing.Drawn, standing.Lost, standing.GoalsFor, standing.GoalsAgainst, standing.PCT, standing.L5,
	).Scan(&standing.ID, &standing.CreatedAt, &standing.UpdatedAt)
}

func (r *PostgresMatchRepository) UpdateStanding(ctx context.Context, standing *domain.Standing) error {
	query := `
		UPDATE standings SET competition_id=$1, team_id=$2, position=$3, played=$4, won=$5, drawn=$6, lost=$7, goals_for=$8, goals_against=$9, pct=$10, l5=$11, updated_at=NOW()
		WHERE id=$12
	`
	_, err := r.db.Exec(ctx, query,
		standing.CompetitionID, standing.TeamID, standing.Position, standing.Played, standing.Won, standing.Drawn, standing.Lost, standing.GoalsFor, standing.GoalsAgainst, standing.PCT, standing.L5, standing.ID,
	)
	return err
}

func (r *PostgresMatchRepository) DeleteStanding(ctx context.Context, id string) error {
	query := `DELETE FROM standings WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *PostgresMatchRepository) RecalculateStandings(ctx context.Context, competitionID string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	query := `
		WITH match_results AS (
		  SELECT
			home_team_id AS team_id, competition_id,
			home_score AS gf, away_score AS ga, date, time,
			CASE
			  WHEN home_score > away_score THEN 'W'
			  WHEN home_score = away_score THEN 'D'
			  ELSE 'L'
			END AS result
		  FROM matches
		  WHERE competition_id = $1 AND status = 'FINISHED'
			AND home_score IS NOT NULL AND away_score IS NOT NULL

		  UNION ALL

		  SELECT
			away_team_id AS team_id, competition_id,
			away_score AS gf, home_score AS ga, date, time,
			CASE
			  WHEN away_score > home_score THEN 'W'
			  WHEN away_score = home_score THEN 'D'
			  ELSE 'L'
			END AS result
		  FROM matches
		  WHERE competition_id = $1 AND status = 'FINISHED'
			AND home_score IS NOT NULL AND away_score IS NOT NULL
		),
		aggregated AS (
		  SELECT
			team_id,
			COUNT(*)::INT                          AS played,
			COUNT(*) FILTER (WHERE result = 'W')::INT  AS won,
			COUNT(*) FILTER (WHERE result = 'D')::INT  AS drawn,
			COUNT(*) FILTER (WHERE result = 'L')::INT  AS lost,
			COALESCE(SUM(gf), 0)::INT             AS goals_for,
			COALESCE(SUM(ga), 0)::INT             AS goals_against
		  FROM match_results
		  GROUP BY team_id
		),
		l5_ordered AS (
		  SELECT team_id,
			STRING_AGG(result, '' ORDER BY date ASC, time ASC) FILTER (
			  WHERE rn <= 5
			) AS l5
		  FROM (
			SELECT *, ROW_NUMBER() OVER (
			  PARTITION BY team_id ORDER BY date DESC, time DESC
			) AS rn
			FROM match_results
		  ) ranked
		  GROUP BY team_id
		)
		INSERT INTO standings (
			competition_id, team_id, played, won, drawn, lost, 
			goals_for, goals_against, pct, l5, updated_at
		)
		SELECT 
			$1, 
			a.team_id, 
			a.played, 
			a.won, 
			a.drawn, 
			a.lost, 
			a.goals_for, 
			a.goals_against, 
			CASE WHEN a.played > 0
				THEN ROUND(((a.won * 1.0) + (a.drawn * 0.5)) / a.played * 100, 1)
				ELSE 0 END, 
			COALESCE(l5.l5, ''),
			NOW()
		FROM aggregated a
		LEFT JOIN l5_ordered l5 ON l5.team_id = a.team_id
		ON CONFLICT (competition_id, team_id) DO UPDATE SET
			played = EXCLUDED.played,
			won = EXCLUDED.won,
			drawn = EXCLUDED.drawn,
			lost = EXCLUDED.lost,
			goals_for = EXCLUDED.goals_for,
			goals_against = EXCLUDED.goals_against,
			pct = EXCLUDED.pct,
			l5 = EXCLUDED.l5,
			updated_at = NOW()
	`
	if _, err := tx.Exec(ctx, query, competitionID); err != nil {
		return err
	}

	zeroOutQuery := `
		UPDATE standings SET
		  played=0, won=0, drawn=0, lost=0,
		  goals_for=0, goals_against=0, pct=0, l5='', updated_at=NOW()
		WHERE competition_id = $1
		  AND team_id NOT IN (
			SELECT DISTINCT home_team_id FROM matches 
			WHERE competition_id = $1 AND status = 'FINISHED' 
			  AND home_score IS NOT NULL AND away_score IS NOT NULL
			UNION
			SELECT DISTINCT away_team_id FROM matches 
			WHERE competition_id = $1 AND status = 'FINISHED' 
			  AND home_score IS NOT NULL AND away_score IS NOT NULL
		  )
	`
	if _, err := tx.Exec(ctx, zeroOutQuery, competitionID); err != nil {
		return err
	}

	return tx.Commit(ctx)
}
