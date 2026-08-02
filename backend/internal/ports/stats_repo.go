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
	UpsertTeamMatchStat(ctx context.Context, stat *domain.TeamMatchStat) error
	GetPlayerStats(ctx context.Context, filter domain.StatsFilter) ([]domain.AggregatedPlayerStat, int, error)
	GetTeamStats(ctx context.Context, filter domain.StatsFilter) ([]domain.AggregatedTeamStat, int, error)
	GetStatDates(ctx context.Context, competitionID string) ([]string, error)
}

func (r *PostgresStatsRepository) UpsertTeamMatchStat(ctx context.Context, s *domain.TeamMatchStat) error {
	query := `
		INSERT INTO team_match_stats (
			team_id, match_id, competition_id, match_date,
			punts, first_downs, turnovers, penalties, penalty_yards, total_plays
		) VALUES ($1, NULLIF($2,'')::uuid, NULLIF($3,'')::uuid, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (team_id, match_id) DO UPDATE SET
			competition_id = EXCLUDED.competition_id,
			match_date = EXCLUDED.match_date,
			punts = EXCLUDED.punts,
			first_downs = EXCLUDED.first_downs,
			turnovers = EXCLUDED.turnovers,
			penalties = EXCLUDED.penalties,
			penalty_yards = EXCLUDED.penalty_yards,
			total_plays = EXCLUDED.total_plays,
			updated_at = NOW()`
	_, err := r.db.Exec(ctx, query,
		s.TeamID, s.MatchID, s.CompetitionID, s.MatchDate,
		s.Punts, s.FirstDowns, s.Turnovers, s.Penalties, s.PenaltyYards, s.TotalPlays)
	return err
}

