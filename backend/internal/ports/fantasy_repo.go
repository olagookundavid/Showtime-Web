package ports

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type IFantasyRepository interface {
	// Season
	CreateSeason(ctx context.Context, s *domain.FantasySeason) error
	GetActiveSeason(ctx context.Context) (*domain.FantasySeason, error)
	// ListSeasons returns every season regardless of status. Admin screens need
	// this: a season is created as DRAFT, so GetActiveSeason cannot see it and
	// there would be no way to reach the activate action.
	ListSeasons(ctx context.Context) ([]domain.FantasySeason, error)
	GetSeasonByID(ctx context.Context, id string) (*domain.FantasySeason, error)
	UpdateSeasonStatus(ctx context.Context, id string, status domain.FantasySeasonStatus) error

	// Gameweek
	CreateGameweek(ctx context.Context, gw *domain.FantasyGameweek) error
	GetGameweekByID(ctx context.Context, id string) (*domain.FantasyGameweek, error)
	GetCurrentGameweek(ctx context.Context, seasonID string) (*domain.FantasyGameweek, error)
	ListGameweeks(ctx context.Context, seasonID string) ([]domain.FantasyGameweek, error)
	UpdateGameweekStatus(ctx context.Context, id string, status domain.GameweekStatus) error
	UpdateGameweekDeadline(ctx context.Context, id string, deadline time.Time) error
	GetGameweeksDueForLock(ctx context.Context) ([]domain.FantasyGameweek, error)
	GetEventDayFirstKickoff(ctx context.Context, eventDayID string) (*time.Time, error)

	// Player Prices
	BulkUpsertPlayerPrices(ctx context.Context, prices []domain.FantasyPlayerPrice) error
	ListPlayerMarket(ctx context.Context, seasonID string, positions []string, gender, teamID, search, sortBy string, page, limit int) ([]dto.FantasyPlayerListItem, int, error)
	// GetSeasonRatingLines aggregates every rateable player's season-to-date
	// stat totals for a competition, so prices can be recomputed from ratings.
	GetSeasonRatingLines(ctx context.Context, competitionID string) ([]PlayerRatingLine, error)

	// Team Management
	GetOrCreateTeam(ctx context.Context, userID, seasonID, teamName string) (*domain.FantasyTeam, error)
	GetTeamByUserAndSeason(ctx context.Context, userID, seasonID string) (*domain.FantasyTeam, error)
	GetTeamByID(ctx context.Context, id string) (*domain.FantasyTeam, error)
	ListAllActiveTeamsInSeason(ctx context.Context, seasonID string) ([]domain.FantasyTeam, error)
	// RecalculateTeamTotalPoints rebuilds a team's season total from its locked
	// lineups. Idempotent by construction, so a gameweek can be re-scored.
	RecalculateTeamTotalPoints(ctx context.Context, teamID string) error
	RecalculateAllTeamTotalsInSeason(ctx context.Context, seasonID string) error

	// Lineup Operations & Rollover
	// GetLineupCandidates resolves the position/gender/club/price of each player
	// in one round trip, so validating a 14-man squad costs a single query.
	GetLineupCandidates(ctx context.Context, seasonID, gameweekID string, playerIDs []string) (map[string]domain.LineupCandidate, error)
	SaveLineupDraft(ctx context.Context, lineup *domain.FantasyLineup, picks []domain.FantasyLineupPick) error
	GetLineup(ctx context.Context, teamID, gameweekID string) (*domain.FantasyLineup, error)
	GetLockedLineupsForGameweek(ctx context.Context, gameweekID string) ([]domain.FantasyLineup, error)
	GetLatestPriorLockedLineup(ctx context.Context, teamID string, beforeGameweekNumber int) (*domain.FantasyLineup, error)
	CloneLineupToGameweek(ctx context.Context, srcLineup *domain.FantasyLineup, targetGameweekID string) error
	LockLineupsForGameweek(ctx context.Context, gameweekID string) error
	UpdateLineupPoints(ctx context.Context, lineupID string, points float64) error
	// UpdateLineupPickPoints writes each pick's own gameweek score in one
	// statement, keyed by player id within the lineup.
	UpdateLineupPickPoints(ctx context.Context, lineupID string, pointsByPlayer map[string]float64) error

	// Scoring & Breakdown
	GetPlayerStatsByEventDay(ctx context.Context, eventDayID string) ([]domain.PlayerStat, error)
	// Scoring writes one row per (team, player, match), so this is always a
	// bulk operation — there is deliberately no single-row variant to reach for.
	BulkUpsertGWPoints(ctx context.Context, pts []domain.FantasyGWPoints) error
}

// PlayerRatingLine pairs a player's rating category with their aggregated stat
// totals, ready to hand to domain.RateByPosition.
type PlayerRatingLine struct {
	PlayerID string
	Position string
	Line     domain.RatingStatLine
}

type FantasyRepository struct {
	pool *pgxpool.Pool
}

func NewFantasyRepository(pool *pgxpool.Pool) IFantasyRepository {
	return &FantasyRepository{pool: pool}
}

// ─── Season Methods ───────────────────────────────────────────────────────────

func (r *FantasyRepository) CreateSeason(ctx context.Context, s *domain.FantasySeason) error {
	query := `
		INSERT INTO fantasy_seasons (
			competition_id, name, squad_size, budget, min_female_offense,
			min_female_defense, max_per_club, lock_mins_before, status
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at, updated_at
	`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	return r.pool.QueryRow(ctx, query,
		s.CompetitionID, s.Name, s.SquadSize, s.Budget, s.MinFemaleOffense,
		s.MinFemaleDefense, s.MaxPerClub, s.LockMinsBefore, s.Status,
	).Scan(&s.ID, &s.CreatedAt, &s.UpdatedAt)
}

