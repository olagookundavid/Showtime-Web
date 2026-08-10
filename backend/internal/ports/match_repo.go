package ports

import (
	"context"
	"fmt"
	"showtime-backend/internal/domain"
	"sort"
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
	GetTeams(ctx context.Context, page, limit int, search string, status string) ([]domain.Team, int64, error)
	GetAllTeams(ctx context.Context, status string) ([]domain.Team, error)
	GetTeamByID(ctx context.Context, id string) (*domain.Team, error)
	CreateTeam(ctx context.Context, team *domain.Team) error
	UpdateTeam(ctx context.Context, team *domain.Team) error
	DeleteTeam(ctx context.Context, id string) error
	GetTeamsByCompetition(ctx context.Context, competitionID string, status string) ([]domain.Team, error)
	AddTeamToCompetition(ctx context.Context, competitionID, teamID string) error
	RemoveTeamFromCompetition(ctx context.Context, competitionID, teamID string) error
	CanRemoveTeamFromCompetition(ctx context.Context, competitionID, teamID string) (bool, string, error)

	// Matches
	GetMatches(ctx context.Context, competitionID string, status string, page, limit int, search string, date ...string) ([]domain.Match, int64, error)
	GetMatchByID(ctx context.Context, id string) (*domain.Match, error)
	CreateMatch(ctx context.Context, match *domain.Match) error
	UpdateMatch(ctx context.Context, match *domain.Match) error
	DeleteMatch(ctx context.Context, id string) error
	SetMatchSlot(ctx context.Context, matchID, slot string, teamID *string) error
	SetMatchPBPLock(ctx context.Context, matchID string, locked bool) error
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

	query := `SELECT id, name, logo, status, format, playoff_competition_id, COALESCE(tie_breaker_rule, 'PCT_PD_PF_PA_NAME'), created_at, updated_at ` + baseQuery +
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
		if err := rows.Scan(&c.ID, &c.Name, &c.Logo, &c.Status, &c.Format, &c.PlayoffCompetitionID, &c.TieBreakerRule, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, 0, err
		}
		competitions = append(competitions, c)
	}
	return competitions, total, nil
}

