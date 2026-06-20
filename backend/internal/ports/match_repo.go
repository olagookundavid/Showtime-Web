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
	SetMatchSlot(ctx context.Context, matchID, slot string, teamID *string) error
	CountMatchesByCompetition(ctx context.Context, competitionID string) (int64, error)
	DeleteMatchesByCompetition(ctx context.Context, competitionID string) error

	// Standings
	GetStandings(ctx context.Context, competitionID string) ([]domain.Standing, error)
	CreateStanding(ctx context.Context, standing *domain.Standing) error
	UpdateStanding(ctx context.Context, standing *domain.Standing) error
	DeleteStanding(ctx context.Context, id string) error
	GetStandingByID(ctx context.Context, id string) (*domain.Standing, error)
	RecalculateStandings(ctx context.Context, competitionID string) error

	// Team Sheets
	SaveTeamSheet(ctx context.Context, matchID, teamID string, playerIDs []string) error
	GetTeamSheet(ctx context.Context, matchID string) (*domain.MatchTeamSheet, error)
	IsPlayerOnTeamSheet(ctx context.Context, matchID, playerID string) (bool, error)
	GetMatchDetail(ctx context.Context, matchID string) (*domain.MatchDetail, error)
	GetMatchDaysByCompetition(ctx context.Context, competitionID string) ([]string, error)
	GetEligiblePlayersForMatchDay(ctx context.Context, competitionID string, date string) ([]domain.Player, error)
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

	query := `SELECT id, name, logo, status, format, playoff_competition_id, created_at, updated_at ` + baseQuery +
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
		if err := rows.Scan(&c.ID, &c.Name, &c.Logo, &c.Status, &c.Format, &c.PlayoffCompetitionID, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, 0, err
		}
		competitions = append(competitions, c)
	}
	return competitions, total, nil
}

