package ports

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ImportMatchRow is the repo-level row: side has been resolved to a concrete team_id.
type ImportMatchRow struct {
	TeamID              string
	PlayerName          string
	JerseyNumber        int
	Position            string
	PassingAttempts     int
	RushingAttempts     int
	CompletedPasses     int
	PassingTDs          int
	RushingTDs          int
	InterceptionsThrown int
	Receptions          int
	ReceivingTDs        int
	ExtraPointsTDs      int
	Drops               int
	FlagPulls           int
	PassDeflections     int
	Interceptions       int
	DefensiveTDs        int
	Safety              int
	QBSacks             int
	DefSacks            int
	DefensiveXPTDs      int
}

type ImportMatchParams struct {
	MatchID       string
	HomeTeamID    string
	AwayTeamID    string
	CompetitionID string
	MatchDate     time.Time
	Rows          []ImportMatchRow
}

type ImportedPlayer struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	TeamID       string `json:"team_id"`
	JerseyNumber int    `json:"jersey_number"`
	Position     string `json:"position"`
}

type ImportMatchResult struct {
	PlayersCreated int              `json:"players_created"`
	PlayersMatched int              `json:"players_matched"`
	SheetRows      int              `json:"sheet_rows"`
	StatRows       int              `json:"stat_rows"`
	CreatedPlayers []ImportedPlayer `json:"created_players,omitempty"`
}

type ImportRepository interface {
	ImportMatchData(ctx context.Context, params ImportMatchParams) (ImportMatchResult, error)
}

type PostgresImportRepository struct {
	db *pgxpool.Pool
}

func NewImportRepository(db *pgxpool.Pool) *PostgresImportRepository {
	return &PostgresImportRepository{db: db}
}