func (r *FantasyRepository) GetActiveSeason(ctx context.Context) (*domain.FantasySeason, error) {
	query := `
		SELECT id, competition_id, name, squad_size, budget, min_female_offense,
		       min_female_defense, max_per_club, lock_mins_before, status, created_at, updated_at
		FROM fantasy_seasons
		WHERE status = 'ACTIVE'
		ORDER BY created_at DESC
		LIMIT 1
	`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var s domain.FantasySeason
	err := r.pool.QueryRow(ctx, query).Scan(
		&s.ID, &s.CompetitionID, &s.Name, &s.SquadSize, &s.Budget,
		&s.MinFemaleOffense, &s.MinFemaleDefense, &s.MaxPerClub,
		&s.LockMinsBefore, &s.Status, &s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get active fantasy season: %w", err)
	}
	return &s, nil
}

func (r *FantasyRepository) ListSeasons(ctx context.Context) ([]domain.FantasySeason, error) {
	query := `
		SELECT id, competition_id, name, squad_size, budget, min_female_offense,
		       min_female_defense, max_per_club, lock_mins_before, status, created_at, updated_at
		FROM fantasy_seasons
		ORDER BY created_at DESC
	`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list fantasy seasons: %w", err)
	}
	defer rows.Close()

	var list []domain.FantasySeason
	for rows.Next() {
		var s domain.FantasySeason
		if err := rows.Scan(
			&s.ID, &s.CompetitionID, &s.Name, &s.SquadSize, &s.Budget,
			&s.MinFemaleOffense, &s.MinFemaleDefense, &s.MaxPerClub,
			&s.LockMinsBefore, &s.Status, &s.CreatedAt, &s.UpdatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, s)
	}
	return list, rows.Err()
}

func (r *FantasyRepository) GetSeasonByID(ctx context.Context, id string) (*domain.FantasySeason, error) {
	query := `
		SELECT id, competition_id, name, squad_size, budget, min_female_offense,
		       min_female_defense, max_per_club, lock_mins_before, status, created_at, updated_at
		FROM fantasy_seasons
		WHERE id = $1
	`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var s domain.FantasySeason
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&s.ID, &s.CompetitionID, &s.Name, &s.SquadSize, &s.Budget,
		&s.MinFemaleOffense, &s.MinFemaleDefense, &s.MaxPerClub,
		&s.LockMinsBefore, &s.Status, &s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get fantasy season: %w", err)
	}
	return &s, nil
}

func (r *FantasyRepository) UpdateSeasonStatus(ctx context.Context, id string, status domain.FantasySeasonStatus) error {
	query := `UPDATE fantasy_seasons SET status = $1, updated_at = NOW() WHERE id = $2`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	_, err := r.pool.Exec(ctx, query, status, id)
	return err
}

// ─── Gameweek Methods ─────────────────────────────────────────────────────────

func (r *FantasyRepository) CreateGameweek(ctx context.Context, gw *domain.FantasyGameweek) error {
	query := `
		INSERT INTO fantasy_gameweeks (season_id, number, event_day_id, deadline, status)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at
	`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	return r.pool.QueryRow(ctx, query,
		gw.SeasonID, gw.Number, gw.EventDayID, gw.Deadline, gw.Status,
	).Scan(&gw.ID, &gw.CreatedAt, &gw.UpdatedAt)
}

func (r *FantasyRepository) GetGameweekByID(ctx context.Context, id string) (*domain.FantasyGameweek, error) {
	query := `
		SELECT id, season_id, number, event_day_id, deadline, status, created_at, updated_at
		FROM fantasy_gameweeks
		WHERE id = $1
	`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var gw domain.FantasyGameweek
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&gw.ID, &gw.SeasonID, &gw.Number, &gw.EventDayID, &gw.Deadline, &gw.Status,
		&gw.CreatedAt, &gw.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get gameweek: %w", err)
	}
	return &gw, nil
}

func (r *FantasyRepository) GetCurrentGameweek(ctx context.Context, seasonID string) (*domain.FantasyGameweek, error) {
	// First look for scheduled or live gameweek closest to now
	query := `
		SELECT id, season_id, number, event_day_id, deadline, status, created_at, updated_at
		FROM fantasy_gameweeks
		WHERE season_id = $1 AND status IN ('SCHEDULED', 'LOCKED', 'LIVE')
		ORDER BY number ASC
		LIMIT 1
	`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var gw domain.FantasyGameweek
	err := r.pool.QueryRow(ctx, query, seasonID).Scan(
		&gw.ID, &gw.SeasonID, &gw.Number, &gw.EventDayID, &gw.Deadline, &gw.Status,
		&gw.CreatedAt, &gw.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// If none active, fallback to latest finalized
			fallback := `
				SELECT id, season_id, number, event_day_id, deadline, status, created_at, updated_at
				FROM fantasy_gameweeks
				WHERE season_id = $1
				ORDER BY number DESC
				LIMIT 1
			`
			err2 := r.pool.QueryRow(ctx, fallback, seasonID).Scan(
				&gw.ID, &gw.SeasonID, &gw.Number, &gw.EventDayID, &gw.Deadline, &gw.Status,
				&gw.CreatedAt, &gw.UpdatedAt,
			)
			if err2 != nil {
				return nil, nil
			}
			return &gw, nil
		}
		return nil, fmt.Errorf("failed to get current gameweek: %w", err)
	}
	return &gw, nil
}

func (r *FantasyRepository) ListGameweeks(ctx context.Context, seasonID string) ([]domain.FantasyGameweek, error) {
	query := `
		SELECT id, season_id, number, event_day_id, deadline, status, created_at, updated_at
		FROM fantasy_gameweeks
		WHERE season_id = $1
		ORDER BY number ASC
	`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	rows, err := r.pool.Query(ctx, query, seasonID)
	if err != nil {
		return nil, fmt.Errorf("failed to list gameweeks: %w", err)
	}
	defer rows.Close()

	var list []domain.FantasyGameweek
	for rows.Next() {
		var gw domain.FantasyGameweek
		if err := rows.Scan(
			&gw.ID, &gw.SeasonID, &gw.Number, &gw.EventDayID, &gw.Deadline, &gw.Status,
			&gw.CreatedAt, &gw.UpdatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, gw)
	}
	return list, nil
}