func (r *PostgresMatchRepository) GetCompetitionByID(ctx context.Context, id string) (*domain.Competition, error) {
	query := `SELECT id, name, logo, status, format, playoff_competition_id, created_at, updated_at FROM competitions WHERE id = $1`
	var c domain.Competition
	err := r.db.QueryRow(ctx, query, id).Scan(&c.ID, &c.Name, &c.Logo, &c.Status, &c.Format, &c.PlayoffCompetitionID, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *PostgresMatchRepository) CreateCompetition(ctx context.Context, comp *domain.Competition) error {
	var playoffID *string
	if comp.PlayoffCompetitionID != nil && *comp.PlayoffCompetitionID != "" {
		playoffID = comp.PlayoffCompetitionID
	}
	query := `INSERT INTO competitions (name, logo, status, format, playoff_competition_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at, updated_at`
	return r.db.QueryRow(ctx, query, comp.Name, comp.Logo, comp.Status, comp.Format, playoffID).Scan(&comp.ID, &comp.CreatedAt, &comp.UpdatedAt)
}

func (r *PostgresMatchRepository) UpdateCompetition(ctx context.Context, comp *domain.Competition) error {
	var playoffID *string
	if comp.PlayoffCompetitionID != nil && *comp.PlayoffCompetitionID != "" {
		playoffID = comp.PlayoffCompetitionID
	}
	query := `UPDATE competitions SET name=$1, logo=$2, status=$3, format=$4, playoff_competition_id=$5, updated_at=NOW() WHERE id=$6`
	_, err := r.db.Exec(ctx, query, comp.Name, comp.Logo, comp.Status, comp.Format, playoffID, comp.ID)
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
	// Team columns are COALESCE'd: knockout brackets keep home/away NULL (TBD)
	// until a feeder match finishes, and the domain scans them as strings.
	query := `
		SELECT
			m.id, m.competition_id, COALESCE(m.home_team_id::text, ''), COALESCE(m.away_team_id::text, ''), m.date, m.time, m.venue, m.status, m.home_score, m.away_score, m.highlights_url, m.ticket_url, m.created_at, m.updated_at,
			COALESCE(m.round, ''), m.bracket_pos, m.feeds_match_id::text, COALESCE(m.feeds_slot, ''),
			c.id, c.name, c.logo, COALESCE(c.format, 'LEAGUE'),
			COALESCE(ht.id::text, ''), COALESCE(ht.name, ''), COALESCE(ht.short_name, ''), COALESCE(ht.logo, ''),
			COALESCE(at.id::text, ''), COALESCE(at.name, ''), COALESCE(at.short_name, ''), COALESCE(at.logo, '')
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
			&m.Round, &m.BracketPos, &m.FeedsMatchID, &m.FeedsSlot,
			&m.Competition.ID, &m.Competition.Name, &m.Competition.Logo, &m.Competition.Format,
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
	query := `
		SELECT id, competition_id, status,
		       COALESCE(home_team_id::text, ''), COALESCE(away_team_id::text, ''),
		       home_score, away_score,
		       COALESCE(round, ''), bracket_pos, feeds_match_id::text, COALESCE(feeds_slot, '')
		FROM matches WHERE id = $1
	`
	var m domain.Match
	err := r.db.QueryRow(ctx, query, id).Scan(
		&m.ID, &m.CompetitionID, &m.Status,
		&m.HomeTeamID, &m.AwayTeamID,
		&m.HomeScore, &m.AwayScore,
		&m.Round, &m.BracketPos, &m.FeedsMatchID, &m.FeedsSlot,
	)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *PostgresMatchRepository) CreateMatch(ctx context.Context, match *domain.Match) error {
	// NULLIF: empty team IDs are stored as NULL (TBD bracket slots).
	query := `
		INSERT INTO matches (competition_id, home_team_id, away_team_id, date, time, venue, status, home_score, away_score, highlights_url, ticket_url, round, bracket_pos, feeds_match_id, feeds_slot)
		VALUES ($1, NULLIF($2, '')::uuid, NULLIF($3, '')::uuid, $4, $5, $6, $7, $8, $9, $10, $11, NULLIF($12, ''), $13, $14, NULLIF($15, ''))
		RETURNING id, created_at, updated_at
	`
	return r.db.QueryRow(ctx, query,
		match.CompetitionID, match.HomeTeamID, match.AwayTeamID, match.Date, match.StartTime, match.Venue, match.Status, match.HomeScore, match.AwayScore, match.HighlightsURL, match.TicketURL,
		match.Round, match.BracketPos, match.FeedsMatchID, match.FeedsSlot,
	).Scan(&match.ID, &match.CreatedAt, &match.UpdatedAt)
}

func (r *PostgresMatchRepository) UpdateMatch(ctx context.Context, match *domain.Match) error {
	query := `
        UPDATE matches SET competition_id=$1, home_team_id=NULLIF($2, '')::uuid, away_team_id=NULLIF($3, '')::uuid, date=$4, time=$5, venue=$6, status=$7, home_score=$8, away_score=$9, highlights_url=$10, ticket_url=$11,
            round=NULLIF($12, ''), bracket_pos=$13, feeds_match_id=$14, feeds_slot=NULLIF($15, ''), updated_at=NOW()
        WHERE id=$16
    `
	_, err := r.db.Exec(ctx, query,
		match.CompetitionID, match.HomeTeamID, match.AwayTeamID, match.Date, match.StartTime, match.Venue, match.Status, match.HomeScore, match.AwayScore, match.HighlightsURL, match.TicketURL,
		match.Round, match.BracketPos, match.FeedsMatchID, match.FeedsSlot, match.ID,
	)
	return err
}

// SetMatchSlot writes (or clears) one team slot of a bracket match. Used by
// auto-advance: the winner of a feeder match lands in the slot it feeds.
func (r *PostgresMatchRepository) SetMatchSlot(ctx context.Context, matchID, slot string, teamID *string) error {
	col := "home_team_id"
	if slot == "AWAY" {
		col = "away_team_id"
	} else if slot != "HOME" {
		return fmt.Errorf("invalid bracket slot %q", slot)
	}
	query := fmt.Sprintf(`UPDATE matches SET %s = $1, updated_at = NOW() WHERE id = $2`, col)
	_, err := r.db.Exec(ctx, query, teamID, matchID)
	return err
}

func (r *PostgresMatchRepository) DeleteMatch(ctx context.Context, id string) error {
	query := `DELETE FROM matches WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *PostgresMatchRepository) CountMatchesByCompetition(ctx context.Context, competitionID string) (int64, error) {
	var n int64
	err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM matches WHERE competition_id = $1`, competitionID).Scan(&n)
	return n, err
}

func (r *PostgresMatchRepository) DeleteMatchesByCompetition(ctx context.Context, competitionID string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM matches WHERE competition_id = $1`, competitionID)
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

func (r *PostgresMatchRepository) GetStandingByID(ctx context.Context, id string) (*domain.Standing, error) {
	query := `SELECT id, competition_id, team_id, position, played, won, drawn, lost, goals_for, goals_against, pct, l5, created_at, updated_at FROM standings WHERE id = $1`
	var s domain.Standing
	err := r.db.QueryRow(ctx, query, id).Scan(&s.ID, &s.CompetitionID, &s.TeamID, &s.Position, &s.Played, &s.Won, &s.Drawn, &s.Lost, &s.GoalsFor, &s.GoalsAgainst, &s.PCT, &s.L5, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &s, nil
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

// --- Team Sheets ---
func (r *PostgresMatchRepository) SaveTeamSheet(ctx context.Context, matchID, teamID string, playerIDs []string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Idempotent: delete existing first
	delQuery := `DELETE FROM match_team_sheets WHERE match_id = $1 AND team_id = $2`
	if _, err := tx.Exec(ctx, delQuery, matchID, teamID); err != nil {
		return err
	}

	// Insert new
	if len(playerIDs) > 0 {
		insertQuery := `INSERT INTO match_team_sheets (match_id, team_id, player_id) VALUES ($1, $2, $3)`
		for _, pid := range playerIDs {
			if _, err := tx.Exec(ctx, insertQuery, matchID, teamID, pid); err != nil {
				return err
			}
		}
	}

	return tx.Commit(ctx)
}

func (r *PostgresMatchRepository) GetTeamSheet(ctx context.Context, matchID string) (*domain.MatchTeamSheet, error) {
	// We need to know which team is home and which is away to partition correctly.
	matchQuery := `SELECT COALESCE(home_team_id::text, ''), COALESCE(away_team_id::text, '') FROM matches WHERE id = $1`
	var homeTeamID, awayTeamID string
	if err := r.db.QueryRow(ctx, matchQuery, matchID).Scan(&homeTeamID, &awayTeamID); err != nil {
		return nil, err
	}

	query := `
		SELECT mts.team_id, p.id, p.name, p.jersey_number, p.position, p.image
		FROM match_team_sheets mts
		JOIN players p ON mts.player_id = p.id
		WHERE mts.match_id = $1
		ORDER BY p.jersey_number ASC
	`
	rows, err := r.db.Query(ctx, query, matchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sheet := &domain.MatchTeamSheet{
		HomeTeam: make([]domain.TeamSheetPlayer, 0),
		AwayTeam: make([]domain.TeamSheetPlayer, 0),
	}

	for rows.Next() {
		var teamID string
		var p domain.TeamSheetPlayer
		// image might be null
		var img *string
		if err := rows.Scan(&teamID, &p.PlayerID, &p.Name, &p.JerseyNumber, &p.Position, &img); err != nil {
			return nil, err
		}
		if img != nil {
			p.Image = *img
		}
		switch teamID {
		case homeTeamID:
			sheet.HomeTeam = append(sheet.HomeTeam, p)
		case awayTeamID:
			sheet.AwayTeam = append(sheet.AwayTeam, p)
		}
	}
	return sheet, nil
}

func (r *PostgresMatchRepository) IsPlayerOnTeamSheet(ctx context.Context, matchID, playerID string) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM match_team_sheets WHERE match_id = $1 AND player_id = $2)`
	var exists bool
	err := r.db.QueryRow(ctx, query, matchID, playerID).Scan(&exists)
	return exists, err
}

func (r *PostgresMatchRepository) GetMatchDetail(ctx context.Context, matchID string) (*domain.MatchDetail, error) {
	// Full fetch with joined competition and team data
	query := `
		SELECT
			m.id, m.competition_id, COALESCE(m.home_team_id::text, ''), COALESCE(m.away_team_id::text, ''), m.date, m.time, m.venue, m.status, m.home_score, m.away_score, m.highlights_url, m.ticket_url, m.created_at, m.updated_at,
			COALESCE(m.round, ''), m.bracket_pos, m.feeds_match_id::text, COALESCE(m.feeds_slot, ''),
			c.id, c.name, c.logo, COALESCE(c.format, 'LEAGUE'),
			COALESCE(ht.id::text, ''), COALESCE(ht.name, ''), COALESCE(ht.short_name, ''), COALESCE(ht.logo, ''),
			COALESCE(at.id::text, ''), COALESCE(at.name, ''), COALESCE(at.short_name, ''), COALESCE(at.logo, '')
		FROM matches m
		LEFT JOIN competitions c ON m.competition_id = c.id
		LEFT JOIN teams ht ON m.home_team_id = ht.id
		LEFT JOIN teams at ON m.away_team_id = at.id
		WHERE m.id = $1
	`
	var m domain.Match
	m.Competition = &domain.Competition{}
	m.HomeTeam = &domain.Team{}
	m.AwayTeam = &domain.Team{}
	var startTime time.Time

	err := r.db.QueryRow(ctx, query, matchID).Scan(
		&m.ID, &m.CompetitionID, &m.HomeTeamID, &m.AwayTeamID, &m.Date, &startTime, &m.Venue, &m.Status, &m.HomeScore, &m.AwayScore, &m.HighlightsURL, &m.TicketURL, &m.CreatedAt, &m.UpdatedAt,
		&m.Round, &m.BracketPos, &m.FeedsMatchID, &m.FeedsSlot,
		&m.Competition.ID, &m.Competition.Name, &m.Competition.Logo, &m.Competition.Format,
		&m.HomeTeam.ID, &m.HomeTeam.Name, &m.HomeTeam.ShortName, &m.HomeTeam.Logo,
		&m.AwayTeam.ID, &m.AwayTeam.Name, &m.AwayTeam.ShortName, &m.AwayTeam.Logo,
	)
	if err != nil {
		return nil, err
	}
	m.StartTime = startTime

	sheet, err := r.GetTeamSheet(ctx, matchID)
	if err != nil {
		return nil, err
	}

	return &domain.MatchDetail{
		Match:     m,
		TeamSheet: *sheet,
	}, nil
}

func (r *PostgresMatchRepository) GetMatchDaysByCompetition(ctx context.Context, competitionID string) ([]string, error) {
	query := `
		SELECT DISTINCT date::TEXT 
		FROM matches 
		WHERE competition_id = $1 
		ORDER BY date DESC
	`
	rows, err := r.db.Query(ctx, query, competitionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var dates []string
	for rows.Next() {
		var d string
		if err := rows.Scan(&d); err != nil {
			return nil, err
		}
		dates = append(dates, d)
	}
	return dates, nil
}

func (r *PostgresMatchRepository) GetEligiblePlayersForMatchDay(ctx context.Context, competitionID string, date string) ([]domain.Player, error) {
	query := `
		SELECT DISTINCT
			p.id, p.name,
			COALESCE(p.jersey_number, 0) AS jersey_number,
			COALESCE(p.position, '') AS position,
			p.team_id,
			COALESCE(p.bio, '') AS bio,
			COALESCE(p.image, '') AS image,
			COALESCE(p.email, '') AS email,
			p.created_at, p.updated_at,
			t.id AS t_id, t.name AS t_name, t.short_name AS t_short_name, COALESCE(t.logo, '') AS t_logo
		FROM players p
		JOIN match_team_sheets mts ON p.id = mts.player_id
		JOIN matches m ON mts.match_id = m.id
		JOIN teams t ON p.team_id = t.id
		WHERE m.competition_id = $1 AND m.date = $2
		ORDER BY t.name, p.name
	`
	rows, err := r.db.Query(ctx, query, competitionID, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var players []domain.Player
	for rows.Next() {
		var p domain.Player
		var team domain.Team
		if err := rows.Scan(
			&p.ID, &p.Name, &p.JerseyNumber, &p.Position, &p.TeamID, &p.Bio,
			&p.Image, &p.Email,
			&p.CreatedAt, &p.UpdatedAt,
			&team.ID, &team.Name, &team.ShortName, &team.Logo,
		); err != nil {
			return nil, err
		}
		p.Team = &team
		players = append(players, p)
	}
	return players, nil
}