// ImportMatchData runs the full import inside one transaction:
//  1. Find-or-create each unique (lower(name), team_id) player.
//  2. Wipe existing match_team_sheets rows for this match.
//  3. Multi-row INSERT new team-sheet entries.
//  4. Multi-row INSERT player_stats with ON CONFLICT (player_id, match_id) DO UPDATE.
//
// If anything fails, the whole import is rolled back.
func (r *PostgresImportRepository) ImportMatchData(ctx context.Context, params ImportMatchParams) (ImportMatchResult, error) {
	var result ImportMatchResult

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return result, err
	}
	defer tx.Rollback(ctx)

	type key struct {
		name   string
		teamID string
	}
	resolved := make(map[key]string, len(params.Rows))

	for i := range params.Rows {
		row := &params.Rows[i]
		normName := strings.ToLower(strings.TrimSpace(row.PlayerName))
		k := key{name: normName, teamID: row.TeamID}
		if _, ok := resolved[k]; ok {
			continue
		}

		var playerID string
		err := tx.QueryRow(ctx,
			`SELECT id FROM players WHERE LOWER(TRIM(name)) = $1 AND team_id = $2 LIMIT 1`,
			normName, row.TeamID,
		).Scan(&playerID)

		switch {
		case errors.Is(err, pgx.ErrNoRows):
			err = tx.QueryRow(ctx,
				`INSERT INTO players (name, jersey_number, position, team_id, email)
				 VALUES ($1, $2, $3, $4, '')
				 RETURNING id`,
				strings.TrimSpace(row.PlayerName), row.JerseyNumber, row.Position, row.TeamID,
			).Scan(&playerID)
			if err != nil {
				return result, fmt.Errorf("row %d: failed to create player %q: %w", i+1, row.PlayerName, err)
			}
			result.PlayersCreated++
			result.CreatedPlayers = append(result.CreatedPlayers, ImportedPlayer{
				ID:           playerID,
				Name:         strings.TrimSpace(row.PlayerName),
				TeamID:       row.TeamID,
				JerseyNumber: row.JerseyNumber,
				Position:     row.Position,
			})
		case err != nil:
			return result, fmt.Errorf("row %d: lookup failed for %q: %w", i+1, row.PlayerName, err)
		default:
			result.PlayersMatched++
		}
		resolved[k] = playerID
	}

	if _, err := tx.Exec(ctx, `DELETE FROM match_team_sheets WHERE match_id = $1`, params.MatchID); err != nil {
		return result, fmt.Errorf("failed to wipe team sheets: %w", err)
	}

	sheetSeen := make(map[string]struct{}, len(params.Rows))
	sheetArgs := []any{params.MatchID}
	sheetPH := make([]string, 0, len(params.Rows))
	for i := range params.Rows {
		row := &params.Rows[i]
		normName := strings.ToLower(strings.TrimSpace(row.PlayerName))
		playerID := resolved[key{name: normName, teamID: row.TeamID}]
		if _, ok := sheetSeen[playerID]; ok {
			continue
		}
		sheetSeen[playerID] = struct{}{}
		sheetArgs = append(sheetArgs, row.TeamID, playerID)
		n := len(sheetArgs)
		sheetPH = append(sheetPH, fmt.Sprintf("($1, $%d, $%d)", n-1, n))
	}
	if len(sheetPH) > 0 {
		q := `INSERT INTO match_team_sheets (match_id, team_id, player_id) VALUES ` + strings.Join(sheetPH, ", ")
		if _, err := tx.Exec(ctx, q, sheetArgs...); err != nil {
			return result, fmt.Errorf("failed to insert team sheet rows: %w", err)
		}
		result.SheetRows = len(sheetPH)
	}

	// Aggregate stats per player (CSV may have multiple rows per player; we sum).
	type statRow struct {
		teamID              string
		passingAttempts     int
		rushingAttempts     int
		completedPasses     int
		passingTDs          int
		rushingTDs          int
		interceptionsThrown int
		receptions          int
		receivingTDs        int
		extraPointsTDs      int
		drops               int
		flagPulls           int
		passDeflections     int
		interceptions       int
		defensiveTDs        int
		safety              int
		qbSacks             int
		defSacks            int
		defensiveXPTDs      int
	}
	statAgg := make(map[string]*statRow, len(params.Rows))
	for i := range params.Rows {
		row := &params.Rows[i]
		normName := strings.ToLower(strings.TrimSpace(row.PlayerName))
		playerID := resolved[key{name: normName, teamID: row.TeamID}]
		s, ok := statAgg[playerID]
		if !ok {
			s = &statRow{teamID: row.TeamID}
			statAgg[playerID] = s
		}
		s.passingAttempts += row.PassingAttempts
		s.rushingAttempts += row.RushingAttempts
		s.completedPasses += row.CompletedPasses
		s.passingTDs += row.PassingTDs
		s.rushingTDs += row.RushingTDs
		s.interceptionsThrown += row.InterceptionsThrown
		s.receptions += row.Receptions
		s.receivingTDs += row.ReceivingTDs
		s.extraPointsTDs += row.ExtraPointsTDs
		s.drops += row.Drops
		s.flagPulls += row.FlagPulls
		s.passDeflections += row.PassDeflections
		s.interceptions += row.Interceptions
		s.defensiveTDs += row.DefensiveTDs
		s.safety += row.Safety
		s.qbSacks += row.QBSacks
		s.defSacks += row.DefSacks
		s.defensiveXPTDs += row.DefensiveXPTDs
	}

	if len(statAgg) > 0 {
		// Shared placeholders: $1 = competition_id, $2 = match_id, $3 = match_date.
		statArgs := []any{params.CompetitionID, params.MatchID, params.MatchDate}
		statPH := make([]string, 0, len(statAgg))
		for playerID, s := range statAgg {
			base := len(statArgs) + 1
			statArgs = append(statArgs,
				playerID, s.teamID,
				s.passingAttempts, s.rushingAttempts, s.completedPasses,
				s.passingTDs, s.rushingTDs, s.interceptionsThrown,
				s.receptions, s.receivingTDs, s.extraPointsTDs, s.drops,
				s.flagPulls, s.passDeflections, s.interceptions,
				s.defensiveTDs, s.safety, s.qbSacks, s.defSacks,
				s.defensiveXPTDs,
			)
			statPH = append(statPH, fmt.Sprintf(
				"($%d, $%d, $2, $1, $3, $%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d, $%d)",
				base, base+1,
				base+2, base+3, base+4, base+5, base+6, base+7,
				base+8, base+9, base+10, base+11, base+12, base+13,
				base+14, base+15, base+16, base+17, base+18, base+19,
			))
		}

		q := `INSERT INTO player_stats (
			player_id, team_id, match_id, competition_id, match_date,
			passing_attempts, rushing_attempts, completed_passes,
			passing_tds, rushing_tds, interceptions_thrown,
			receptions, receiving_tds, extra_points_tds, drops,
			flag_pulls, pass_deflections, interceptions,
			defensive_tds, safety, qb_sacks, def_sacks, defensive_xp_tds
		) VALUES ` + strings.Join(statPH, ", ") + `
		ON CONFLICT (player_id, match_id) DO UPDATE SET
			team_id = EXCLUDED.team_id,
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
			updated_at = NOW()`
		if _, err := tx.Exec(ctx, q, statArgs...); err != nil {
			return result, fmt.Errorf("failed to upsert player stats: %w", err)
		}
		result.StatRows = len(statAgg)
	}

	if err := tx.Commit(ctx); err != nil {
		return result, err
	}
	return result, nil
}