func (r *FantasyRepository) UpdateGameweekStatus(ctx context.Context, id string, status domain.GameweekStatus) error {
	query := `UPDATE fantasy_gameweeks SET status = $1, updated_at = NOW() WHERE id = $2`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	_, err := r.pool.Exec(ctx, query, status, id)
	return err
}

func (r *FantasyRepository) UpdateGameweekDeadline(ctx context.Context, id string, deadline time.Time) error {
	query := `UPDATE fantasy_gameweeks SET deadline = $1, updated_at = NOW() WHERE id = $2 AND status = 'SCHEDULED'`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	tag, err := r.pool.Exec(ctx, query, deadline, id)
	if err != nil {
		return fmt.Errorf("failed to update gameweek deadline: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return errors.New("gameweek not found, or already locked — its deadline can no longer be moved")
	}
	return nil
}

// GetEventDayFirstKickoff returns the earliest kickoff among the matches
// assigned to an event day, or nil when the day has no fixtures yet. Pool
// connections run at Africa/Lagos (see main_setup), so combining the match's
// DATE and TIME columns yields the correct absolute instant.
func (r *FantasyRepository) GetEventDayFirstKickoff(ctx context.Context, eventDayID string) (*time.Time, error) {
	query := `
		SELECT MIN(m.date + m.time)::timestamptz
		FROM matches m
		WHERE m.event_day_id = $1
	`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var kickoff *time.Time
	if err := r.pool.QueryRow(ctx, query, eventDayID).Scan(&kickoff); err != nil {
		return nil, fmt.Errorf("failed to resolve first kickoff for event day: %w", err)
	}
	return kickoff, nil
}

// GetGameweeksDueForLock returns gameweeks past their deadline that still need
// locking. Restricted to ACTIVE seasons so draft or completed seasons are never
// touched by the cron.
func (r *FantasyRepository) GetGameweeksDueForLock(ctx context.Context) ([]domain.FantasyGameweek, error) {
	query := `
		SELECT gw.id, gw.season_id, gw.number, gw.event_day_id, gw.deadline, gw.status, gw.created_at, gw.updated_at
		FROM fantasy_gameweeks gw
		JOIN fantasy_seasons s ON gw.season_id = s.id
		WHERE gw.status = 'SCHEDULED' AND gw.deadline <= NOW() AND s.status = 'ACTIVE'
		ORDER BY gw.deadline ASC
	`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query gameweeks due for lock: %w", err)
	}
	defer rows.Close()

	var list []domain.FantasyGameweek
	for rows.Next() {
		var gw domain.FantasyGameweek
		if err := rows.Scan(
			&gw.ID, &gw.SeasonID, &gw.Number, &gw.EventDayID, &gw.Deadline, &gw.Status,
			&gw.CreatedAt, &gw.UpdatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, gw)
	}
	return list, nil
}

// ─── Player Price Methods ─────────────────────────────────────────────────────