func (r *PostgresMatchRepository) GetCompetitionByID(ctx context.Context, id string) (*domain.Competition, error) {
	query := `SELECT id, name, logo, status, format, playoff_competition_id, COALESCE(tie_breaker_rule, 'PCT_PD_PF_PA_NAME'), created_at, updated_at FROM competitions WHERE id = $1`
	var c domain.Competition
	err := r.db.QueryRow(ctx, query, id).Scan(&c.ID, &c.Name, &c.Logo, &c.Status, &c.Format, &c.PlayoffCompetitionID, &c.TieBreakerRule, &c.CreatedAt, &c.UpdatedAt)
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
	if comp.TieBreakerRule == "" {
		comp.TieBreakerRule = domain.TieBreakerRulePCT_PD_PF_PA_NAME
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	query := `INSERT INTO competitions (name, logo, status, format, playoff_competition_id, tie_breaker_rule) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at, updated_at`
	if err := tx.QueryRow(ctx, query, comp.Name, comp.Logo, comp.Status, comp.Format, playoffID, comp.TieBreakerRule).Scan(&comp.ID, &comp.CreatedAt, &comp.UpdatedAt); err != nil {
		return err
	}

	for _, teamID := range comp.TeamIDs {
		if teamID != "" {
			if _, err := tx.Exec(ctx, `INSERT INTO competition_teams (competition_id, team_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, comp.ID, teamID); err != nil {
				return err
			}
			if comp.Format == "LEAGUE" || comp.Format == "" {
				if _, err := tx.Exec(ctx, `INSERT INTO standings (competition_id, team_id, position, played, won, drawn, lost, goals_for, goals_against, pct, l5, updated_at) VALUES ($1, $2, 0, 0, 0, 0, 0, 0, 0, 0, '', NOW()) ON CONFLICT (competition_id, team_id) DO NOTHING`, comp.ID, teamID); err != nil {
					return err
				}
			}
		}
	}

	return tx.Commit(ctx)
}

func (r *PostgresMatchRepository) UpdateCompetition(ctx context.Context, comp *domain.Competition) error {
	var playoffID *string
	if comp.PlayoffCompetitionID != nil && *comp.PlayoffCompetitionID != "" {
		playoffID = comp.PlayoffCompetitionID
	}
	if comp.TieBreakerRule == "" {
		comp.TieBreakerRule = domain.TieBreakerRulePCT_PD_PF_PA_NAME
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	query := `UPDATE competitions SET name=$1, logo=$2, status=$3, format=$4, playoff_competition_id=$5, tie_breaker_rule=$6, updated_at=NOW() WHERE id=$7`
	if _, err := tx.Exec(ctx, query, comp.Name, comp.Logo, comp.Status, comp.Format, playoffID, comp.TieBreakerRule, comp.ID); err != nil {
		return err
	}

	if comp.TeamIDs != nil {
		if _, err := tx.Exec(ctx, `DELETE FROM competition_teams WHERE competition_id = $1`, comp.ID); err != nil {
			return err
		}
		for _, teamID := range comp.TeamIDs {
			if teamID != "" {
				if _, err := tx.Exec(ctx, `INSERT INTO competition_teams (competition_id, team_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, comp.ID, teamID); err != nil {
					return err
				}
				if comp.Format == "LEAGUE" || comp.Format == "" {
					if _, err := tx.Exec(ctx, `INSERT INTO standings (competition_id, team_id, position, played, won, drawn, lost, goals_for, goals_against, pct, l5, updated_at) VALUES ($1, $2, 0, 0, 0, 0, 0, 0, 0, 0, '', NOW()) ON CONFLICT (competition_id, team_id) DO NOTHING`, comp.ID, teamID); err != nil {
						return err
					}
				}
			}
		}
	}

	return tx.Commit(ctx)
}

func (r *PostgresMatchRepository) DeleteCompetition(ctx context.Context, id string) error {
	query := `DELETE FROM competitions WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

// --- Teams ---
func (r *PostgresMatchRepository) GetTeams(ctx context.Context, page, limit int, search string, status string) ([]domain.Team, int64, error) {
	offset := (page - 1) * limit

	countQuery := `SELECT COUNT(*) FROM teams WHERE 1=1`
	query := `SELECT id, name, short_name, logo, COALESCE(status, 'active') as status, created_at, updated_at FROM teams WHERE 1=1`

	args := []interface{}{}
	argIndex := 1

	if search != "" {
		filter := "%" + search + "%"
		countQuery += ` AND (name ILIKE $` + fmt.Sprint(argIndex) + ` OR short_name ILIKE $` + fmt.Sprint(argIndex) + `)`
		query += ` AND (name ILIKE $` + fmt.Sprint(argIndex) + ` OR short_name ILIKE $` + fmt.Sprint(argIndex) + `)`
		args = append(args, filter)
		argIndex++
	}

	if status != "" {
		countQuery += ` AND COALESCE(status, 'active') = $` + fmt.Sprint(argIndex)
		query += ` AND COALESCE(status, 'active') = $` + fmt.Sprint(argIndex)
		args = append(args, status)
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
		if err := rows.Scan(&t.ID, &t.Name, &t.ShortName, &t.Logo, &t.Status, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, 0, err
		}
		teams = append(teams, t)
	}
	return teams, total, nil
}

func (r *PostgresMatchRepository) GetAllTeams(ctx context.Context, status string) ([]domain.Team, error) {
	query := `SELECT id, name, short_name, logo, COALESCE(status, 'active') as status, created_at, updated_at FROM teams WHERE 1=1`
	args := []interface{}{}

	if status != "" {
		query += ` AND COALESCE(status, 'active') = $1`
		args = append(args, status)
	}
	query += ` ORDER BY name ASC`

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var teams []domain.Team
	for rows.Next() {
		var t domain.Team
		if err := rows.Scan(&t.ID, &t.Name, &t.ShortName, &t.Logo, &t.Status, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		teams = append(teams, t)
	}
	return teams, nil
}

func (r *PostgresMatchRepository) GetTeamByID(ctx context.Context, id string) (*domain.Team, error) {
	query := `SELECT id, name, short_name, logo, COALESCE(status, 'active') as status, created_at, updated_at FROM teams WHERE id = $1`
	var t domain.Team
	err := r.db.QueryRow(ctx, query, id).Scan(&t.ID, &t.Name, &t.ShortName, &t.Logo, &t.Status, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *PostgresMatchRepository) CreateTeam(ctx context.Context, team *domain.Team) error {
	if team.Status == "" {
		team.Status = "active"
	}
	query := `INSERT INTO teams (name, short_name, logo, status) VALUES ($1, $2, $3, $4) RETURNING id, created_at, updated_at`
	return r.db.QueryRow(ctx, query, team.Name, team.ShortName, team.Logo, team.Status).Scan(&team.ID, &team.CreatedAt, &team.UpdatedAt)
}

func (r *PostgresMatchRepository) UpdateTeam(ctx context.Context, team *domain.Team) error {
	if team.Status == "" {
		team.Status = "active"
	}
	query := `UPDATE teams SET name=$1, short_name=$2, logo=$3, status=$4, updated_at=NOW() WHERE id=$5`
	_, err := r.db.Exec(ctx, query, team.Name, team.ShortName, team.Logo, team.Status, team.ID)
	return err
}

func (r *PostgresMatchRepository) DeleteTeam(ctx context.Context, id string) error {
	query := `DELETE FROM teams WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *PostgresMatchRepository) GetTeamsByCompetition(ctx context.Context, competitionID string, status string) ([]domain.Team, error) {
	query := `SELECT DISTINCT t.id, t.name, t.short_name, t.logo, COALESCE(t.status, 'active') as status, t.created_at, t.updated_at
		FROM teams t
		INNER JOIN competition_teams ct ON ct.team_id = t.id
		WHERE ct.competition_id = $1`
	args := []interface{}{competitionID}

	if status != "" {
		query += ` AND COALESCE(t.status, 'active') = $2`
		args = append(args, status)
	}
	query += ` ORDER BY t.name ASC`

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var teams []domain.Team
	for rows.Next() {
		var t domain.Team
		if err := rows.Scan(&t.ID, &t.Name, &t.ShortName, &t.Logo, &t.Status, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		teams = append(teams, t)
	}
	return teams, nil
}

func (r *PostgresMatchRepository) AddTeamToCompetition(ctx context.Context, competitionID, teamID string) error {
	query := `INSERT INTO competition_teams (competition_id, team_id) VALUES ($1, $2) ON CONFLICT (competition_id, team_id) DO NOTHING`
	if _, err := r.db.Exec(ctx, query, competitionID, teamID); err != nil {
		return err
	}
	var format string
	_ = r.db.QueryRow(ctx, `SELECT COALESCE(format, 'LEAGUE') FROM competitions WHERE id = $1`, competitionID).Scan(&format)
	if format == "LEAGUE" || format == "" {
		_, _ = r.db.Exec(ctx, `INSERT INTO standings (competition_id, team_id, position, played, won, drawn, lost, goals_for, goals_against, pct, l5, updated_at) VALUES ($1, $2, 0, 0, 0, 0, 0, 0, 0, 0, '', NOW()) ON CONFLICT (competition_id, team_id) DO NOTHING`, competitionID, teamID)
	}
	return nil
}

func (r *PostgresMatchRepository) RemoveTeamFromCompetition(ctx context.Context, competitionID, teamID string) error {
	canRemove, reason, err := r.CanRemoveTeamFromCompetition(ctx, competitionID, teamID)
	if err != nil {
		return err
	}
	if !canRemove {
		return fmt.Errorf("%s", reason)
	}
	query := `DELETE FROM competition_teams WHERE competition_id = $1 AND team_id = $2`
	_, err = r.db.Exec(ctx, query, competitionID, teamID)
	return err
}

func (r *PostgresMatchRepository) CanRemoveTeamFromCompetition(ctx context.Context, competitionID, teamID string) (bool, string, error) {
	var matchCount int
	err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM matches WHERE competition_id = $1 AND (home_team_id = $2 OR away_team_id = $2)`, competitionID, teamID).Scan(&matchCount)
	if err != nil {
		return false, "", err
	}
	if matchCount > 0 {
		return false, "Team has matches in this competition and cannot be removed.", nil
	}

	var standingCount int
	err = r.db.QueryRow(ctx, `SELECT COUNT(*) FROM standings WHERE competition_id = $1 AND team_id = $2`, competitionID, teamID).Scan(&standingCount)
	if err != nil {
		return false, "", err
	}
	if standingCount > 0 {
		return false, "Team has standings entries in this competition and cannot be removed.", nil
	}

	return true, "", nil
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
			COALESCE(m.round, ''), m.bracket_pos, m.feeds_match_id::text, COALESCE(m.feeds_slot, ''), m.second_leg_match_id::text, m.pbp_locked,
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
	orderBy := "m.date DESC, m.time DESC"
	if status == "SCHEDULED" {
		orderBy = "m.date ASC, m.time ASC"
	}
	query += whereClause + ` ORDER BY ` + orderBy + ` LIMIT $` + fmt.Sprintf("%d", len(args)+1) + ` OFFSET $` + fmt.Sprintf("%d", len(args)+2)
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
			&m.Round, &m.BracketPos, &m.FeedsMatchID, &m.FeedsSlot, &m.SecondLegMatchID, &m.PBPLocked,
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
		       COALESCE(round, ''), bracket_pos, feeds_match_id::text, COALESCE(feeds_slot, ''), second_leg_match_id::text,
		       pbp_locked
		FROM matches WHERE id = $1
	`
	var m domain.Match
	err := r.db.QueryRow(ctx, query, id).Scan(
		&m.ID, &m.CompetitionID, &m.Status,
		&m.HomeTeamID, &m.AwayTeamID,
		&m.HomeScore, &m.AwayScore,
		&m.Round, &m.BracketPos, &m.FeedsMatchID, &m.FeedsSlot, &m.SecondLegMatchID,
		&m.PBPLocked,
	)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *PostgresMatchRepository) CreateMatch(ctx context.Context, match *domain.Match) error {
	// NULLIF: empty team IDs are stored as NULL (TBD bracket slots).
	query := `
		INSERT INTO matches (competition_id, home_team_id, away_team_id, date, time, venue, status, home_score, away_score, highlights_url, ticket_url, round, bracket_pos, feeds_match_id, feeds_slot, second_leg_match_id)
		VALUES ($1, NULLIF($2, '')::uuid, NULLIF($3, '')::uuid, $4, $5, $6, $7, $8, $9, $10, $11, NULLIF($12, ''), $13, $14, NULLIF($15, ''), NULLIF($16, '')::uuid)
		RETURNING id, created_at, updated_at
	`
	return r.db.QueryRow(ctx, query,
		match.CompetitionID, match.HomeTeamID, match.AwayTeamID, match.Date, match.StartTime, match.Venue, match.Status, match.HomeScore, match.AwayScore, match.HighlightsURL, match.TicketURL,
		match.Round, match.BracketPos, match.FeedsMatchID, match.FeedsSlot, match.SecondLegMatchID,
	).Scan(&match.ID, &match.CreatedAt, &match.UpdatedAt)
}

func (r *PostgresMatchRepository) UpdateMatch(ctx context.Context, match *domain.Match) error {
	query := `
        UPDATE matches SET competition_id=$1, home_team_id=NULLIF($2, '')::uuid, away_team_id=NULLIF($3, '')::uuid, date=$4, time=$5, venue=$6, status=$7, home_score=$8, away_score=$9, highlights_url=$10, ticket_url=$11,
            round=NULLIF($12, ''), bracket_pos=$13, feeds_match_id=$14, feeds_slot=NULLIF($15, ''), second_leg_match_id=NULLIF($16, '')::uuid, updated_at=NOW()
        WHERE id=$17
    `
	_, err := r.db.Exec(ctx, query,
		match.CompetitionID, match.HomeTeamID, match.AwayTeamID, match.Date, match.StartTime, match.Venue, match.Status, match.HomeScore, match.AwayScore, match.HighlightsURL, match.TicketURL,
		match.Round, match.BracketPos, match.FeedsMatchID, match.FeedsSlot, match.SecondLegMatchID, match.ID,
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

func (r *PostgresMatchRepository) SetMatchPBPLock(ctx context.Context, matchID string, locked bool) error {
	_, err := r.db.Exec(ctx, `UPDATE matches SET pbp_locked = $1, updated_at = NOW() WHERE id = $2`, locked, matchID)
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
	var tieBreakerRule string
	_ = r.db.QueryRow(ctx, `SELECT COALESCE(tie_breaker_rule, 'PCT_PD_PF_PA_NAME') FROM competitions WHERE id = $1`, competitionID).Scan(&tieBreakerRule)
	if tieBreakerRule == "" {
		tieBreakerRule = domain.TieBreakerRulePCT_PD_PF_PA_NAME
	}

	query := `
        SELECT 
            COALESCE(s.id, md5(t.id || $1)) as id,
            $1 as competition_id,
            t.id as team_id,
            0 as position, 
            COALESCE(s.played, 0) as played,
            COALESCE(s.won, 0) as won,
            COALESCE(s.drawn, 0) as drawn,
            COALESCE(s.lost, 0) as lost,
            COALESCE(s.goals_for, 0) as goals_for,
            COALESCE(s.goals_against, 0) as goals_against,
            COALESCE(s.goal_difference, 0) as goal_difference,
            COALESCE(s.pct, 0) as pct,
            COALESCE(s.l5, '') as l5,
            t.id, t.name, t.short_name, t.logo
        FROM (
            SELECT team_id FROM competition_teams WHERE competition_id = $1
            UNION
            SELECT home_team_id AS team_id FROM matches WHERE competition_id = $1 AND home_team_id IS NOT NULL AND home_team_id != ''
            UNION
            SELECT away_team_id AS team_id FROM matches WHERE competition_id = $1 AND away_team_id IS NOT NULL AND away_team_id != ''
            UNION
            SELECT team_id FROM standings WHERE competition_id = $1
        ) comp_t
        JOIN teams t ON comp_t.team_id = t.id
        LEFT JOIN standings s ON s.competition_id = $1 AND s.team_id = t.id
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

	if len(standings) == 0 {
		return standings, nil
	}

	if tieBreakerRule == domain.TieBreakerRuleH2H_PCT_PD_PF_PA_NAME {
		// Rule 2: Head-to-Head -> Win % -> Point Diff -> Points For -> Points Against -> Name
		h2hPoints := make(map[string]map[string]int)
		mRows, err := r.db.Query(ctx, `
			SELECT home_team_id, away_team_id, home_score, away_score 
			FROM matches 
			WHERE competition_id = $1 AND status = 'FINISHED' AND home_score IS NOT NULL AND away_score IS NOT NULL
		`, competitionID)
		if err == nil {
			defer mRows.Close()
			for mRows.Next() {
				var hID, aID string
				var hScore, aScore int
				if err := mRows.Scan(&hID, &aID, &hScore, &aScore); err == nil {
					if h2hPoints[hID] == nil {
						h2hPoints[hID] = make(map[string]int)
					}
					if h2hPoints[aID] == nil {
						h2hPoints[aID] = make(map[string]int)
					}
					if hScore > aScore {
						h2hPoints[hID][aID] += 3
					} else if aScore > hScore {
						h2hPoints[aID][hID] += 3
					} else {
						h2hPoints[hID][aID] += 1
						h2hPoints[aID][hID] += 1
					}
				}
			}
		}

		sort.SliceStable(standings, func(i, j int) bool {
			a, b := standings[i], standings[j]
			ptsA := h2hPoints[a.TeamID][b.TeamID]
			ptsB := h2hPoints[b.TeamID][a.TeamID]
			if ptsA != ptsB {
				return ptsA > ptsB
			}
			if a.PCT != b.PCT {
				return a.PCT > b.PCT
			}
			if a.GoalDiff != b.GoalDiff {
				return a.GoalDiff > b.GoalDiff
			}
			if a.GoalsFor != b.GoalsFor {
				return a.GoalsFor > b.GoalsFor
			}
			if a.GoalsAgainst != b.GoalsAgainst {
				return a.GoalsAgainst < b.GoalsAgainst
			}
			return a.Team.Name < b.Team.Name
		})
	} else {
		// Rule 1 (Default): Win % -> Point Diff -> Points For -> Points Against -> Name
		sort.SliceStable(standings, func(i, j int) bool {
			a, b := standings[i], standings[j]
			if a.PCT != b.PCT {
				return a.PCT > b.PCT
			}
			if a.GoalDiff != b.GoalDiff {
				return a.GoalDiff > b.GoalDiff
			}
			if a.GoalsFor != b.GoalsFor {
				return a.GoalsFor > b.GoalsFor
			}
			if a.GoalsAgainst != b.GoalsAgainst {
				return a.GoalsAgainst < b.GoalsAgainst
			}
			return a.Team.Name < b.Team.Name
		})
	}

	for i := range standings {
		standings[i].Position = i + 1
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

	seedQuery := `
		INSERT INTO standings (
			competition_id, team_id, position, played, won, drawn, lost,
			goals_for, goals_against, pct, l5, updated_at
		)
		SELECT $1, t.team_id, 0, 0, 0, 0, 0, 0, 0, 0, '', NOW()
		FROM (
			SELECT team_id FROM competition_teams WHERE competition_id = $1
			UNION
			SELECT home_team_id AS team_id FROM matches WHERE competition_id = $1 AND home_team_id IS NOT NULL AND home_team_id != ''
			UNION
			SELECT away_team_id AS team_id FROM matches WHERE competition_id = $1 AND away_team_id IS NOT NULL AND away_team_id != ''
		) t
		ON CONFLICT (competition_id, team_id) DO NOTHING
	`
	if _, err := tx.Exec(ctx, seedQuery, competitionID); err != nil {
		return err
	}

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

	// LEFT JOIN this match's stat line for each rostered player so we can compute
	// their per-match rating. A player who didn't record stats has no ps row —
	// the COALESCEd zeros make the rating engine return UNRATED, which the caller
	// renders as the base rating. The QB rating's drive/turnover/punt inputs all
	// come from player_stats (per player), not team_match_stats — a backup QB must
	// not be credited with the starter's whole-game totals.
	query := `
		SELECT mts.team_id, p.id, p.name, p.jersey_number, p.position, p.image,
			COALESCE(ps.receptions, 0), COALESCE(ps.receiving_tds, 0),
			COALESCE(ps.extra_points_tds, 0), COALESCE(ps.drops, 0),
			COALESCE(ps.flag_pulls, 0), COALESCE(ps.pass_deflections, 0),
			COALESCE(ps.interceptions, 0), COALESCE(ps.defensive_tds, 0),
			COALESCE(ps.safety, 0), COALESCE(ps.defensive_xp_tds, 0),
			COALESCE(ps.def_sacks, 0), COALESCE(ps.passing_attempts, 0),
			COALESCE(ps.completed_passes, 0), COALESCE(ps.passing_yards, 0), COALESCE(ps.passing_tds, 0),
			COALESCE(ps.interceptions_thrown, 0), COALESCE(ps.rushing_attempts, 0),
			COALESCE(ps.rushing_yards, 0), COALESCE(ps.rushing_tds, 0), COALESCE(ps.qb_sacks, 0),
			COALESCE(ps.xp_attempts, 0), COALESCE(ps.qb_drives, 0),
			COALESCE(ps.qb_turnovers, 0), COALESCE(ps.qb_punts, 0)
		FROM match_team_sheets mts
		JOIN players p ON mts.player_id = p.id
		LEFT JOIN player_stats ps ON ps.player_id = p.id AND ps.match_id = mts.match_id
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
		var line domain.RatingStatLine
		if err := rows.Scan(&teamID, &p.PlayerID, &p.Name, &p.JerseyNumber, &p.Position, &img,
			&line.Receptions, &line.ReceivingTDs, &line.ExtraPointTDs, &line.Drops,
			&line.FlagPulls, &line.PassDeflections, &line.Interceptions, &line.DefensiveTDs,
			&line.Safeties, &line.DefensiveXPTDs, &line.DefensiveSacks,
			&line.PassingAttempts, &line.CompletedPasses, &line.PassingYards, &line.PassingTDs,
			&line.InterceptionsThrown, &line.RushingAttempts,
			&line.RushingYards, &line.RushingTDs,
			&line.QBSacks, &line.XPAttempts, &line.Drives,
			&line.Turnovers, &line.Punts); err != nil {
			return nil, err
		}
		if img != nil {
			p.Image = *img
		}
		// Attach the per-match rating for rateable positions with real activity.
		// "-" positions return nil (no implemented formula); UNRATED (no
		// qualifying activity) stays nil too — the client shows a dash or the
		// base rating respectively.
		if res := domain.RateByPosition(p.Position, line); res != nil {
			p.RatingStatus = res.Status
			if res.Status != domain.RatingStatusUnrated {
				rating := res.FinalRating
				p.Rating = &rating
			}
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
			COALESCE(m.round, ''), m.bracket_pos, m.feeds_match_id::text, COALESCE(m.feeds_slot, ''), m.pbp_locked,
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
		&m.Round, &m.BracketPos, &m.FeedsMatchID, &m.FeedsSlot, &m.PBPLocked,
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
