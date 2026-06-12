package ports

import (
	"context"
	"fmt"
	"showtime-backend/internal/domain"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

type StatsRepository interface {
	UpsertPlayerStat(ctx context.Context, stat *domain.PlayerStat) error
	GetPlayerStats(ctx context.Context, filter domain.StatsFilter) ([]domain.AggregatedPlayerStat, int, error)
	GetTeamStats(ctx context.Context, filter domain.StatsFilter) ([]domain.AggregatedTeamStat, int, error)
	GetStatDates(ctx context.Context, competitionID string) ([]string, error)
}

type PostgresStatsRepository struct {
	db *pgxpool.Pool
}

func NewStatsRepository(db *pgxpool.Pool) *PostgresStatsRepository {
	return &PostgresStatsRepository{db: db}
}

func (r *PostgresStatsRepository) UpsertPlayerStat(ctx context.Context, stat *domain.PlayerStat) error {
	query := `
		INSERT INTO player_stats (
			player_id, team_id, match_id, competition_id, match_date,
			passing_attempts, rushing_attempts, completed_passes,
			passing_tds, rushing_tds, interceptions_thrown,
			receptions, receiving_tds, extra_points_tds, drops,
			flag_pulls, pass_deflections, interceptions,
			defensive_tds, safety, qb_sacks, def_sacks, defensive_xp_tds
		) VALUES (
			$1, NULLIF($2, '')::uuid, NULLIF($3, '')::uuid, $4, $5,
			$6, $7, $8, $9, $10,
			$11, $12, $13, $14, $15,
			$16, $17, $18, $19, $20,
			$21, $22, $23
		)
		ON CONFLICT (player_id, match_id) DO UPDATE SET
			match_id = COALESCE(EXCLUDED.match_id, player_stats.match_id),
			passing_attempts = EXCLUDED.passing_attempts,
			rushing_attempts = EXCLUDED.rushing_attempts,
			completed_passes = EXCLUDED.completed_passes,
			passing_tds = EXCLUDED.passing_tds,
			rushing_tds = EXCLUDED.rushing_tds,
			interceptions_thrown = EXCLUDED.interceptions_thrown,
			receptions = EXCLUDED.receptions,
			receiving_tds = EXCLUDED.receiving_tds,
			extra_points_tds = EXCLUDED.extra_points_tds,
			drops = EXCLUDED.drops,
			flag_pulls = EXCLUDED.flag_pulls,
			pass_deflections = EXCLUDED.pass_deflections,
			interceptions = EXCLUDED.interceptions,
			defensive_tds = EXCLUDED.defensive_tds,
			safety = EXCLUDED.safety,
			qb_sacks = EXCLUDED.qb_sacks,
			def_sacks = EXCLUDED.def_sacks,
			defensive_xp_tds = EXCLUDED.defensive_xp_tds,
			updated_at = NOW()
	`

	_, err := r.db.Exec(ctx, query,
		stat.PlayerID, stat.TeamID, stat.MatchID, stat.CompetitionID, stat.MatchDate,
		stat.PassingAttempts, stat.RushingAttempts, stat.CompletedPasses,
		stat.PassingTDs, stat.RushingTDs, stat.InterceptionsThrown,
		stat.Receptions, stat.ReceivingTDs, stat.ExtraPointsTDs, stat.Drops,
		stat.FlagPulls, stat.PassDeflections, stat.Interceptions,
		stat.DefensiveTDs, stat.Safety, stat.QBSacks, stat.DefSacks,
		stat.DefensiveXPTDs,
	)
	return err
}

func buildStatsWhereClause(filter domain.StatsFilter) (string, []interface{}) {
	var conditions []string
	var args []interface{}
	argCount := 1

	if filter.CompetitionID != "" {
		conditions = append(conditions, fmt.Sprintf("ps.competition_id = $%d", argCount))
		args = append(args, filter.CompetitionID)
		argCount++

		if filter.EventDay != nil {
			conditions = append(conditions, fmt.Sprintf("ps.match_date = $%d", argCount))
			args = append(args, filter.EventDay)
			argCount++
		}
	} else if filter.MatchID != "" {
		conditions = append(conditions, fmt.Sprintf("ps.match_id = $%d", argCount))
		args = append(args, filter.MatchID)
		argCount++
	}
	// No competition/match filter means all-time. The site carries multiple
	// historical seasons, so a hidden year-to-date default would silently drop
	// every season before the current calendar year from "All Competitions"
	// views and from player career totals.

	if filter.PlayerID != "" {
		conditions = append(conditions, fmt.Sprintf("ps.player_id = $%d", argCount))
		args = append(args, filter.PlayerID)
		argCount++
	}

	if filter.SearchQuery != "" {
		conditions = append(conditions, fmt.Sprintf("p.name ILIKE $%d", argCount))
		args = append(args, "%"+filter.SearchQuery+"%")
		argCount++
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = "WHERE " + strings.Join(conditions, " AND ")
	}

	return whereClause, args
}

// statsSortColumns whitelists the sortable stat keys. Values are the exact
// aggregate expressions used in the SELECT, so ORDER BY stays injection-safe:
// anything not in this map falls back to alphabetical name order.
var statsSortColumns = map[string]string{
	"passing_attempts":     "SUM(ps.passing_attempts)",
	"completed_passes":     "SUM(ps.completed_passes)",
	"passing_tds":          "SUM(ps.passing_tds)",
	"interceptions_thrown": "SUM(ps.interceptions_thrown)",
	"qb_sacks":             "SUM(ps.qb_sacks)",
	"rushing_attempts":     "SUM(ps.rushing_attempts)",
	"rushing_tds":          "SUM(ps.rushing_tds)",
	"receptions":           "SUM(ps.receptions)",
	"receiving_tds":        "SUM(ps.receiving_tds)",
	"drops":                "SUM(ps.drops)",
	"extra_points_tds":     "SUM(ps.extra_points_tds)",
	"flag_pulls":           "SUM(ps.flag_pulls)",
	"pass_deflections":     "SUM(ps.pass_deflections)",
	"interceptions":        "SUM(ps.interceptions)",
	"def_sacks":            "SUM(ps.def_sacks)",
	"defensive_tds":        "SUM(ps.defensive_tds)",
	"defensive_xp_tds":     "SUM(ps.defensive_xp_tds)",
	"safety":               "SUM(ps.safety)",
}

// statsOrderClause ranks by the requested stat (highest first, name as
// tiebreak) or alphabetically when no valid sort key is given. nameExpr is
// p.name for player stats, t.name for team stats. allowApps admits the
// player-only "apps" key.
func statsOrderClause(sortBy, nameExpr string, allowApps bool) string {
	if allowApps && sortBy == "apps" {
		return fmt.Sprintf("ORDER BY COUNT(ps.match_date) DESC, %s ASC", nameExpr)
	}
	if expr, ok := statsSortColumns[sortBy]; ok {
		return fmt.Sprintf("ORDER BY %s DESC, %s ASC", expr, nameExpr)
	}
	return fmt.Sprintf("ORDER BY %s ASC", nameExpr)
}

func (r *PostgresStatsRepository) GetPlayerStats(ctx context.Context, filter domain.StatsFilter) ([]domain.AggregatedPlayerStat, int, error) {
	whereClause, args := buildStatsWhereClause(filter)

	// Get total count. Must mirror the result query's GROUP BY
	// (player_id, team_id): a player whose stats span two teams produces two
	// result rows, so counting distinct player_id alone would undercount.
	countQuery := fmt.Sprintf(`
		SELECT COUNT(DISTINCT (ps.player_id, ps.team_id))
		FROM player_stats ps
		JOIN players p ON ps.player_id = p.id
		JOIN teams t ON ps.team_id = t.id
		%s
	`, whereClause)

	var total int
	err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Pagination logic
	limitOffset := ""
	if filter.Limit > 0 {
		limitOffset = fmt.Sprintf(" LIMIT %d OFFSET %d", filter.Limit, (filter.Page-1)*filter.Limit)
	}

	query := fmt.Sprintf(`
		SELECT
			ps.player_id,
			p.name AS player_name,
			COALESCE(p.image, '') AS player_image,
			COALESCE(p.jersey_number, 0) AS player_jersey_number,
			COALESCE(p.position, '') AS player_position,
			ps.team_id,
			t.name AS team_name,
			COALESCE(t.short_name, '') AS team_short_name,
			COALESCE(t.logo, '') AS team_logo,
			COUNT(ps.match_date) AS apps,
			SUM(ps.passing_attempts) AS passing_attempts,
			SUM(ps.rushing_attempts) AS rushing_attempts,
			SUM(ps.completed_passes) AS completed_passes,
			SUM(ps.passing_tds) AS passing_tds,
			SUM(ps.rushing_tds) AS rushing_tds,
			SUM(ps.interceptions_thrown) AS interceptions_thrown,
			SUM(ps.receptions) AS receptions,
			SUM(ps.receiving_tds) AS receiving_tds,
			SUM(ps.extra_points_tds) AS extra_points_tds,
			SUM(ps.drops) AS drops,
			SUM(ps.flag_pulls) AS flag_pulls,
			SUM(ps.pass_deflections) AS pass_deflections,
			SUM(ps.interceptions) AS interceptions,
			SUM(ps.defensive_tds) AS defensive_tds,
			SUM(ps.safety) AS safety,
			SUM(ps.qb_sacks) AS qb_sacks,
			SUM(ps.def_sacks) AS def_sacks,
			COALESCE(SUM(ps.defensive_xp_tds), 0) AS defensive_xp_tds
		FROM player_stats ps
		JOIN players p ON ps.player_id = p.id
		JOIN teams t ON ps.team_id = t.id
		%s
		GROUP BY
			ps.player_id, p.name, p.image, p.jersey_number, p.position,
			ps.team_id, t.name, t.short_name, t.logo
		%s
		%s
	`, whereClause, statsOrderClause(filter.SortBy, "p.name", true), limitOffset)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var stats []domain.AggregatedPlayerStat
	for rows.Next() {
		var s domain.AggregatedPlayerStat
		err := rows.Scan(
			&s.PlayerID, &s.PlayerName, &s.PlayerImage, &s.PlayerJerseyNumber, &s.PlayerPosition,
			&s.TeamID, &s.TeamName, &s.TeamShortName, &s.TeamLogo,
			&s.Apps, &s.PassingAttempts, &s.RushingAttempts, &s.CompletedPasses,
			&s.PassingTDs, &s.RushingTDs, &s.InterceptionsThrown,
			&s.Receptions, &s.ReceivingTDs, &s.ExtraPointsTDs, &s.Drops,
			&s.FlagPulls, &s.PassDeflections, &s.Interceptions,
			&s.DefensiveTDs, &s.Safety, &s.QBSacks, &s.DefSacks,
			&s.DefensiveXPTDs,
		)
		if err != nil {
			return nil, 0, err
		}
		stats = append(stats, s)
	}
	return stats, total, nil
}

func (r *PostgresStatsRepository) GetTeamStats(ctx context.Context, filter domain.StatsFilter) ([]domain.AggregatedTeamStat, int, error) {
	whereClause, args := buildStatsWhereClause(filter)

	// Get total count
	countQuery := fmt.Sprintf(`
		SELECT COUNT(DISTINCT ps.team_id)
		FROM player_stats ps
		JOIN teams t ON ps.team_id = t.id
		%s
	`, whereClause)

	var total int
	err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	// Pagination logic
	limitOffset := ""
	if filter.Limit > 0 {
		limitOffset = fmt.Sprintf(" LIMIT %d OFFSET %d", filter.Limit, (filter.Page-1)*filter.Limit)
	}

	query := fmt.Sprintf(`
		SELECT
			ps.team_id,
			t.name AS team_name,
			COALESCE(t.short_name, '') AS team_short_name,
			COALESCE(t.logo, '') AS team_logo,
			SUM(ps.passing_attempts) AS passing_attempts,
			SUM(ps.rushing_attempts) AS rushing_attempts,
			SUM(ps.completed_passes) AS completed_passes,
			SUM(ps.passing_tds) AS passing_tds,
			SUM(ps.rushing_tds) AS rushing_tds,
			SUM(ps.interceptions_thrown) AS interceptions_thrown,
			SUM(ps.receptions) AS receptions,
			SUM(ps.receiving_tds) AS receiving_tds,
			SUM(ps.extra_points_tds) AS extra_points_tds,
			SUM(ps.drops) AS drops,
			SUM(ps.flag_pulls) AS flag_pulls,
			SUM(ps.pass_deflections) AS pass_deflections,
			SUM(ps.interceptions) AS interceptions,
			SUM(ps.defensive_tds) AS defensive_tds,
			SUM(ps.safety) AS safety,
			SUM(ps.qb_sacks) AS qb_sacks,
			SUM(ps.def_sacks) AS def_sacks,
			COALESCE(SUM(ps.defensive_xp_tds), 0) AS defensive_xp_tds
		FROM player_stats ps
		JOIN teams t ON ps.team_id = t.id
		%s
		GROUP BY
			ps.team_id, t.name, t.short_name, t.logo
		%s
		%s
	`, whereClause, statsOrderClause(filter.SortBy, "t.name", false), limitOffset)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var stats []domain.AggregatedTeamStat
	for rows.Next() {
		var s domain.AggregatedTeamStat
		err := rows.Scan(
			&s.TeamID, &s.TeamName, &s.TeamShortName, &s.TeamLogo,
			&s.PassingAttempts, &s.RushingAttempts, &s.CompletedPasses,
			&s.PassingTDs, &s.RushingTDs, &s.InterceptionsThrown,
			&s.Receptions, &s.ReceivingTDs, &s.ExtraPointsTDs, &s.Drops,
			&s.FlagPulls, &s.PassDeflections, &s.Interceptions,
			&s.DefensiveTDs, &s.Safety, &s.QBSacks, &s.DefSacks,
			&s.DefensiveXPTDs,
		)
		if err != nil {
			return nil, 0, err
		}
		stats = append(stats, s)
	}

	return stats, total, nil
}

func (r *PostgresStatsRepository) GetStatDates(ctx context.Context, competitionID string) ([]string, error) {
	var query string
	var args []interface{}

	if competitionID != "" {
		query = `SELECT DISTINCT TO_CHAR(match_date, 'YYYY-MM-DD') FROM player_stats WHERE competition_id = $1 ORDER BY 1 DESC`
		args = append(args, competitionID)
	} else {
		query = `SELECT DISTINCT TO_CHAR(match_date, 'YYYY-MM-DD') FROM player_stats ORDER BY 1 DESC`
	}

	rows, err := r.db.Query(ctx, query, args...)
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