func (r *FantasyRepository) BulkUpsertPlayerPrices(ctx context.Context, prices []domain.FantasyPlayerPrice) error {
	if len(prices) == 0 {
		return nil
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for _, pp := range prices {
		if pp.GameweekID == nil {
			query := `
				INSERT INTO fantasy_player_prices (season_id, player_id, gameweek_id, base_price, rating, price)
				VALUES ($1, $2, NULL, $3, $4, $5)
				ON CONFLICT (season_id, player_id) WHERE gameweek_id IS NULL
				DO UPDATE SET base_price = EXCLUDED.base_price, rating = EXCLUDED.rating, price = EXCLUDED.price
			`
			if _, err := tx.Exec(ctx, query, pp.SeasonID, pp.PlayerID, pp.BasePrice, pp.Rating, pp.Price); err != nil {
				return err
			}
		} else {
			query := `
				INSERT INTO fantasy_player_prices (season_id, player_id, gameweek_id, base_price, rating, price)
				VALUES ($1, $2, $3, $4, $5, $6)
				ON CONFLICT (season_id, player_id, gameweek_id)
				DO UPDATE SET base_price = EXCLUDED.base_price, rating = EXCLUDED.rating, price = EXCLUDED.price
			`
			if _, err := tx.Exec(ctx, query, pp.SeasonID, pp.PlayerID, pp.GameweekID, pp.BasePrice, pp.Rating, pp.Price); err != nil {
				return err
			}
		}
	}
	return tx.Commit(ctx)
}

// ListPlayerMarket returns the selectable player pool. positions filters on the
// rating categories a slot accepts (a receiver slot passes both "Receiver" and
// "Center"); gender narrows to the gender-locked QB slots. Both filters run in
// SQL so a paged result can never hide an eligible player.
func (r *FantasyRepository) ListPlayerMarket(ctx context.Context, seasonID string, positions []string, gender, teamID, search, sortBy string, page, limit int) ([]dto.FantasyPlayerListItem, int, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}
	offset := (page - 1) * limit

	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	baseQuery := `
		FROM players p
		LEFT JOIN teams t ON p.team_id = t.id
		LEFT JOIN fantasy_player_prices fpp ON fpp.player_id = p.id AND fpp.season_id = $1 AND fpp.gameweek_id IS NULL
		LEFT JOIN (
			SELECT fgp.player_id, SUM(fgp.points) AS total_pts
			FROM fantasy_gw_points fgp
			JOIN fantasy_gameweeks fgw ON fgp.gameweek_id = fgw.id
			WHERE fgw.season_id = $1
			GROUP BY fgp.player_id
		) pts ON pts.player_id = p.id
		LEFT JOIN (
			SELECT flp.player_id, COUNT(DISTINCT fl.team_id) AS picked_by
			FROM fantasy_lineup_picks flp
			JOIN fantasy_lineups fl ON flp.lineup_id = fl.id
			JOIN fantasy_gameweeks fgw ON fl.gameweek_id = fgw.id
			WHERE fgw.season_id = $1
			GROUP BY flp.player_id
		) sel ON sel.player_id = p.id
		WHERE 1=1
	`
	args := []interface{}{seasonID}
	argIdx := 2

	if len(positions) > 0 {
		baseQuery += fmt.Sprintf(" AND p.position = ANY($%d)", argIdx)
		args = append(args, positions)
		argIdx++
	}
	if gender != "" {
		baseQuery += fmt.Sprintf(" AND COALESCE(p.gender, 'M') = $%d", argIdx)
		args = append(args, domain.NormalizeGender(gender))
		argIdx++
	}
	if teamID != "" {
		baseQuery += fmt.Sprintf(" AND p.team_id = $%d", argIdx)
		args = append(args, teamID)
		argIdx++
	}
	if search != "" {
		baseQuery += fmt.Sprintf(" AND p.name ILIKE $%d", argIdx)
		args = append(args, "%"+search+"%")
		argIdx++
	}

	var total int
	countQuery := "SELECT COUNT(p.id) " + baseQuery
	if err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count players: %w", err)
	}

	// Ownership percentage is over the season's fantasy teams, so it stays
	// meaningful regardless of how many gameweeks have been played.
	var squadCount int
	if err := r.pool.QueryRow(ctx, `SELECT COUNT(id) FROM fantasy_teams WHERE season_id = $1`, seasonID).Scan(&squadCount); err != nil {
		return nil, 0, fmt.Errorf("failed to count fantasy squads: %w", err)
	}

	orderClause := " ORDER BY COALESCE(fpp.price, 10.00) DESC, p.name ASC"
	switch sortBy {
	case "points":
		orderClause = " ORDER BY COALESCE(pts.total_pts, 0) DESC, p.name ASC"
	case "name":
		orderClause = " ORDER BY p.name ASC"
	case "selected":
		orderClause = " ORDER BY COALESCE(sel.picked_by, 0) DESC, p.name ASC"
	}

	selectQuery := `
		SELECT p.id, p.name, COALESCE(p.image, ''), p.position, COALESCE(p.gender, 'M'),
		       COALESCE(t.id::text, ''), COALESCE(t.name, ''), COALESCE(t.short_name, ''), COALESCE(t.logo, ''),
		       COALESCE(fpp.price, 10.00), COALESCE(fpp.rating, 5.00), COALESCE(pts.total_pts, 0.000),
		       COALESCE(sel.picked_by, 0)
	` + baseQuery + orderClause + fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, selectQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query player market: %w", err)
	}
	defer rows.Close()

	list := make([]dto.FantasyPlayerListItem, 0, limit)
	for rows.Next() {
		var item dto.FantasyPlayerListItem
		var pickedBy int
		if err := rows.Scan(
			&item.PlayerID, &item.PlayerName, &item.PlayerImage, &item.Position, &item.Gender,
			&item.TeamID, &item.TeamName, &item.TeamShortName, &item.TeamLogo,
			&item.Price, &item.Rating, &item.TotalPoints, &pickedBy,
		); err != nil {
			return nil, 0, err
		}
		if squadCount > 0 {
			item.SelectedByPct = (float64(pickedBy) / float64(squadCount)) * 100
		}
		list = append(list, item)
	}
	return list, total, rows.Err()
}

// GetSeasonRatingLines rolls every player's stats for a competition up into a
// single stat line each, which the rating engine turns into a 0-10 rating and
// the pricing formula turns into a market price.
func (r *FantasyRepository) GetSeasonRatingLines(ctx context.Context, competitionID string) ([]PlayerRatingLine, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	query := `
		SELECT p.id, p.position,
		       COALESCE(SUM(ps.receptions), 0), COALESCE(SUM(ps.receiving_tds), 0),
		       COALESCE(SUM(ps.extra_points_tds), 0), COALESCE(SUM(ps.drops), 0),
		       COALESCE(SUM(ps.flag_pulls), 0), COALESCE(SUM(ps.pass_deflections), 0),
		       COALESCE(SUM(ps.interceptions), 0), COALESCE(SUM(ps.defensive_tds), 0),
		       COALESCE(SUM(ps.safety), 0), COALESCE(SUM(ps.defensive_xp_tds), 0),
		       COALESCE(SUM(ps.def_sacks), 0), COALESCE(SUM(ps.passing_attempts), 0),
		       COALESCE(SUM(ps.completed_passes), 0), COALESCE(SUM(ps.passing_yards), 0),
		       COALESCE(SUM(ps.passing_tds), 0), COALESCE(SUM(ps.interceptions_thrown), 0),
		       COALESCE(SUM(ps.rushing_attempts), 0), COALESCE(SUM(ps.rushing_yards), 0),
		       COALESCE(SUM(ps.rushing_tds), 0), COALESCE(SUM(ps.qb_sacks), 0),
		       COALESCE(SUM(ps.xp_attempts), 0), COALESCE(SUM(ps.qb_drives), 0),
		       COALESCE(SUM(ps.qb_turnovers), 0), COALESCE(SUM(ps.qb_punts), 0),
		       COALESCE(SUM(ps.uncatchable_passes), 0), COALESCE(SUM(ps.thrown_away_passes), 0),
		       COALESCE(SUM(ps.batted_down_passes), 0)
		FROM players p
		LEFT JOIN player_stats ps ON ps.player_id = p.id AND ps.competition_id = $1
		GROUP BY p.id, p.position
	`
	rows, err := r.pool.Query(ctx, query, competitionID)
	if err != nil {
		return nil, fmt.Errorf("failed to aggregate season rating lines: %w", err)
	}
	defer rows.Close()

	var list []PlayerRatingLine
	for rows.Next() {
		var pr PlayerRatingLine
		l := &pr.Line
		if err := rows.Scan(
			&pr.PlayerID, &pr.Position,
			&l.Receptions, &l.ReceivingTDs, &l.ExtraPointTDs, &l.Drops,
			&l.FlagPulls, &l.PassDeflections, &l.Interceptions, &l.DefensiveTDs,
			&l.Safeties, &l.DefensiveXPTDs, &l.DefensiveSacks, &l.PassingAttempts,
			&l.CompletedPasses, &l.PassingYards, &l.PassingTDs, &l.InterceptionsThrown,
			&l.RushingAttempts, &l.RushingYards, &l.RushingTDs, &l.QBSacks,
			&l.XPAttempts, &l.Drives, &l.Turnovers, &l.Punts,
			&l.UncatchablePasses, &l.ThrownAwayPasses, &l.BattedDownPasses,
		); err != nil {
			return nil, err
		}
		list = append(list, pr)
	}
	return list, rows.Err()
}