// buildTeamOnlyWhereClause mirrors buildStatsWhereClause for the team_match_stats
// table (competition / match / date filters only — no player or search filters).
func buildTeamOnlyWhereClause(filter domain.StatsFilter) (string, []interface{}) {
	var conditions []string
	var args []interface{}
	argCount := 1
	if filter.CompetitionID != "" {
		conditions = append(conditions, fmt.Sprintf("tms.competition_id = $%d", argCount))
		args = append(args, filter.CompetitionID)
		argCount++
		if filter.EventDay != nil {
			conditions = append(conditions, fmt.Sprintf("tms.match_date = $%d", argCount))
			args = append(args, filter.EventDay)
			argCount++
		}
	} else if filter.MatchID != "" {
		conditions = append(conditions, fmt.Sprintf("tms.match_id = $%d", argCount))
		args = append(args, filter.MatchID)
		argCount++
	}
	where := ""
	if len(conditions) > 0 {
		where = "WHERE " + strings.Join(conditions, " AND ")
	}
	return where, args
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
			passing_yards, rushing_yards, receiving_yards,
			passing_tds, rushing_tds, interceptions_thrown,
			receptions, receiving_tds, extra_points_tds, drops,
			flag_pulls, pass_deflections, interceptions,
			defensive_tds, safety, qb_sacks, def_sacks, defensive_xp_tds,
			incomplete_passes, uncatchable_passes, thrown_away_passes,
			batted_down_passes, targets, xp_attempts, xp_good, xp_fail, safety_conceded
		) VALUES (
			$1, NULLIF($2, '')::uuid, NULLIF($3, '')::uuid, $4, $5,
			$6, $7, $8, $9, $10,
			$11, $12, $13, $14, $15,
			$16, $17, $18, $19, $20,
			$21, $22, $23, $24, $25, $26,
			$27, $28, $29, $30, $31, $32, $33, $34, $35
		)
		ON CONFLICT (player_id, match_id) DO UPDATE SET
			match_id = COALESCE(EXCLUDED.match_id, player_stats.match_id),
			passing_attempts = EXCLUDED.passing_attempts,
			rushing_attempts = EXCLUDED.rushing_attempts,
			completed_passes = EXCLUDED.completed_passes,
			passing_yards = EXCLUDED.passing_yards,
			rushing_yards = EXCLUDED.rushing_yards,
			receiving_yards = EXCLUDED.receiving_yards,
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
			incomplete_passes = EXCLUDED.incomplete_passes,
			uncatchable_passes = EXCLUDED.uncatchable_passes,
			thrown_away_passes = EXCLUDED.thrown_away_passes,
			batted_down_passes = EXCLUDED.batted_down_passes,
			targets = EXCLUDED.targets,
			xp_attempts = EXCLUDED.xp_attempts,
			xp_good = EXCLUDED.xp_good,
			xp_fail = EXCLUDED.xp_fail,
			safety_conceded = EXCLUDED.safety_conceded,
			updated_at = NOW()
	`

	_, err := r.db.Exec(ctx, query,
		stat.PlayerID, stat.TeamID, stat.MatchID, stat.CompetitionID, stat.MatchDate,
		stat.PassingAttempts, stat.RushingAttempts, stat.CompletedPasses,
		stat.PassingYards, stat.RushingYards, stat.ReceivingYards,
		stat.PassingTDs, stat.RushingTDs, stat.InterceptionsThrown,
		stat.Receptions, stat.ReceivingTDs, stat.ExtraPointsTDs, stat.Drops,
		stat.FlagPulls, stat.PassDeflections, stat.Interceptions,
		stat.DefensiveTDs, stat.Safety, stat.QBSacks, stat.DefSacks,
		stat.DefensiveXPTDs,
		stat.IncompletePasses, stat.UncatchablePasses, stat.ThrownAwayPasses,
		stat.BattedDownPasses, stat.Targets, stat.XPAttempts, stat.XPGood, stat.XPFail, stat.SafetyConceded,
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
	"passing_yards":        "SUM(COALESCE(ps.passing_yards, 0))",
	"rushing_yards":        "SUM(COALESCE(ps.rushing_yards, 0))",
	"receiving_yards":      "SUM(COALESCE(ps.receiving_yards, 0))",
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
	"incomplete_passes":    "SUM(ps.incomplete_passes)",
	"uncatchable_passes":   "SUM(ps.uncatchable_passes)",
	"thrown_away_passes":   "SUM(ps.thrown_away_passes)",
	"batted_down_passes":   "SUM(ps.batted_down_passes)",
	"targets":              "SUM(ps.targets)",
	"xp_attempts":          "SUM(ps.xp_attempts)",
	"xp_good":              "SUM(ps.xp_good)",
	"xp_fail":              "SUM(ps.xp_fail)",
	"safety_conceded":      "SUM(ps.safety_conceded)",
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
			SUM(COALESCE(ps.passing_yards, 0)) AS passing_yards,
			SUM(COALESCE(ps.rushing_yards, 0)) AS rushing_yards,
			SUM(COALESCE(ps.receiving_yards, 0)) AS receiving_yards,
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
			COALESCE(SUM(ps.defensive_xp_tds), 0) AS defensive_xp_tds,
			SUM(ps.incomplete_passes) AS incomplete_passes,
			SUM(ps.uncatchable_passes) AS uncatchable_passes,
			SUM(ps.thrown_away_passes) AS thrown_away_passes,
			SUM(ps.batted_down_passes) AS batted_down_passes,
			SUM(ps.targets) AS targets,
			SUM(ps.xp_attempts) AS xp_attempts,
			SUM(ps.xp_good) AS xp_good,
			SUM(ps.xp_fail) AS xp_fail,
			SUM(ps.safety_conceded) AS safety_conceded
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
			&s.PassingYards, &s.RushingYards, &s.ReceivingYards,
			&s.PassingTDs, &s.RushingTDs, &s.InterceptionsThrown,
			&s.Receptions, &s.ReceivingTDs, &s.ExtraPointsTDs, &s.Drops,
			&s.FlagPulls, &s.PassDeflections, &s.Interceptions,
			&s.DefensiveTDs, &s.Safety, &s.QBSacks, &s.DefSacks,
			&s.DefensiveXPTDs,
			&s.IncompletePasses, &s.UncatchablePasses, &s.ThrownAwayPasses,
			&s.BattedDownPasses, &s.Targets, &s.XPAttempts, &s.XPGood, &s.XPFail, &s.SafetyConceded,
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
			SUM(COALESCE(ps.passing_yards, 0)) AS passing_yards,
			SUM(COALESCE(ps.rushing_yards, 0)) AS rushing_yards,
			SUM(COALESCE(ps.receiving_yards, 0)) AS receiving_yards,
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
			COALESCE(SUM(ps.defensive_xp_tds), 0) AS defensive_xp_tds,
			SUM(ps.incomplete_passes) AS incomplete_passes,
			SUM(ps.uncatchable_passes) AS uncatchable_passes,
			SUM(ps.thrown_away_passes) AS thrown_away_passes,
			SUM(ps.batted_down_passes) AS batted_down_passes,
			SUM(ps.targets) AS targets,
			SUM(ps.xp_attempts) AS xp_attempts,
			SUM(ps.xp_good) AS xp_good,
			SUM(ps.xp_fail) AS xp_fail,
			SUM(ps.safety_conceded) AS safety_conceded
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
			&s.PassingYards, &s.RushingYards, &s.ReceivingYards,
			&s.PassingTDs, &s.RushingTDs, &s.InterceptionsThrown,
			&s.Receptions, &s.ReceivingTDs, &s.ExtraPointsTDs, &s.Drops,
			&s.FlagPulls, &s.PassDeflections, &s.Interceptions,
			&s.DefensiveTDs, &s.Safety, &s.QBSacks, &s.DefSacks,
			&s.DefensiveXPTDs,
			&s.IncompletePasses, &s.UncatchablePasses, &s.ThrownAwayPasses,
			&s.BattedDownPasses, &s.Targets, &s.XPAttempts, &s.XPGood, &s.XPFail, &s.SafetyConceded,
		)
		if err != nil {
			return nil, 0, err
		}
		stats = append(stats, s)
	}

	// Merge in the team-only stats (punts / first downs / turnovers / penalties /
	// penalty yards / total plays) from team_match_stats, keyed by team.
	if len(stats) > 0 {
		tmsWhere, tmsArgs := buildTeamOnlyWhereClause(filter)
		tmsQuery := fmt.Sprintf(`
			SELECT tms.team_id,
				COALESCE(SUM(tms.punts), 0), COALESCE(SUM(tms.first_downs), 0),
				COALESCE(SUM(tms.turnovers), 0), COALESCE(SUM(tms.penalties), 0),
				COALESCE(SUM(tms.penalty_yards), 0), COALESCE(SUM(tms.total_plays), 0)
			FROM team_match_stats tms
			%s
			GROUP BY tms.team_id`, tmsWhere)
		if trows, terr := r.db.Query(ctx, tmsQuery, tmsArgs...); terr == nil {
			teamOnly := map[string][6]int{}
			for trows.Next() {
				var id string
				var v [6]int
				if err := trows.Scan(&id, &v[0], &v[1], &v[2], &v[3], &v[4], &v[5]); err == nil {
					teamOnly[id] = v
				}
			}
			trows.Close()
			for i := range stats {
				if v, ok := teamOnly[stats[i].TeamID]; ok {
					stats[i].Punts, stats[i].FirstDowns, stats[i].Turnovers = v[0], v[1], v[2]
					stats[i].Penalties, stats[i].PenaltyYards, stats[i].TotalPlays = v[3], v[4], v[5]
				}
			}
		}
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