// ─── Team Management ──────────────────────────────────────────────────────────

func (r *FantasyRepository) GetOrCreateTeam(ctx context.Context, userID, seasonID, teamName string) (*domain.FantasyTeam, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	query := `
		INSERT INTO fantasy_teams (user_id, season_id, name)
		VALUES ($1, $2, $3)
		ON CONFLICT (user_id, season_id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
		RETURNING id, user_id, season_id, name, total_points, created_at, updated_at
	`
	var t domain.FantasyTeam
	err := r.pool.QueryRow(ctx, query, userID, seasonID, teamName).Scan(
		&t.ID, &t.UserID, &t.SeasonID, &t.Name, &t.TotalPoints, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get or create fantasy team: %w", err)
	}
	return &t, nil
}

func (r *FantasyRepository) GetTeamByUserAndSeason(ctx context.Context, userID, seasonID string) (*domain.FantasyTeam, error) {
	query := `
		SELECT id, user_id, season_id, name, total_points, created_at, updated_at
		FROM fantasy_teams
		WHERE user_id = $1 AND season_id = $2
	`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var t domain.FantasyTeam
	err := r.pool.QueryRow(ctx, query, userID, seasonID).Scan(
		&t.ID, &t.UserID, &t.SeasonID, &t.Name, &t.TotalPoints, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get fantasy team: %w", err)
	}
	return &t, nil
}

func (r *FantasyRepository) GetTeamByID(ctx context.Context, id string) (*domain.FantasyTeam, error) {
	query := `
		SELECT id, user_id, season_id, name, total_points, created_at, updated_at
		FROM fantasy_teams
		WHERE id = $1
	`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var t domain.FantasyTeam
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&t.ID, &t.UserID, &t.SeasonID, &t.Name, &t.TotalPoints, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get team by id: %w", err)
	}
	return &t, nil
}

func (r *FantasyRepository) ListAllActiveTeamsInSeason(ctx context.Context, seasonID string) ([]domain.FantasyTeam, error) {
	query := `
		SELECT id, user_id, season_id, name, total_points, created_at, updated_at
		FROM fantasy_teams
		WHERE season_id = $1
		ORDER BY created_at ASC
	`
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	rows, err := r.pool.Query(ctx, query, seasonID)
	if err != nil {
		return nil, fmt.Errorf("failed to list active fantasy teams: %w", err)
	}
	defer rows.Close()

	var teams []domain.FantasyTeam
	for rows.Next() {
		var t domain.FantasyTeam
		if err := rows.Scan(
			&t.ID, &t.UserID, &t.SeasonID, &t.Name, &t.TotalPoints, &t.CreatedAt, &t.UpdatedAt,
		); err != nil {
			return nil, err
		}
		teams = append(teams, t)
	}
	return teams, nil
}

// RecalculateTeamTotalPoints rebuilds a team's season total as the sum of its
// locked lineups rather than incrementing it. Recomputing instead of
// accumulating is what makes re-scoring a gameweek safe — an incremental
// `total_points + delta` would double-count on every re-run, so a corrected
// stat could never be applied without corrupting the standings.
func (r *FantasyRepository) RecalculateTeamTotalPoints(ctx context.Context, teamID string) error {
	query := `
		UPDATE fantasy_teams ft
		SET total_points = COALESCE((
		        SELECT SUM(fl.points) FROM fantasy_lineups fl
		        WHERE fl.team_id = ft.id AND fl.status = 'LOCKED'
		    ), 0),
		    updated_at = NOW()
		WHERE ft.id = $1
	`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	_, err := r.pool.Exec(ctx, query, teamID)
	return err
}

// RecalculateAllTeamTotalsInSeason does the same for every team in a season in
// one statement, which is how scoring finalisation settles the standings.
func (r *FantasyRepository) RecalculateAllTeamTotalsInSeason(ctx context.Context, seasonID string) error {
	query := `
		UPDATE fantasy_teams ft
		SET total_points = COALESCE((
		        SELECT SUM(fl.points) FROM fantasy_lineups fl
		        WHERE fl.team_id = ft.id AND fl.status = 'LOCKED'
		    ), 0),
		    updated_at = NOW()
		WHERE ft.season_id = $1
	`
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	_, err := r.pool.Exec(ctx, query, seasonID)
	return err
}

// GetLineupCandidates loads everything lineup validation needs about a set of
// players — rating category, gender, club and the price in force for this
// gameweek — in a single query. Price falls back from the gameweek snapshot to
// the season's opening price to the 10.00 SC base.
func (r *FantasyRepository) GetLineupCandidates(ctx context.Context, seasonID, gameweekID string, playerIDs []string) (map[string]domain.LineupCandidate, error) {
	if len(playerIDs) == 0 {
		return map[string]domain.LineupCandidate{}, nil
	}

	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	query := `
		SELECT p.id, p.name, p.position, COALESCE(p.gender, 'M'), COALESCE(p.team_id::text, ''),
		       COALESCE(gwp.price, openp.price, 10.00)
		FROM players p
		LEFT JOIN fantasy_player_prices gwp
		       ON gwp.player_id = p.id AND gwp.season_id = $1 AND gwp.gameweek_id = $2
		LEFT JOIN fantasy_player_prices openp
		       ON openp.player_id = p.id AND openp.season_id = $1 AND openp.gameweek_id IS NULL
		WHERE p.id = ANY($3)
	`
	rows, err := r.pool.Query(ctx, query, seasonID, gameweekID, playerIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to load lineup candidates: %w", err)
	}
	defer rows.Close()

	out := make(map[string]domain.LineupCandidate, len(playerIDs))
	for rows.Next() {
		var c domain.LineupCandidate
		if err := rows.Scan(&c.PlayerID, &c.Name, &c.Position, &c.Gender, &c.TeamID, &c.Price); err != nil {
			return nil, err
		}
		out[c.PlayerID] = c
	}
	return out, rows.Err()
}

// ─── Lineup Operations & Rollover ─────────────────────────────────────────────

func (r *FantasyRepository) SaveLineupDraft(ctx context.Context, lineup *domain.FantasyLineup, picks []domain.FantasyLineupPick) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Upsert lineup
	lineupQuery := `
		INSERT INTO fantasy_lineups (team_id, gameweek_id, total_spent, points, status)
		VALUES ($1, $2, $3, 0.000, 'DRAFT')
		ON CONFLICT (team_id, gameweek_id) DO UPDATE
		SET total_spent = EXCLUDED.total_spent,
		    status = 'DRAFT',
		    updated_at = NOW()
		RETURNING id, created_at, updated_at
	`
	if err := tx.QueryRow(ctx, lineupQuery, lineup.TeamID, lineup.GameweekID, lineup.TotalSpent).
		Scan(&lineup.ID, &lineup.CreatedAt, &lineup.UpdatedAt); err != nil {
		return fmt.Errorf("failed to upsert lineup: %w", err)
	}

	// Delete existing picks for this lineup to replace with fresh draft
	if _, err := tx.Exec(ctx, `DELETE FROM fantasy_lineup_picks WHERE lineup_id = $1`, lineup.ID); err != nil {
		return fmt.Errorf("failed to clear old picks: %w", err)
	}

	// Insert new picks
	pickQuery := `
		INSERT INTO fantasy_lineup_picks (lineup_id, player_id, slot, purchase_price, points)
		VALUES ($1, $2, $3, $4, 0.000)
		RETURNING id, created_at
	`
	for i := range picks {
		picks[i].LineupID = lineup.ID
		if err := tx.QueryRow(ctx, pickQuery, lineup.ID, picks[i].PlayerID, picks[i].Slot, picks[i].PurchasePrice).
			Scan(&picks[i].ID, &picks[i].CreatedAt); err != nil {
			return fmt.Errorf("failed to insert lineup pick %s: %w", picks[i].Slot, err)
		}
	}

	return tx.Commit(ctx)
}

func (r *FantasyRepository) GetLineup(ctx context.Context, teamID, gameweekID string) (*domain.FantasyLineup, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	query := `
		SELECT id, team_id, gameweek_id, total_spent, points, status, locked_at, created_at, updated_at
		FROM fantasy_lineups
		WHERE team_id = $1 AND gameweek_id = $2
	`
	var l domain.FantasyLineup
	err := r.pool.QueryRow(ctx, query, teamID, gameweekID).Scan(
		&l.ID, &l.TeamID, &l.GameweekID, &l.TotalSpent, &l.Points, &l.Status,
		&l.LockedAt, &l.CreatedAt, &l.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get lineup: %w", err)
	}

	// Hydrate picks
	picksQuery := `
		SELECT flp.id, flp.lineup_id, flp.player_id, flp.slot, flp.purchase_price, flp.points, flp.created_at,
		       p.id, p.name, COALESCE(p.image, ''), p.position, COALESCE(p.gender, 'M'),
		       COALESCE(t.id::text, ''), COALESCE(t.name, ''), COALESCE(t.short_name, ''), COALESCE(t.logo, '')
		FROM fantasy_lineup_picks flp
		JOIN players p ON flp.player_id = p.id
		LEFT JOIN teams t ON p.team_id = t.id
		WHERE flp.lineup_id = $1
		ORDER BY flp.slot ASC
	`
	rows, err := r.pool.Query(ctx, picksQuery, l.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get lineup picks: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var pick domain.FantasyLineupPick
		var pl domain.Player
		var tm domain.Team
		if err := rows.Scan(
			&pick.ID, &pick.LineupID, &pick.PlayerID, &pick.Slot, &pick.PurchasePrice, &pick.Points, &pick.CreatedAt,
			&pl.ID, &pl.Name, &pl.Image, &pl.Position, &pl.Gender,
			&tm.ID, &tm.Name, &tm.ShortName, &tm.Logo,
		); err != nil {
			return nil, err
		}
		pl.Team = &tm
		pick.Player = &pl
		l.Picks = append(l.Picks, pick)
	}

	return &l, nil
}

func (r *FantasyRepository) GetLatestPriorLockedLineup(ctx context.Context, teamID string, beforeGameweekNumber int) (*domain.FantasyLineup, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	query := `
		SELECT fl.id, fl.team_id, fl.gameweek_id, fl.total_spent, fl.points, fl.status, fl.locked_at, fl.created_at, fl.updated_at
		FROM fantasy_lineups fl
		JOIN fantasy_gameweeks fgw ON fl.gameweek_id = fgw.id
		WHERE fl.team_id = $1 AND fgw.number < $2 AND fl.status = 'LOCKED'
		ORDER BY fgw.number DESC
		LIMIT 1
	`
	var l domain.FantasyLineup
	err := r.pool.QueryRow(ctx, query, teamID, beforeGameweekNumber).Scan(
		&l.ID, &l.TeamID, &l.GameweekID, &l.TotalSpent, &l.Points, &l.Status,
		&l.LockedAt, &l.CreatedAt, &l.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	// Fetch picks
	picksQuery := `
		SELECT id, lineup_id, player_id, slot, purchase_price, points, created_at
		FROM fantasy_lineup_picks
		WHERE lineup_id = $1
	`
	rows, err := r.pool.Query(ctx, picksQuery, l.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var pick domain.FantasyLineupPick
		if err := rows.Scan(&pick.ID, &pick.LineupID, &pick.PlayerID, &pick.Slot, &pick.PurchasePrice, &pick.Points, &pick.CreatedAt); err != nil {
			return nil, err
		}
		l.Picks = append(l.Picks, pick)
	}
	return &l, nil
}

// CloneLineupToGameweek carries a squad forward for a manager who didn't submit
// one. Picks keep the price they were originally bought at rather than being
// repriced at the current market: a rolled-over squad is one the manager took
// no action on, so rising prices must not be able to push it over budget behind
// their back. (The implementation plan says "current market prices" here — this
// is a deliberate departure, for that reason.)
func (r *FantasyRepository) CloneLineupToGameweek(ctx context.Context, srcLineup *domain.FantasyLineup, targetGameweekID string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Insert cloned locked lineup
	var newLineupID string
	lineupQuery := `
		INSERT INTO fantasy_lineups (team_id, gameweek_id, total_spent, points, status, locked_at)
		VALUES ($1, $2, $3, 0.000, 'LOCKED', NOW())
		ON CONFLICT (team_id, gameweek_id) DO UPDATE
		SET status = 'LOCKED', locked_at = NOW(), updated_at = NOW()
		RETURNING id
	`
	if err := tx.QueryRow(ctx, lineupQuery, srcLineup.TeamID, targetGameweekID, srcLineup.TotalSpent).Scan(&newLineupID); err != nil {
		return fmt.Errorf("failed to clone lineup row: %w", err)
	}

	// Clear any draft picks if existing
	if _, err := tx.Exec(ctx, `DELETE FROM fantasy_lineup_picks WHERE lineup_id = $1`, newLineupID); err != nil {
		return err
	}

	// Clone picks
	insertPick := `
		INSERT INTO fantasy_lineup_picks (lineup_id, player_id, slot, purchase_price, points)
		VALUES ($1, $2, $3, $4, 0.000)
	`
	for _, p := range srcLineup.Picks {
		if _, err := tx.Exec(ctx, insertPick, newLineupID, p.PlayerID, p.Slot, p.PurchasePrice); err != nil {
			return fmt.Errorf("failed to clone pick %s: %w", p.Slot, err)
		}
	}

	return tx.Commit(ctx)
}

func (r *FantasyRepository) LockLineupsForGameweek(ctx context.Context, gameweekID string) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	query := `
		UPDATE fantasy_lineups
		SET status = 'LOCKED', locked_at = NOW(), updated_at = NOW()
		WHERE gameweek_id = $1 AND status = 'DRAFT'
	`
	_, err := r.pool.Exec(ctx, query, gameweekID)
	return err
}

func (r *FantasyRepository) UpdateLineupPoints(ctx context.Context, lineupID string, points float64) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	query := `
		UPDATE fantasy_lineups
		SET points = $1, updated_at = NOW()
		WHERE id = $2
	`
	_, err := r.pool.Exec(ctx, query, points, lineupID)
	return err
}

// UpdateLineupPickPoints writes the per-player gameweek score onto each pick in
// one statement. Without this the picks' points column stays at its 0.000
// default forever and the squad view can only ever show zeroes.
func (r *FantasyRepository) UpdateLineupPickPoints(ctx context.Context, lineupID string, pointsByPlayer map[string]float64) error {
	if len(pointsByPlayer) == 0 {
		return nil
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	playerIDs := make([]string, 0, len(pointsByPlayer))
	points := make([]float64, 0, len(pointsByPlayer))
	for id, pts := range pointsByPlayer {
		playerIDs = append(playerIDs, id)
		points = append(points, pts)
	}

	query := `
		UPDATE fantasy_lineup_picks flp
		SET points = v.points
		FROM (SELECT UNNEST($2::uuid[]) AS player_id, UNNEST($3::numeric[]) AS points) v
		WHERE flp.lineup_id = $1 AND flp.player_id = v.player_id
	`
	if _, err := r.pool.Exec(ctx, query, lineupID, playerIDs, points); err != nil {
		return fmt.Errorf("failed to update lineup pick points: %w", err)
	}
	return nil
}

// GetLockedLineupsForGameweek loads every locked lineup for a gameweek with its
// picks attached, using two queries rather than one per team — scoring a
// gameweek otherwise degrades linearly with the number of managers.
func (r *FantasyRepository) GetLockedLineupsForGameweek(ctx context.Context, gameweekID string) ([]domain.FantasyLineup, error) {
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	lineupQuery := `
		SELECT id, team_id, gameweek_id, total_spent, points, status, locked_at, created_at, updated_at
		FROM fantasy_lineups
		WHERE gameweek_id = $1 AND status = 'LOCKED'
		ORDER BY created_at ASC
	`
	rows, err := r.pool.Query(ctx, lineupQuery, gameweekID)
	if err != nil {
		return nil, fmt.Errorf("failed to list locked lineups: %w", err)
	}
	defer rows.Close()

	var lineups []domain.FantasyLineup
	byID := make(map[string]int)
	for rows.Next() {
		var l domain.FantasyLineup
		if err := rows.Scan(
			&l.ID, &l.TeamID, &l.GameweekID, &l.TotalSpent, &l.Points, &l.Status,
			&l.LockedAt, &l.CreatedAt, &l.UpdatedAt,
		); err != nil {
			return nil, err
		}
		byID[l.ID] = len(lineups)
		lineups = append(lineups, l)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(lineups) == 0 {
		return lineups, nil
	}

	picksQuery := `
		SELECT flp.id, flp.lineup_id, flp.player_id, flp.slot, flp.purchase_price, flp.points, flp.created_at
		FROM fantasy_lineup_picks flp
		JOIN fantasy_lineups fl ON flp.lineup_id = fl.id
		WHERE fl.gameweek_id = $1 AND fl.status = 'LOCKED'
	`
	pickRows, err := r.pool.Query(ctx, picksQuery, gameweekID)
	if err != nil {
		return nil, fmt.Errorf("failed to list locked lineup picks: %w", err)
	}
	defer pickRows.Close()

	for pickRows.Next() {
		var p domain.FantasyLineupPick
		if err := pickRows.Scan(&p.ID, &p.LineupID, &p.PlayerID, &p.Slot, &p.PurchasePrice, &p.Points, &p.CreatedAt); err != nil {
			return nil, err
		}
		if idx, ok := byID[p.LineupID]; ok {
			lineups[idx].Picks = append(lineups[idx].Picks, p)
		}
	}
	return lineups, pickRows.Err()
}

// ─── Scoring & Breakdown ──────────────────────────────────────────────────────

// BulkUpsertGWPoints writes a whole gameweek's points log in batched round
// trips. Scoring produces one row per (team, player, match), so a large league
// generates tens of thousands of rows — issuing them one statement at a time
// makes finalisation take minutes and risks timing out mid-way.
func (r *FantasyRepository) BulkUpsertGWPoints(ctx context.Context, pts []domain.FantasyGWPoints) error {
	if len(pts) == 0 {
		return nil
	}
	ctx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	const query = `
		INSERT INTO fantasy_gw_points (team_id, gameweek_id, player_id, match_id, points, breakdown)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (team_id, gameweek_id, player_id, match_id) DO UPDATE
		SET points = EXCLUDED.points,
		    breakdown = EXCLUDED.breakdown
	`

	const chunkSize = 500
	for start := 0; start < len(pts); start += chunkSize {
		end := start + chunkSize
		if end > len(pts) {
			end = len(pts)
		}

		batch := &pgx.Batch{}
		for _, p := range pts[start:end] {
			breakdownJSON, err := json.Marshal(p.Breakdown)
			if err != nil {
				return fmt.Errorf("failed to marshal points breakdown: %w", err)
			}
			batch.Queue(query, p.TeamID, p.GameweekID, p.PlayerID, p.MatchID, p.Points, breakdownJSON)
		}

		results := tx.SendBatch(ctx, batch)
		for i := start; i < end; i++ {
			if _, err := results.Exec(); err != nil {
				results.Close()
				return fmt.Errorf("failed to upsert gameweek points: %w", err)
			}
		}
		if err := results.Close(); err != nil {
			return fmt.Errorf("failed to flush gameweek points batch: %w", err)
		}
	}

	return tx.Commit(ctx)
}

// GetPlayerStatsByEventDay returns every stat line recorded on an event day,
// resolved through the canonical matches.event_day_id foreign key rather than
// by comparing calendar dates. The inner join to matches also drops stat rows
// with a NULL match_id (the column is nullable), which would otherwise fail to
// scan into MatchID and abort scoring for the entire gameweek.
func (r *FantasyRepository) GetPlayerStatsByEventDay(ctx context.Context, eventDayID string) ([]domain.PlayerStat, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	query := `
		SELECT ps.id, ps.player_id, ps.team_id, ps.match_id, ps.competition_id, ps.match_date,
		       ps.passing_attempts, ps.rushing_attempts, ps.completed_passes, ps.incomplete_passes,
		       ps.uncatchable_passes, ps.thrown_away_passes, ps.batted_down_passes, ps.targets,
		       ps.passing_yards, ps.rushing_yards, ps.receiving_yards, ps.passing_tds, ps.rushing_tds,
		       ps.interceptions_thrown, ps.receptions, ps.receiving_tds, ps.extra_points_tds,
		       ps.xp_attempts, ps.xp_good, ps.xp_fail, ps.drops, ps.flag_pulls, ps.pass_deflections,
		       ps.interceptions, ps.defensive_tds, ps.safety, ps.safety_conceded, ps.qb_sacks,
		       ps.def_sacks, ps.defensive_xp_tds, ps.qb_drives, ps.qb_turnovers, ps.qb_punts,
		       ps.snaps, ps.bad_snaps, ps.created_at, ps.updated_at
		FROM player_stats ps
		JOIN matches m ON ps.match_id = m.id
		WHERE m.event_day_id = $1
	`
	rows, err := r.pool.Query(ctx, query, eventDayID)
	if err != nil {
		return nil, fmt.Errorf("failed to query player stats by event day: %w", err)
	}
	defer rows.Close()

	var list []domain.PlayerStat
	for rows.Next() {
		var s domain.PlayerStat
		if err := rows.Scan(
			&s.ID, &s.PlayerID, &s.TeamID, &s.MatchID, &s.CompetitionID, &s.MatchDate,
			&s.PassingAttempts, &s.RushingAttempts, &s.CompletedPasses, &s.IncompletePasses,
			&s.UncatchablePasses, &s.ThrownAwayPasses, &s.BattedDownPasses, &s.Targets,
			&s.PassingYards, &s.RushingYards, &s.ReceivingYards, &s.PassingTDs, &s.RushingTDs,
			&s.InterceptionsThrown, &s.Receptions, &s.ReceivingTDs, &s.ExtraPointsTDs,
			&s.XPAttempts, &s.XPGood, &s.XPFail, &s.Drops, &s.FlagPulls, &s.PassDeflections,
			&s.Interceptions, &s.DefensiveTDs, &s.Safety, &s.SafetyConceded, &s.QBSacks,
			&s.DefSacks, &s.DefensiveXPTDs, &s.QBDrives, &s.QBTurnovers, &s.QBPunts,
			&s.Snaps, &s.BadSnaps, &s.CreatedAt, &s.UpdatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, s)
	}
	return list, nil
}
