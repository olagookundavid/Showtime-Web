package ports

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
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
	ListSeasons(ctx context.Context, page, limit int) ([]domain.FantasySeason, int, error)
	GetSeasonByID(ctx context.Context, id string) (*domain.FantasySeason, error)
	UpdateSeasonStatus(ctx context.Context, id string, status domain.FantasySeasonStatus) error
	// DeleteSeason removes a season that was never launched. Refuses anything
	// but a DRAFT, and anything managers have already entered.
	DeleteSeason(ctx context.Context, id string) error

	// Gameweek
	CreateGameweek(ctx context.Context, gw *domain.FantasyGameweek) error
	GetGameweekByID(ctx context.Context, id string) (*domain.FantasyGameweek, error)
	DeleteGameweek(ctx context.Context, id string) error
	GetCurrentGameweek(ctx context.Context, seasonID string) (*domain.FantasyGameweek, error)
	ListGameweeks(ctx context.Context, seasonID string) ([]domain.FantasyGameweek, error)
	UpdateGameweekStatus(ctx context.Context, id string, status domain.GameweekStatus) error
	UpdateGameweekDeadline(ctx context.Context, id string, deadline time.Time) error
	GetGameweeksDueForLock(ctx context.Context) ([]domain.FantasyGameweek, error)
	GetGameweeksDueForFinalize(ctx context.Context) ([]domain.FantasyGameweek, error)
	GetEventDayFirstKickoff(ctx context.Context, eventDayID string) (*time.Time, error)
	EnsureEventDayForMatchDate(ctx context.Context, competitionID, matchDate string, gwNumber int) (string, *time.Time, error)
	GetScheduledMatchDays(ctx context.Context, competitionID string) ([]dto.ScheduledMatchDayDTO, error)
	// ListScheduledGameweeks returns a season's gameweeks with the date of the
	// event day each is bound to, which is what the scheduler plans against.
	ListScheduledGameweeks(ctx context.Context, seasonID string) ([]domain.ScheduledGameweek, error)
	// ApplyGameweekPlan writes a whole plan in one transaction, so a season is
	// never left half-rescheduled. It also links every fixture on each day to
	// that day's event day.
	ApplyGameweekPlan(ctx context.Context, seasonID, competitionID string, plan domain.SchedulePlan) error
	// SeasonIDsForCompetition lists the fantasy seasons that follow a
	// competition's fixtures, so a fixture change knows what to resync.
	SeasonIDsForCompetition(ctx context.Context, competitionID string) ([]string, error)
	// LinkFixturesToEventDays points every fixture at the event day for its own
	// date. Runs whether or not the gameweeks themselves changed.
	LinkFixturesToEventDays(ctx context.Context, competitionID string) error

	// Player Prices
	BulkUpsertPlayerPrices(ctx context.Context, prices []domain.FantasyPlayerPrice) error
	GetOverriddenPrices(ctx context.Context, seasonID string) (map[string]float64, error)
	ListPlayerPricesForAdmin(ctx context.Context, seasonID string, search, position, teamID, overrideStatus string, page, limit int) ([]dto.AdminPlayerPriceItem, int, error)
	OverridePlayerPrice(ctx context.Context, seasonID, playerID string, price *float64, reset bool) (*dto.AdminPlayerPriceItem, error)
	ListPlayerMarket(ctx context.Context, seasonID string, positions []string, gender, teamID, search, sortBy string, page, limit int) ([]dto.FantasyPlayerListItem, int, error)
	// GetSeasonRatingLines aggregates every rateable player's season-to-date
	// stat totals for a competition, so prices can be recomputed from ratings.
	GetSeasonRatingLines(ctx context.Context, competitionID string) ([]PlayerRatingLine, error)
	// GetSeasonPricingLines aggregates what pricing reads: games played and the
	// season's scoring totals. Separate from the rating lines because a price
	// answers a different question from a rating — what a manager is buying,
	// rather than how well someone played.
	GetSeasonPricingLines(ctx context.Context, seasonID, competitionID string) ([]PlayerPricingLine, error)

	// Team Management
	GetOrCreateTeam(ctx context.Context, userID, seasonID, teamName string) (*domain.FantasyTeam, error)
	GetTeamByUserAndSeason(ctx context.Context, userID, seasonID string) (*domain.FantasyTeam, error)
	GetTeamByID(ctx context.Context, id string) (*domain.FantasyTeam, error)
	ListAllActiveTeamsInSeason(ctx context.Context, seasonID string) ([]domain.FantasyTeam, error)
	// GetTeamOverallRank returns the team's position among every manager in the
	// season, and how many managers there are.
	GetTeamOverallRank(ctx context.Context, seasonID, teamID string) (int, int, error)
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

	// Analytics
	GetGameweekAnalytics(ctx context.Context, seasonID, gameweekID string) (*dto.GameweekReportResponse, error)
}

// PlayerRatingLine pairs a player's rating category with their aggregated stat
// totals, ready to hand to domain.RateByPosition.
type PlayerRatingLine struct {
	PlayerID string
	Position string
	Line     domain.RatingStatLine
}

// PlayerPricingLine is one player's season as the pricing model sees them.
type PlayerPricingLine struct {
	PlayerID string
	Position string
	Games    int
	// Totals are the season sums of every stat that scores, so fantasy points
	// can be computed with the same weights the game itself uses.
	Totals domain.PlayerStat
	// PreviousPrice is the last published price, so movement can be capped.
	PreviousPrice float64
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

func (r *FantasyRepository) ListSeasons(ctx context.Context, page, limit int) ([]domain.FantasySeason, int, error) {
	page, limit, offset := paging(page, limit, 25)

	query := `
		SELECT id, competition_id, name, squad_size, budget, min_female_offense,
		       min_female_defense, max_per_club, lock_mins_before, status, created_at, updated_at
		FROM fantasy_seasons
		ORDER BY created_at DESC, id ASC
		LIMIT $1 OFFSET $2
	`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var total int
	if err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM fantasy_seasons`).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count fantasy seasons: %w", err)
	}

	rows, err := r.pool.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list fantasy seasons: %w", err)
	}
	defer rows.Close()

	list := make([]domain.FantasySeason, 0)
	for rows.Next() {
		var s domain.FantasySeason
		if err := rows.Scan(
			&s.ID, &s.CompetitionID, &s.Name, &s.SquadSize, &s.Budget,
			&s.MinFemaleOffense, &s.MinFemaleDefense, &s.MaxPerClub,
			&s.LockMinsBefore, &s.Status, &s.CreatedAt, &s.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		list = append(list, s)
	}
	return list, total, rows.Err()
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

// DeleteSeason discards an unlaunched season. Deleting cascades to gameweeks,
// leagues and prices, so it is deliberately restricted: only a DRAFT with no
// squads entered can go, which makes it safe for clearing up seasons created
// by mistake without ever being able to erase a live competition.
func (r *FantasyRepository) DeleteSeason(ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var status domain.FantasySeasonStatus
	if err := tx.QueryRow(ctx,
		`SELECT status FROM fantasy_seasons WHERE id = $1 FOR UPDATE`, id,
	).Scan(&status); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return errors.New("season not found")
		}
		return err
	}
	if status != domain.FantasySeasonDraft {
		return fmt.Errorf("only a draft season can be deleted — this one is %s", status)
	}

	var teamCount int
	if err := tx.QueryRow(ctx,
		`SELECT COUNT(*) FROM fantasy_teams WHERE season_id = $1`, id,
	).Scan(&teamCount); err != nil {
		return err
	}
	if teamCount > 0 {
		return fmt.Errorf("this season already has %d squad(s) entered and cannot be deleted", teamCount)
	}

	if _, err := tx.Exec(ctx, `DELETE FROM fantasy_seasons WHERE id = $1`, id); err != nil {
		return fmt.Errorf("failed to delete season: %w", err)
	}
	return tx.Commit(ctx)
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

	list := make([]domain.FantasyGameweek, 0)
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

func (r *FantasyRepository) DeleteGameweek(ctx context.Context, id string) error {
	// status <> 'FINALIZED' is re-checked here rather than trusted from the
	// service's earlier read, so a gameweek that gets finalized by the
	// auto-finalize cron in the gap between that read and this exec can never
	// be deleted out from under its just-computed scores.
	query := `DELETE FROM fantasy_gameweeks WHERE id = $1::uuid AND status <> 'FINALIZED'`
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tag, err := r.pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete gameweek: %w", err)
	}
	if tag.RowsAffected() == 0 {
		var exists bool
		if err := r.pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM fantasy_gameweeks WHERE id = $1::uuid)`, id).Scan(&exists); err == nil && exists {
			return errors.New("cannot delete a finalized gameweek")
		}
		return errors.New("gameweek not found")
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

// EnsureEventDayForMatchDate finds or creates an event_days record for a scheduled match date,
// links all matches on that date to the event day, and returns the event day ID and earliest kickoff.
func (r *FantasyRepository) EnsureEventDayForMatchDate(ctx context.Context, competitionID, matchDate string, gwNumber int) (string, *time.Time, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	var eventDayID string
	err := r.pool.QueryRow(ctx, `SELECT id::text FROM event_days WHERE date = $1::date`, matchDate).Scan(&eventDayID)
	if err != nil {
		title := fmt.Sprintf("Gameweek %d (%s)", gwNumber, matchDate)
		err = r.pool.QueryRow(ctx, `
			INSERT INTO event_days (id, title, date, venue, is_active, created_at, updated_at)
			VALUES (gen_random_uuid(), $1, $2::date, 'Showtime Arena', true, NOW(), NOW())
			ON CONFLICT (date) DO UPDATE SET title = EXCLUDED.title
			RETURNING id::text
		`, title, matchDate).Scan(&eventDayID)
		if err != nil {
			return "", nil, fmt.Errorf("failed to ensure event day for match date: %w", err)
		}
	}

	// Link matches for this competition and date to the event day
	_, _ = r.pool.Exec(ctx, `
		UPDATE matches 
		SET event_day_id = $1::uuid 
		WHERE competition_id = $2::uuid AND date = $3::date AND (event_day_id IS NULL OR event_day_id <> $1::uuid)
	`, eventDayID, competitionID, matchDate)

	// Find earliest kickoff
	var kickoff *time.Time
	_ = r.pool.QueryRow(ctx, `
		SELECT MIN(m.date + COALESCE(m.time, '10:00:00'::time))::timestamptz
		FROM matches m
		WHERE m.competition_id = $1::uuid AND m.date = $2::date
	`, competitionID, matchDate).Scan(&kickoff)

	return eventDayID, kickoff, nil
}

// GetScheduledMatchDays returns all distinct match dates for a competition with fixture counts.
func (r *FantasyRepository) GetScheduledMatchDays(ctx context.Context, competitionID string) ([]dto.ScheduledMatchDayDTO, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	// POSTPONED fixtures are excluded: a match that is not going to be played on
	// the day cannot be scored on it, and counting it would keep a gameweek
	// alive on a date with nothing left to happen. A day where *every* fixture
	// is postponed therefore drops out entirely, which is what lets the sync
	// remove its gameweek.
	query := `
		SELECT
			m.date::text AS match_date,
			COUNT(*) AS match_count,
			-- Returned as a timestamptz, not ::text. pgx scans it straight into a
			-- time.Time; rendering it to a string here produced Postgres's own
			-- format, which is not RFC3339 and silently failed to parse back.
			COALESCE(MIN(m.date + COALESCE(m.time, '10:00:00'::time))::timestamptz, (m.date + TIME '10:00:00')::timestamptz) AS earliest_kickoff,
			COALESCE(ed.id::text, '') AS event_day_id
		FROM matches m
		LEFT JOIN event_days ed ON ed.date = m.date
		WHERE m.competition_id = $1::uuid
		  AND COALESCE(m.status, 'SCHEDULED') <> 'POSTPONED'
		GROUP BY m.date, ed.id
		ORDER BY m.date ASC
	`
	rows, err := r.pool.Query(ctx, query, competitionID)
	if err != nil {
		return nil, fmt.Errorf("failed to query scheduled match days: %w", err)
	}
	defer rows.Close()

	var days []dto.ScheduledMatchDayDTO
	for rows.Next() {
		var d dto.ScheduledMatchDayDTO
		var kickoff *time.Time
		if err := rows.Scan(&d.Date, &d.MatchCount, &kickoff, &d.EventDayID); err != nil {
			return nil, err
		}
		if kickoff != nil {
			d.KickoffAt = kickoff
			d.EarliestKickoff = kickoff.Format(time.RFC3339)
		}
		days = append(days, d)
	}
	return days, rows.Err()
}

// GetGameweeksDueForLock returns gameweeks past their deadline that still need
// locking. Restricted to ACTIVE seasons so draft or completed seasons are never
// touched by the cron.
func (r *FantasyRepository) GetGameweeksDueForLock(ctx context.Context) ([]domain.FantasyGameweek, error) {
	// Only a gameweek with something to play locks.
	//
	// Locking used to depend on the deadline alone, so a gameweek sitting on a
	// date with no fixtures — left behind when the calendar moved — locked
	// itself the moment its deadline passed and then stayed LOCKED forever,
	// unscoreable and undeletable. A gameweek with nothing on it is not a
	// match day; it waits, and the next sync clears it away.
	query := `
		SELECT gw.id, gw.season_id, gw.number, gw.event_day_id, gw.deadline, gw.status, gw.created_at, gw.updated_at
		FROM fantasy_gameweeks gw
		JOIN fantasy_seasons s ON gw.season_id = s.id
		JOIN event_days ed ON ed.id = gw.event_day_id
		WHERE gw.status = 'SCHEDULED' AND gw.deadline <= NOW() AND s.status = 'ACTIVE'
		  AND EXISTS (
		      SELECT 1 FROM matches m
		      WHERE m.competition_id = s.competition_id
		        AND m.date = ed.date
		        AND COALESCE(m.status, 'SCHEDULED') <> 'POSTPONED'
		  )
		ORDER BY gw.deadline ASC
	`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query gameweeks due for lock: %w", err)
	}
	defer rows.Close()

	list := make([]domain.FantasyGameweek, 0)
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

// GetGameweeksDueForFinalize returns gameweeks eligible for automatic finalization
// and scoring. A gameweek is eligible when:
//  1. It is currently in 'LOCKED' or 'LIVE' status.
//  2. Its lock deadline has passed.
//  3. It belongs to an ACTIVE fantasy season.
//  4. All scheduled matches for its game day are finished (or postponed), with at
//     least one finished match.
//  5. Safety guard: player stats have actually been recorded for those matches,
//     ensuring we do not finalize empty stat sheets prematurely.
func (r *FantasyRepository) GetGameweeksDueForFinalize(ctx context.Context) ([]domain.FantasyGameweek, error) {
	query := `
		SELECT gw.id, gw.season_id, gw.number, gw.event_day_id, gw.deadline, gw.status, gw.created_at, gw.updated_at
		FROM fantasy_gameweeks gw
		JOIN fantasy_seasons s ON gw.season_id = s.id
		JOIN event_days ed ON gw.event_day_id = ed.id
		WHERE gw.status IN ('LOCKED', 'LIVE')
		  AND gw.deadline <= NOW()
		  AND s.status = 'ACTIVE'
		  AND EXISTS (
		      SELECT 1
		      FROM matches m
		      WHERE (m.event_day_id = gw.event_day_id OR (m.competition_id = s.competition_id AND m.date = ed.date))
		      HAVING COUNT(m.id) FILTER (WHERE m.status = 'FINISHED') > 0
		         AND COUNT(m.id) FILTER (WHERE m.status NOT IN ('FINISHED', 'POSTPONED')) = 0
		  )
		  AND EXISTS (
		      SELECT 1
		      FROM player_stats ps
		      JOIN matches m ON ps.match_id = m.id
		      WHERE (m.event_day_id = gw.event_day_id OR (m.competition_id = s.competition_id AND m.date = ed.date))
		  )
		ORDER BY gw.deadline ASC
	`
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query gameweeks due for finalize: %w", err)
	}
	defer rows.Close()

	list := make([]domain.FantasyGameweek, 0)
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
		calcPrice := pp.Price
		if pp.CalculatedPrice != nil {
			calcPrice = *pp.CalculatedPrice
		}
		if pp.GameweekID == nil {
			query := `
				INSERT INTO fantasy_player_prices (season_id, player_id, gameweek_id, base_price, rating, price, calculated_price, is_overridden)
				VALUES ($1, $2, NULL, $3, $4, $5, $6, $7)
				ON CONFLICT (season_id, player_id) WHERE gameweek_id IS NULL
				DO UPDATE SET
					base_price = EXCLUDED.base_price,
					rating = EXCLUDED.rating,
					calculated_price = EXCLUDED.calculated_price,
					price = CASE WHEN fantasy_player_prices.is_overridden THEN fantasy_player_prices.price ELSE EXCLUDED.price END
			`
			if _, err := tx.Exec(ctx, query, pp.SeasonID, pp.PlayerID, pp.BasePrice, pp.Rating, pp.Price, calcPrice, pp.IsOverridden); err != nil {
				return err
			}
		} else {
			query := `
				INSERT INTO fantasy_player_prices (season_id, player_id, gameweek_id, base_price, rating, price, calculated_price, is_overridden)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
				ON CONFLICT (season_id, player_id, gameweek_id)
				DO UPDATE SET
					base_price = EXCLUDED.base_price,
					rating = EXCLUDED.rating,
					calculated_price = EXCLUDED.calculated_price,
					price = CASE WHEN fantasy_player_prices.is_overridden THEN fantasy_player_prices.price ELSE EXCLUDED.price END
			`
			if _, err := tx.Exec(ctx, query, pp.SeasonID, pp.PlayerID, pp.GameweekID, pp.BasePrice, pp.Rating, pp.Price, calcPrice, pp.IsOverridden); err != nil {
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
		JOIN teams t ON p.team_id = t.id
		JOIN fantasy_player_prices fpp ON fpp.player_id = p.id AND fpp.season_id = $1 AND fpp.gameweek_id IS NULL AND fpp.price > 0
		LEFT JOIN (
			SELECT fgp.player_id, SUM(fgp.points) AS total_pts
			FROM fantasy_gw_points fgp
			JOIN fantasy_gameweeks fgw ON fgp.gameweek_id = fgw.id
			WHERE fgw.season_id = $1
			GROUP BY fgp.player_id
		) pts ON pts.player_id = p.id
		LEFT JOIN (
			-- Ownership reads from the squad ledger rather than from lineups: a
			-- player is owned the moment they are bought, whether or not they
			-- have started a match. Sold rows are kept, which is what makes the
			-- transfer counts possible.
			SELECT sp.player_id,
			       COUNT(*) FILTER (WHERE sp.sold_at IS NULL) AS owned_now,
			       COUNT(*)                                   AS bought_total,
			       COUNT(*) FILTER (WHERE sp.sold_at IS NOT NULL) AS sold_total
			FROM fantasy_squad_players sp
			JOIN fantasy_teams ft ON ft.id = sp.team_id
			WHERE ft.season_id = $1
			GROUP BY sp.player_id
		) sel ON sel.player_id = p.id
		WHERE p.team_id IS NOT NULL
		  AND COALESCE(t.status, 'active') = 'active'
		  -- Deactivated players (migration 088) keep their history but cannot be
		  -- signed, picked or fielded again.
		  AND COALESCE(p.status, 'active') = 'active'
		  -- Exclude reserve squad players (migration 087): only main squad players
		  -- are active and eligible to be bought on the fantasy transfer market.
		  AND NOT EXISTS (
		      SELECT 1 FROM team_reserves tr WHERE tr.player_id = p.id
		  )
		  AND (
		      NOT EXISTS (
		          SELECT 1 FROM competition_teams ct
		          JOIN fantasy_seasons fs ON fs.id = $1
		          WHERE ct.competition_id = fs.competition_id
		      )
		      OR EXISTS (
		          SELECT 1 FROM competition_teams ct
		          JOIN fantasy_seasons fs ON fs.id = $1
		          WHERE ct.competition_id = fs.competition_id AND ct.team_id = t.id
		      )
		  )
	`
	args := []interface{}{seasonID}
	argIdx := 2

	if len(positions) > 0 {
		// An All-Rounder is eligible for every slot, so they belong in the pool
		// whichever positions were asked for. Without this the market for, say, a
		// receiver slot excluded them, while the validator that runs on save
		// accepts them — the picker would hide the very players it would let you
		// submit. Gender is filtered separately below and still applies.
		baseQuery += fmt.Sprintf(
			" AND (p.position = ANY($%d) OR UPPER(TRIM(COALESCE(p.position, ''))) IN ('ALLROUNDER','ALL-ROUNDER','ALL ROUNDER','AR'))",
			argIdx)
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

	// Every ordering ends on p.id so paging is stable: without a unique tail a
	// tie can shuffle between requests and a row appears on two pages or none.
	orderClause := " ORDER BY COALESCE(fpp.price, 0) DESC, p.name ASC, p.id ASC"
	switch sortBy {
	case "price_desc":
		orderClause = " ORDER BY COALESCE(fpp.price, 0) DESC, p.name ASC, p.id ASC"
	case "points":
		orderClause = " ORDER BY COALESCE(pts.total_pts, 0) DESC, p.name ASC, p.id ASC"
	case "name":
		orderClause = " ORDER BY p.name ASC, p.id ASC"
	case "rating":
		orderClause = " ORDER BY COALESCE(fpp.rating, 0) DESC, p.name ASC, p.id ASC"
	case "price_asc":
		orderClause = " ORDER BY COALESCE(fpp.price, 0) ASC, p.name ASC, p.id ASC"
	case "selected", "owned":
		orderClause = " ORDER BY COALESCE(sel.owned_now, 0) DESC, p.name ASC, p.id ASC"
	case "transfers_in":
		orderClause = " ORDER BY COALESCE(sel.bought_total, 0) DESC, p.name ASC, p.id ASC"
	case "transfers_out":
		orderClause = " ORDER BY COALESCE(sel.sold_total, 0) DESC, p.name ASC, p.id ASC"
	}

	selectQuery := `
		SELECT p.id, p.name, COALESCE(p.image, ''), COALESCE(p.position, '-'), COALESCE(p.gender, 'M'),
		       COALESCE(t.id::text, ''), COALESCE(t.name, ''), COALESCE(t.short_name, ''), COALESCE(t.logo, ''),
		       COALESCE(fpp.price, 0), COALESCE(fpp.rating, 5.00), COALESCE(pts.total_pts, 0.000),
		       COALESCE(sel.owned_now, 0), COALESCE(sel.bought_total, 0), COALESCE(sel.sold_total, 0)
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
		if err := rows.Scan(
			&item.PlayerID, &item.PlayerName, &item.PlayerImage, &item.Position, &item.Gender,
			&item.TeamID, &item.TeamName, &item.TeamShortName, &item.TeamLogo,
			&item.Price, &item.Rating, &item.TotalPoints,
			&item.OwnedBy, &item.TransfersIn, &item.TransfersOut,
		); err != nil {
			return nil, 0, err
		}
		if squadCount > 0 {
			item.SelectedByPct = (float64(item.OwnedBy) / float64(squadCount)) * 100
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
		SELECT p.id, COALESCE(p.position, '-'),
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
		       COALESCE(SUM(ps.batted_down_passes), 0), COALESCE(SUM(ps.xp_good), 0)
		FROM players p
		LEFT JOIN player_stats ps ON ps.player_id = p.id AND ps.competition_id = $1
		GROUP BY p.id, COALESCE(p.position, '-')
	`
	rows, err := r.pool.Query(ctx, query, competitionID)
	if err != nil {
		return nil, fmt.Errorf("failed to aggregate season rating lines: %w", err)
	}
	defer rows.Close()

	list := make([]PlayerRatingLine, 0)
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
			&l.UncatchablePasses, &l.ThrownAwayPasses, &l.BattedDownPasses, &l.XPGood,
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
		INSERT INTO fantasy_teams (user_id, season_id, name, bank)
		-- A new manager starts with the whole season budget in the bank; the
		-- squad is bought out of it. Defaulting to 0 would leave them unable to
		-- sign anyone.
		VALUES ($1, $2, $3, COALESCE((SELECT budget FROM fantasy_seasons WHERE id = $2), 230))
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
		SELECT ft.id, ft.user_id, ft.season_id, ft.name, COALESCE(u.full_name, 'Manager'), ft.total_points, ft.created_at, ft.updated_at
		FROM fantasy_teams ft
		LEFT JOIN users u ON ft.user_id = u.id
		WHERE ft.id = $1
	`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var t domain.FantasyTeam
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&t.ID, &t.UserID, &t.SeasonID, &t.Name, &t.ManagerName, &t.TotalPoints, &t.CreatedAt, &t.UpdatedAt,
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

	teams := make([]domain.FantasyTeam, 0)
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
// GetTeamOverallRank ranks a team against every manager in its season. RANK()
// rather than ROW_NUMBER() so managers level on points genuinely share a
// position instead of being separated arbitrarily.
func (r *FantasyRepository) GetTeamOverallRank(ctx context.Context, seasonID, teamID string) (int, int, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	query := `
		SELECT rnk, total FROM (
			SELECT ft.id,
			       ROW_NUMBER() OVER (ORDER BY ft.total_points DESC, COALESCE(u.full_name, '') ASC, ft.id ASC) AS rnk,
			       COUNT(*) OVER () AS total
			FROM fantasy_teams ft
			LEFT JOIN users u ON ft.user_id = u.id
			WHERE ft.season_id = $1
		) ranked
		WHERE id = $2
	`
	var rank, total int
	if err := r.pool.QueryRow(ctx, query, seasonID, teamID).Scan(&rank, &total); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, 0, nil
		}
		return 0, 0, fmt.Errorf("failed to rank team: %w", err)
	}
	return rank, total, nil
}

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
		SELECT p.id, p.name, COALESCE(p.position, '-'), COALESCE(p.gender, 'M'), COALESCE(p.team_id::text, ''),
		       COALESCE(gwp.price, openp.price, 10.00)
		FROM players p
		JOIN teams t ON p.team_id = t.id
		LEFT JOIN fantasy_player_prices gwp
		       ON gwp.player_id = p.id AND gwp.season_id = $1 AND gwp.gameweek_id = $2
		LEFT JOIN fantasy_player_prices openp
		       ON openp.player_id = p.id AND openp.season_id = $1 AND openp.gameweek_id IS NULL
		WHERE p.id = ANY($3)
		  AND p.team_id IS NOT NULL
		  AND COALESCE(t.status, 'active') = 'active'
		  -- Deactivated players (migration 088) keep their history but cannot be
		  -- signed, picked or fielded again.
		  AND COALESCE(p.status, 'active') = 'active'
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
		       p.id, p.name, COALESCE(p.image, ''), COALESCE(p.position, '-'), COALESCE(p.gender, 'M'),
		       COALESCE(p.status, 'active'),
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
			&pl.Status,
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
		WHERE fl.team_id = $1 AND (fgw.number < $2 OR $2 >= 999) AND fl.status IN ('LOCKED', 'DRAFT')
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

	// Fetch picks with hydrated player & team info
	picksQuery := `
		SELECT flp.id, flp.lineup_id, flp.player_id, flp.slot, flp.purchase_price, flp.points, flp.created_at,
		       p.id, p.name, COALESCE(p.image, ''), COALESCE(p.position, '-'), COALESCE(p.gender, 'M'),
		       COALESCE(p.status, 'active'),
		       COALESCE(t.id::text, ''), COALESCE(t.name, ''), COALESCE(t.short_name, ''), COALESCE(t.logo, '')
		FROM fantasy_lineup_picks flp
		JOIN players p ON flp.player_id = p.id
		LEFT JOIN teams t ON p.team_id = t.id
		WHERE flp.lineup_id = $1
		ORDER BY flp.slot ASC
	`
	rows, err := r.pool.Query(ctx, picksQuery, l.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var pick domain.FantasyLineupPick
		var pl domain.Player
		var tm domain.Team
		if err := rows.Scan(
			&pick.ID, &pick.LineupID, &pick.PlayerID, &pick.Slot, &pick.PurchasePrice, &pick.Points, &pick.CreatedAt,
			&pl.ID, &pl.Name, &pl.Image, &pl.Position, &pl.Gender,
			&pl.Status,
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

	lineups := make([]domain.FantasyLineup, 0)
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

	list := make([]domain.PlayerStat, 0)
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

// GetSeasonPricingLines rolls a competition's stats up per player for pricing:
// how many games they appeared in, the totals of everything that scores, and
// the price they were last published at.
//
// Games is a distinct count of matches with a stat row, which is what both the
// appearance threshold and the availability weight are measured against.
func (r *FantasyRepository) GetSeasonPricingLines(ctx context.Context, seasonID, competitionID string) ([]PlayerPricingLine, error) {
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	query := `
		SELECT p.id::text, COALESCE(p.position, '-'),
		       COUNT(DISTINCT ps.match_id),
		       COALESCE(SUM(ps.passing_yards), 0), COALESCE(SUM(ps.rushing_yards), 0),
		       COALESCE(SUM(ps.receiving_yards), 0), COALESCE(SUM(ps.passing_tds), 0),
		       COALESCE(SUM(ps.rushing_tds), 0), COALESCE(SUM(ps.interceptions_thrown), 0),
		       COALESCE(SUM(ps.receptions), 0), COALESCE(SUM(ps.receiving_tds), 0),
		       COALESCE(SUM(ps.extra_points_tds), 0), COALESCE(SUM(ps.xp_good), 0),
		       COALESCE(SUM(ps.drops), 0), COALESCE(SUM(ps.flag_pulls), 0),
		       COALESCE(SUM(ps.pass_deflections), 0), COALESCE(SUM(ps.interceptions), 0),
		       COALESCE(SUM(ps.defensive_tds), 0), COALESCE(SUM(ps.safety), 0),
		       COALESCE(SUM(ps.qb_sacks), 0), COALESCE(SUM(ps.def_sacks), 0),
		       COALESCE(SUM(ps.defensive_xp_tds), 0), COALESCE(SUM(ps.bad_snaps), 0),
		       COALESCE((
		           SELECT pp.price FROM fantasy_player_prices pp
		           WHERE pp.player_id = p.id AND pp.season_id = $1
		           ORDER BY (pp.gameweek_id IS NULL), pp.created_at DESC
		           LIMIT 1
		       ), 0)
		FROM players p
		LEFT JOIN player_stats ps ON ps.player_id = p.id AND ps.competition_id = $2
		GROUP BY p.id, COALESCE(p.position, '-')
	`
	rows, err := r.pool.Query(ctx, query, seasonID, competitionID)
	if err != nil {
		return nil, fmt.Errorf("failed to aggregate season pricing lines: %w", err)
	}
	defer rows.Close()

	list := make([]PlayerPricingLine, 0)
	for rows.Next() {
		var l PlayerPricingLine
		t := &l.Totals
		if err := rows.Scan(
			&l.PlayerID, &l.Position, &l.Games,
			&t.PassingYards, &t.RushingYards, &t.ReceivingYards, &t.PassingTDs,
			&t.RushingTDs, &t.InterceptionsThrown, &t.Receptions, &t.ReceivingTDs,
			&t.ExtraPointsTDs, &t.XPGood, &t.Drops, &t.FlagPulls,
			&t.PassDeflections, &t.Interceptions, &t.DefensiveTDs, &t.Safety,
			&t.QBSacks, &t.DefSacks, &t.DefensiveXPTDs, &t.BadSnaps,
			&l.PreviousPrice,
		); err != nil {
			return nil, fmt.Errorf("failed to scan pricing line: %w", err)
		}
		list = append(list, l)
	}
	return list, rows.Err()
}

// GetOverriddenPrices returns a map of player ID to overridden price for a season's opening prices.
func (r *FantasyRepository) GetOverriddenPrices(ctx context.Context, seasonID string) (map[string]float64, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	rows, err := r.pool.Query(ctx, `
		SELECT player_id::text, price
		FROM fantasy_player_prices
		WHERE season_id = $1 AND gameweek_id IS NULL AND is_overridden = true
	`, seasonID)
	if err != nil {
		return nil, fmt.Errorf("failed to query price overrides: %w", err)
	}
	defer rows.Close()

	overrides := make(map[string]float64)
	for rows.Next() {
		var pID string
		var pr float64
		if err := rows.Scan(&pID, &pr); err != nil {
			return nil, err
		}
		overrides[pID] = pr
	}
	return overrides, rows.Err()
}

// ListPlayerPricesForAdmin returns all eligible players for a season's competition with their current and calculated prices.
func (r *FantasyRepository) ListPlayerPricesForAdmin(ctx context.Context, seasonID string, search, position, teamID, overrideStatus string, page, limit int) ([]dto.AdminPlayerPriceItem, int, error) {
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
		JOIN teams t ON p.team_id = t.id
		LEFT JOIN fantasy_player_prices fpp ON fpp.player_id = p.id AND fpp.season_id = $1 AND fpp.gameweek_id IS NULL
		WHERE p.team_id IS NOT NULL
		  AND COALESCE(t.status, 'active') = 'active'
		  -- Deactivated players (migration 088) keep their history but cannot be
		  -- signed, picked or fielded again.
		  AND COALESCE(p.status, 'active') = 'active'
		  AND (
		      NOT EXISTS (
		          SELECT 1 FROM competition_teams ct
		          JOIN fantasy_seasons fs ON fs.id = $1
		          WHERE ct.competition_id = fs.competition_id
		      )
		      OR EXISTS (
		          SELECT 1 FROM competition_teams ct
		          JOIN fantasy_seasons fs ON fs.id = $1
		          WHERE ct.competition_id = fs.competition_id AND ct.team_id = t.id
		      )
		  )
	`
	args := []interface{}{seasonID}
	argIdx := 2

	if search != "" {
		baseQuery += fmt.Sprintf(" AND p.name ILIKE $%d", argIdx)
		args = append(args, "%"+search+"%")
		argIdx++
	}
	if position != "" {
		baseQuery += fmt.Sprintf(" AND p.position = $%d", argIdx)
		args = append(args, position)
		argIdx++
	}
	if teamID != "" {
		baseQuery += fmt.Sprintf(" AND p.team_id = $%d", argIdx)
		args = append(args, teamID)
		argIdx++
	}
	if overrideStatus == "overridden" {
		baseQuery += " AND fpp.is_overridden = true"
	} else if overrideStatus == "calculated" {
		baseQuery += " AND COALESCE(fpp.is_overridden, false) = false"
	}

	var total int
	countQuery := "SELECT COUNT(p.id) " + baseQuery
	if err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count player prices: %w", err)
	}

	orderClause := " ORDER BY COALESCE(fpp.is_overridden, false) DESC, p.name ASC, p.id ASC"

	selectQuery := `
		SELECT p.id, p.name, COALESCE(p.image, ''), COALESCE(p.position, '-'), COALESCE(p.gender, 'M'),
		       COALESCE(t.id::text, ''), COALESCE(t.name, ''), COALESCE(t.short_name, ''), COALESCE(t.logo, ''),
		       -- 0 means "no price row yet", the same signal ListPlayerMarket
		       -- gives. Defaulting to a number instead would show the admin a
		       -- price nothing in the system actually holds. 5.00 for rating is
		       -- different: that is the engine's own default for an unrated
		       -- player (see repriceSeason), so it is the real value.
		       COALESCE(fpp.price, 0), fpp.calculated_price, COALESCE(fpp.is_overridden, false),
		       COALESCE(fpp.rating, 5.00)
	` + baseQuery + orderClause + fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, selectQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query player prices: %w", err)
	}
	defer rows.Close()

	items := make([]dto.AdminPlayerPriceItem, 0, limit)
	for rows.Next() {
		var item dto.AdminPlayerPriceItem
		if err := rows.Scan(
			&item.PlayerID,
			&item.PlayerName,
			&item.PlayerImage,
			&item.Position,
			&item.Gender,
			&item.TeamID,
			&item.TeamName,
			&item.TeamShortName,
			&item.TeamLogo,
			&item.Price,
			&item.CalculatedPrice,
			&item.IsOverridden,
			&item.Rating,
		); err != nil {
			return nil, 0, fmt.Errorf("failed to scan player price row: %w", err)
		}
		if item.CalculatedPrice == nil {
			calc := item.Price
			item.CalculatedPrice = &calc
		}
		items = append(items, item)
	}
	return items, total, rows.Err()
}

// OverridePlayerPrice sets or resets a manual price override on a player for a season.
func (r *FantasyRepository) OverridePlayerPrice(ctx context.Context, seasonID, playerID string, price *float64, reset bool) (*dto.AdminPlayerPriceItem, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if reset {
		// Reset: clear is_overridden and revert price to calculated_price.
		// A FINALIZED gameweek's row is the published record of what a player
		// was worth while that gameweek was scored, so it is left alone — the
		// opening row (gameweek_id IS NULL) is never finalized and always resets.
		_, err = tx.Exec(ctx, `
			UPDATE fantasy_player_prices fpp
			SET is_overridden = false,
			    price = COALESCE(fpp.calculated_price, fpp.price)
			WHERE fpp.season_id = $1 AND fpp.player_id = $2
			  AND NOT EXISTS (
			      SELECT 1 FROM fantasy_gameweeks fgw
			      WHERE fgw.id = fpp.gameweek_id AND fgw.status = 'FINALIZED'
			  )
		`, seasonID, playerID)
		if err != nil {
			return nil, fmt.Errorf("failed to reset player price: %w", err)
		}
	} else if price != nil {
		// Upsert opening price row
		_, err = tx.Exec(ctx, `
			INSERT INTO fantasy_player_prices (season_id, player_id, gameweek_id, base_price, rating, price, calculated_price, is_overridden)
			-- base_price is the floor the run was built from, matching what
			-- repriceSeason writes (domain.PriceFloor). 10.00 was the pre-079
			-- base and no longer means anything.
			VALUES ($1, $2, NULL, 3.00, 5.00, $3, $3, true)
			ON CONFLICT (season_id, player_id) WHERE gameweek_id IS NULL
			DO UPDATE SET
				price = EXCLUDED.price,
				is_overridden = true,
				calculated_price = COALESCE(fantasy_player_prices.calculated_price, fantasy_player_prices.price, EXCLUDED.price)
		`, seasonID, playerID, *price)
		if err != nil {
			return nil, fmt.Errorf("failed to upsert opening price override: %w", err)
		}

		// Also update the gameweek snapshot rows that are still in play, so the
		// new price takes effect immediately (GetSquad and GetLineupCandidates
		// read the newest gameweek row before falling back to the opening one).
		// FINALIZED gameweeks are skipped: their prices are published history
		// and re-pricing them would retroactively restate a scored gameweek.
		_, err = tx.Exec(ctx, `
			UPDATE fantasy_player_prices fpp
			SET price = $3,
			    is_overridden = true,
			    calculated_price = COALESCE(fpp.calculated_price, fpp.price)
			WHERE fpp.season_id = $1 AND fpp.player_id = $2 AND fpp.gameweek_id IS NOT NULL
			  AND NOT EXISTS (
			      SELECT 1 FROM fantasy_gameweeks fgw
			      WHERE fgw.id = fpp.gameweek_id AND fgw.status = 'FINALIZED'
			  )
		`, seasonID, playerID, *price)
		if err != nil {
			return nil, fmt.Errorf("failed to update gameweek price overrides: %w", err)
		}
	} else {
		return nil, errors.New("either price or reset must be provided")
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	rowQuery := `
		SELECT p.id, p.name, COALESCE(p.image, ''), COALESCE(p.position, '-'), COALESCE(p.gender, 'M'),
		       COALESCE(t.id::text, ''), COALESCE(t.name, ''), COALESCE(t.short_name, ''), COALESCE(t.logo, ''),
		       -- 0 means "no price row yet", the same signal ListPlayerMarket
		       -- gives. Defaulting to a number instead would show the admin a
		       -- price nothing in the system actually holds. 5.00 for rating is
		       -- different: that is the engine's own default for an unrated
		       -- player (see repriceSeason), so it is the real value.
		       COALESCE(fpp.price, 0), fpp.calculated_price, COALESCE(fpp.is_overridden, false),
		       COALESCE(fpp.rating, 5.00)
		FROM players p
		JOIN teams t ON p.team_id = t.id
		LEFT JOIN fantasy_player_prices fpp ON fpp.player_id = p.id AND fpp.season_id = $1 AND fpp.gameweek_id IS NULL
		WHERE p.id = $2
	`
	var item dto.AdminPlayerPriceItem
	if err := r.pool.QueryRow(ctx, rowQuery, seasonID, playerID).Scan(
		&item.PlayerID,
		&item.PlayerName,
		&item.PlayerImage,
		&item.Position,
		&item.Gender,
		&item.TeamID,
		&item.TeamName,
		&item.TeamShortName,
		&item.TeamLogo,
		&item.Price,
		&item.CalculatedPrice,
		&item.IsOverridden,
		&item.Rating,
	); err != nil {
		return nil, fmt.Errorf("failed to fetch updated price item: %w", err)
	}
	if item.CalculatedPrice == nil {
		calc := item.Price
		item.CalculatedPrice = &calc
	}

	return &item, nil
}

// ─── Gameweek scheduling ──────────────────────────────────────────────────────

// ListScheduledGameweeks returns the season's gameweeks alongside the calendar
// date of the event day each is bound to. The scheduler plans by date, so the
// join is done here rather than making it fetch event days one at a time.
func (r *FantasyRepository) ListScheduledGameweeks(ctx context.Context, seasonID string) ([]domain.ScheduledGameweek, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	rows, err := r.pool.Query(ctx, `
		SELECT g.id::text, g.number, ed.date::text, g.status, g.deadline,
		       (
		           g.status = 'FINALIZED'
		           OR EXISTS (SELECT 1 FROM fantasy_gw_points gp WHERE gp.gameweek_id = g.id)
		           OR EXISTS (SELECT 1 FROM fantasy_lineups fl WHERE fl.gameweek_id = g.id AND fl.status = 'LOCKED')
		       ) AS has_history
		FROM fantasy_gameweeks g
		JOIN event_days ed ON ed.id = g.event_day_id
		WHERE g.season_id = $1::uuid
		ORDER BY g.number ASC
	`, seasonID)
	if err != nil {
		return nil, fmt.Errorf("failed to list gameweeks for scheduling: %w", err)
	}
	defer rows.Close()

	var out []domain.ScheduledGameweek
	for rows.Next() {
		var gw domain.ScheduledGameweek
		if err := rows.Scan(&gw.ID, &gw.Number, &gw.Date, &gw.Status, &gw.Deadline, &gw.HasHistory); err != nil {
			return nil, err
		}
		out = append(out, gw)
	}
	return out, rows.Err()
}

// SeasonIDsForCompetition lists the fantasy seasons whose fixtures come from a
// competition. COMPLETED seasons are left out: their schedule is history, and a
// fixture edited long afterwards must not disturb it.
func (r *FantasyRepository) SeasonIDsForCompetition(ctx context.Context, competitionID string) ([]string, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	rows, err := r.pool.Query(ctx, `
		SELECT id::text FROM fantasy_seasons
		WHERE competition_id = $1::uuid AND status IN ('DRAFT', 'ACTIVE')
	`, competitionID)
	if err != nil {
		return nil, fmt.Errorf("failed to list seasons for competition: %w", err)
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// ApplyGameweekPlan writes a plan in a single transaction.
//
// All of it or none of it: a partially-applied plan would leave a season with
// duplicate numbers or a gap, and the unique index on (season_id, number) means
// the failure would land midway through rather than cleanly at the start.
//
// Numbers are shuffled out of the way before being reassigned. Renumbering in
// place trips uix on (season_id, number) the moment two gameweeks swap, so every
// row being touched is first parked on a negative number — which no real
// gameweek ever holds — and then written to its final value.
func (r *FantasyRepository) ApplyGameweekPlan(ctx context.Context, seasonID, competitionID string, plan domain.SchedulePlan) error {
	if plan.Empty() {
		return nil
	}

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for _, id := range plan.Delete {
		// The guard is re-stated here rather than trusted from the plan, so a
		// stale plan can never take scored history with it.
		//
		// Two things may go: a gameweek still SCHEDULED, and one that locked
		// but holds nothing — no points were awarded against it, no manager
		// ever locked in a squad, and it was never finalized. That second case
		// is how an empty gameweek left behind by a fixture change gets
		// cleared; a locked gameweek that was actually scored, or that a
		// manager committed a squad to, survives.
		if _, err := tx.Exec(ctx, `
			DELETE FROM fantasy_gameweeks g
			WHERE g.id = $1::uuid AND g.season_id = $2::uuid
			  AND (
			      g.status = 'SCHEDULED'
			      OR (
			          g.status <> 'FINALIZED'
			          AND NOT EXISTS (SELECT 1 FROM fantasy_gw_points gp WHERE gp.gameweek_id = g.id)
			          AND NOT EXISTS (SELECT 1 FROM fantasy_lineups fl WHERE fl.gameweek_id = g.id AND fl.status = 'LOCKED')
			      )
			  )
		`, id, seasonID); err != nil {
			return fmt.Errorf("failed to remove gameweek %s: %w", id, err)
		}
	}

	// Park every number being changed, so reassignment cannot collide.
	for i, u := range plan.Update {
		if _, err := tx.Exec(ctx, `
			UPDATE fantasy_gameweeks SET number = $1 WHERE id = $2::uuid AND season_id = $3::uuid
		`, -(i + 1), u.ID, seasonID); err != nil {
			return fmt.Errorf("failed to stage gameweek %s: %w", u.ID, err)
		}
	}

	for _, u := range plan.Update {
		eventDayID, err := ensureEventDayTx(ctx, tx, competitionID, u.Date, u.Number)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `
			UPDATE fantasy_gameweeks
			SET number = $1, event_day_id = $2::uuid, deadline = $3, updated_at = NOW()
			WHERE id = $4::uuid AND season_id = $5::uuid AND status = 'SCHEDULED'
		`, u.Number, eventDayID, u.Deadline, u.ID, seasonID); err != nil {
			return fmt.Errorf("failed to update gameweek %s: %w", u.ID, err)
		}
	}

	for _, c := range plan.Create {
		eventDayID, err := ensureEventDayTx(ctx, tx, competitionID, c.Date, c.Number)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO fantasy_gameweeks (season_id, number, event_day_id, deadline, status)
			VALUES ($1::uuid, $2, $3::uuid, $4, 'SCHEDULED')
			ON CONFLICT (season_id, event_day_id) DO UPDATE
			SET number = EXCLUDED.number, deadline = EXCLUDED.deadline, updated_at = NOW()
		`, seasonID, c.Number, eventDayID, c.Deadline); err != nil {
			return fmt.Errorf("failed to create gameweek %d (%s): %w", c.Number, c.Date, err)
		}
	}

	return tx.Commit(ctx)
}

// ensureEventDayTx finds or creates the event day for a match date and links
// every one of that competition's fixtures on the day to it.
//
// The linking is the half that used to be missed: the original only ran when a
// gameweek was first created, so fixtures added to a day afterwards kept a NULL
// event_day_id forever. Anything keyed on event_day_id — tickets especially —
// then could not see them.
func ensureEventDayTx(ctx context.Context, tx pgx.Tx, competitionID, matchDate string, gwNumber int) (string, error) {
	var eventDayID string
	err := tx.QueryRow(ctx, `SELECT id::text FROM event_days WHERE date = $1::date`, matchDate).Scan(&eventDayID)
	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			return "", fmt.Errorf("failed to look up event day for %s: %w", matchDate, err)
		}
		// event_days.date is globally unique, so a day shared with another
		// competition is found above and reused rather than duplicated.
		title := fmt.Sprintf("Gameweek %d (%s)", gwNumber, matchDate)
		if err := tx.QueryRow(ctx, `
			INSERT INTO event_days (title, date, venue, is_active)
			VALUES ($1, $2::date, 'Showtime Arena', true)
			ON CONFLICT (date) DO UPDATE SET updated_at = NOW()
			RETURNING id::text
		`, title, matchDate).Scan(&eventDayID); err != nil {
			return "", fmt.Errorf("failed to create event day for %s: %w", matchDate, err)
		}
	}

	if _, err := tx.Exec(ctx, `
		UPDATE matches
		SET event_day_id = $1::uuid, updated_at = NOW()
		WHERE competition_id = $2::uuid AND date = $3::date
		  AND event_day_id IS DISTINCT FROM $1::uuid
	`, eventDayID, competitionID, matchDate); err != nil {
		return "", fmt.Errorf("failed to link fixtures on %s to their event day: %w", matchDate, err)
	}

	return eventDayID, nil
}

// LinkFixturesToEventDays gives every fixture in a competition the event day for
// its own date, creating the event day when it does not exist yet.
//
// Deliberately independent of the gameweek plan. Linking used to happen only
// while a gameweek was being written, so a season whose schedule was already
// correct never relinked — and fixtures added to an existing match day kept a
// NULL event_day_id indefinitely. Anything reading by event day, tickets above
// all, could not see them.
func (r *FantasyRepository) LinkFixturesToEventDays(ctx context.Context, competitionID string) error {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Only days that are actually short of a link, so a competition already in
	// order costs one scan and no writes.
	rows, err := tx.Query(ctx, `
		SELECT DISTINCT m.date::text
		FROM matches m
		LEFT JOIN event_days ed ON ed.date = m.date
		WHERE m.competition_id = $1::uuid
		  AND (ed.id IS NULL OR m.event_day_id IS DISTINCT FROM ed.id)
		ORDER BY 1
	`, competitionID)
	if err != nil {
		return fmt.Errorf("failed to find fixtures needing an event day: %w", err)
	}
	var dates []string
	for rows.Next() {
		var d string
		if err := rows.Scan(&d); err != nil {
			rows.Close()
			return err
		}
		dates = append(dates, d)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	if len(dates) == 0 {
		return nil
	}

	for i, d := range dates {
		if _, err := ensureEventDayTx(ctx, tx, competitionID, d, i+1); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (r *FantasyRepository) GetGameweekAnalytics(ctx context.Context, seasonID, gameweekID string) (*dto.GameweekReportResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, 6*time.Second)
	defer cancel()

	gw, err := r.GetGameweekByID(ctx, gameweekID)
	if err != nil {
		return nil, fmt.Errorf("failed to load gameweek: %w", err)
	}
	if gw == nil {
		return nil, fmt.Errorf("gameweek not found")
	}

	report := &dto.GameweekReportResponse{
		SeasonID:       seasonID,
		GameweekID:     gw.ID,
		GameweekNumber: gw.Number,
		GameweekStatus: string(gw.Status),
		MostOwned:      make([]dto.MostOwnedPlayerItem, 0),
		TopScorers:     make([]dto.TopScoringPlayerItem, 0),
		ClubPoints:     make([]dto.ClubPointsItem, 0),
		DreamTeam:      make([]dto.FantasyLineupPickResponse, 0),
		Differentials:  make([]dto.TopScoringPlayerItem, 0),
	}

	// 1. Summary stats
	summaryQuery := `
		SELECT 
			COUNT(fl.id) as total_lineups,
			COALESCE(AVG(fl.points), 0)::float8 as avg_pts,
			COALESCE(MAX(fl.points), 0)::float8 as max_pts,
			COALESCE(MIN(fl.points), 0)::float8 as min_pts
		FROM fantasy_lineups fl
		WHERE fl.gameweek_id = $1 AND fl.status = 'LOCKED'
	`
	var totalLineups int
	var avgPts, maxPts, minPts float64
	err = r.pool.QueryRow(ctx, summaryQuery, gw.ID).Scan(&totalLineups, &avgPts, &maxPts, &minPts)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("failed to query summary stats: %w", err)
	}

	topTeam := ""
	if totalLineups > 0 {
		_ = r.pool.QueryRow(ctx, `
			SELECT ft.name
			FROM fantasy_lineups fl
			JOIN fantasy_teams ft ON ft.id = fl.team_id
			WHERE fl.gameweek_id = $1 AND fl.status = 'LOCKED'
			ORDER BY fl.points DESC
			LIMIT 1
		`, gw.ID).Scan(&topTeam)
	}

	report.Summary = dto.GameweekSummaryStats{
		AveragePoints:      math.Round(avgPts*10) / 10,
		HighestPoints:      math.Round(maxPts*10) / 10,
		HighestScoringTeam: topTeam,
		LowestPoints:       math.Round(minPts*10) / 10,
		TotalManagers:      totalLineups,
	}

	// 2. Most Owned Players (from locked starting lineups)
	mostOwnedQuery := `
		SELECT p.id, p.name, COALESCE(p.image, ''), COALESCE(p.position, '-'), COALESCE(p.gender, 'M'),
		       COALESCE(t.id::text, ''), COALESCE(t.name, ''), COALESCE(t.short_name, ''), COALESCE(t.logo, ''),
		       COALESCE(pp.price, 10.00)::float8,
		       COUNT(flp.player_id) as ownership_count,
		       COALESCE(MAX(flp.points), 0)::float8 as player_points
		FROM fantasy_lineup_picks flp
		JOIN fantasy_lineups fl ON fl.id = flp.lineup_id
		JOIN players p ON p.id = flp.player_id
		LEFT JOIN teams t ON t.id = p.team_id
		LEFT JOIN LATERAL (
			SELECT price FROM fantasy_player_prices
			WHERE player_id = p.id AND season_id = $2 AND (gameweek_id = $1 OR gameweek_id IS NULL)
			ORDER BY (gameweek_id = $1) DESC
			LIMIT 1
		) pp ON true
		WHERE fl.gameweek_id = $1 AND fl.status = 'LOCKED'
		GROUP BY p.id, p.name, p.image, p.position, p.gender, t.id, t.name, t.short_name, t.logo, pp.price
		ORDER BY ownership_count DESC, player_points DESC
		LIMIT 15
	`
	ownershipRows, err := r.pool.Query(ctx, mostOwnedQuery, gw.ID, seasonID)
	ownershipMap := make(map[string]float64)
	if err == nil {
		defer ownershipRows.Close()
		for ownershipRows.Next() {
			var m dto.MostOwnedPlayerItem
			if err := ownershipRows.Scan(
				&m.PlayerID, &m.PlayerName, &m.PlayerImage, &m.Position, &m.Gender,
				&m.TeamID, &m.TeamName, &m.TeamShortName, &m.TeamLogo,
				&m.CurrentPrice, &m.OwnershipCount, &m.Points,
			); err == nil {
				m.Gender = domain.NormalizeGender(m.Gender)
				if totalLineups > 0 {
					m.OwnershipPercentage = math.Round((float64(m.OwnershipCount)/float64(totalLineups)*100)*10) / 10
				}
				ownershipMap[m.PlayerID] = m.OwnershipPercentage
				report.MostOwned = append(report.MostOwned, m)
			}
		}
	}

	// 3. Top Scoring Players
	topScorersQuery := `
		SELECT p.id, p.name, COALESCE(p.image, ''), COALESCE(p.position, '-'), COALESCE(p.gender, 'M'),
		       COALESCE(t.id::text, ''), COALESCE(t.name, ''), COALESCE(t.short_name, ''), COALESCE(t.logo, ''),
		       COALESCE(pp.price, 10.00)::float8,
		       COALESCE(gp.pts, 0.0)::float8 as total_pts
		FROM (
			SELECT player_id, SUM(points) as pts
			FROM (
				SELECT DISTINCT player_id, match_id, points
				FROM fantasy_gw_points
				WHERE gameweek_id = $1
			) dm
			GROUP BY player_id
		) gp
		JOIN players p ON p.id = gp.player_id
		LEFT JOIN teams t ON t.id = p.team_id
		LEFT JOIN LATERAL (
			SELECT price FROM fantasy_player_prices
			WHERE player_id = p.id AND season_id = $2 AND (gameweek_id = $1 OR gameweek_id IS NULL)
			ORDER BY (gameweek_id = $1) DESC
			LIMIT 1
		) pp ON true
		ORDER BY gp.pts DESC
		LIMIT 30
	`
	tsRows, err := r.pool.Query(ctx, topScorersQuery, gw.ID, seasonID)
	if err == nil {
		defer tsRows.Close()
		for tsRows.Next() {
			var ts dto.TopScoringPlayerItem
			if err := tsRows.Scan(
				&ts.PlayerID, &ts.PlayerName, &ts.PlayerImage, &ts.Position, &ts.Gender,
				&ts.TeamID, &ts.TeamName, &ts.TeamShortName, &ts.TeamLogo,
				&ts.Price, &ts.Points,
			); err == nil {
				ts.Gender = domain.NormalizeGender(ts.Gender)
				ts.OwnershipPercentage = ownershipMap[ts.PlayerID]
				report.TopScorers = append(report.TopScorers, ts)
			}
		}
	}

	// If fantasy_gw_points was empty, fallback to reading scored picks
	if len(report.TopScorers) == 0 {
		fallbackQuery := `
			SELECT p.id, p.name, COALESCE(p.image, ''), COALESCE(p.position, '-'), COALESCE(p.gender, 'M'),
			       COALESCE(t.id::text, ''), COALESCE(t.name, ''), COALESCE(t.short_name, ''), COALESCE(t.logo, ''),
			       COALESCE(pp.price, 10.00)::float8,
			       COALESCE(MAX(flp.points), 0)::float8 as points
			FROM fantasy_lineup_picks flp
			JOIN fantasy_lineups fl ON fl.id = flp.lineup_id
			JOIN players p ON p.id = flp.player_id
			LEFT JOIN teams t ON t.id = p.team_id
			LEFT JOIN LATERAL (
				SELECT price FROM fantasy_player_prices
				WHERE player_id = p.id AND season_id = $2 AND (gameweek_id = $1 OR gameweek_id IS NULL)
				ORDER BY (gameweek_id = $1) DESC
				LIMIT 1
			) pp ON true
			WHERE fl.gameweek_id = $1 AND fl.status = 'LOCKED'
			GROUP BY p.id, p.name, p.image, p.position, p.gender, t.id, t.name, t.short_name, t.logo, pp.price
			ORDER BY points DESC
			LIMIT 30
		`
		fbRows, fbErr := r.pool.Query(ctx, fallbackQuery, gw.ID, seasonID)
		if fbErr == nil {
			defer fbRows.Close()
			for fbRows.Next() {
				var ts dto.TopScoringPlayerItem
				if err := fbRows.Scan(
					&ts.PlayerID, &ts.PlayerName, &ts.PlayerImage, &ts.Position, &ts.Gender,
					&ts.TeamID, &ts.TeamName, &ts.TeamShortName, &ts.TeamLogo,
					&ts.Price, &ts.Points,
				); err == nil {
					ts.Gender = domain.NormalizeGender(ts.Gender)
					ts.OwnershipPercentage = ownershipMap[ts.PlayerID]
					report.TopScorers = append(report.TopScorers, ts)
				}
			}
		}
	}

	// Differentials: High points (>0) and low ownership (< 20%)
	for _, ts := range report.TopScorers {
		if ts.Points > 0 && ts.OwnershipPercentage < 20.0 {
			report.Differentials = append(report.Differentials, ts)
			if len(report.Differentials) >= 6 {
				break
			}
		}
	}

	// 4. Points by Actual SFFL Club
	clubQuery := `
		SELECT t.id, t.name, COALESCE(t.short_name, ''), COALESCE(t.logo, ''),
		       COALESCE(SUM(flp.points), 0)::float8 as total_points,
		       COUNT(DISTINCT p.id) as active_player_count
		FROM fantasy_lineup_picks flp
		JOIN fantasy_lineups fl ON fl.id = flp.lineup_id
		JOIN players p ON p.id = flp.player_id
		JOIN teams t ON t.id = p.team_id
		WHERE fl.gameweek_id = $1 AND fl.status = 'LOCKED'
		GROUP BY t.id, t.name, t.short_name, t.logo
		ORDER BY total_points DESC
	`
	cRows, err := r.pool.Query(ctx, clubQuery, gw.ID)
	if err == nil {
		defer cRows.Close()
		for cRows.Next() {
			var cp dto.ClubPointsItem
			if err := cRows.Scan(
				&cp.ClubID, &cp.ClubName, &cp.ClubShortName, &cp.ClubLogo,
				&cp.TotalPoints, &cp.ActivePlayerCount,
			); err == nil {
				if cp.ActivePlayerCount > 0 {
					cp.AveragePointsPerPlayer = math.Round((cp.TotalPoints/float64(cp.ActivePlayerCount))*10) / 10
				}
				// Find top scorer for this club
				for _, ts := range report.TopScorers {
					if ts.TeamID == cp.ClubID {
						cp.TopScorerName = ts.PlayerName
						cp.TopScorerPoints = ts.Points
						break
					}
				}
				report.ClubPoints = append(report.ClubPoints, cp)
			}
		}
	}

	// 5. Dream Team (Optimal legal starting 14)
	report.DreamTeam, report.DreamTeamTotalPoints = buildDreamTeam(report.TopScorers)

	return report, nil
}

// buildDreamTeam constructs the highest-scoring legal starting lineup from the gameweek's performers.
func buildDreamTeam(scorers []dto.TopScoringPlayerItem) ([]dto.FantasyLineupPickResponse, float64) {
	if len(scorers) == 0 {
		return nil, 0
	}

	picks := make([]dto.FantasyLineupPickResponse, 0, 14)
	usedPlayers := make(map[string]bool)
	clubCounts := make(map[string]int)
	const maxPerClub = 3

	canPick := func(p dto.TopScoringPlayerItem) bool {
		if usedPlayers[p.PlayerID] {
			return false
		}
		if p.TeamID != "" && clubCounts[p.TeamID] >= maxPerClub {
			return false
		}
		return true
	}

	takePick := func(p dto.TopScoringPlayerItem, slot string) dto.FantasyLineupPickResponse {
		usedPlayers[p.PlayerID] = true
		if p.TeamID != "" {
			clubCounts[p.TeamID]++
		}
		return dto.FantasyLineupPickResponse{
			Slot:          slot,
			PlayerID:      p.PlayerID,
			PlayerName:    p.PlayerName,
			PlayerImage:   p.PlayerImage,
			Position:      p.Position,
			Gender:        p.Gender,
			TeamID:        p.TeamID,
			TeamName:      p.TeamName,
			TeamShortName: p.TeamShortName,
			TeamLogo:      p.TeamLogo,
			PurchasePrice: p.Price,
			CurrentPrice:  p.Price,
			Points:        p.Points,
		}
	}

	// 1. Male QB
	for _, p := range scorers {
		if (p.Position == "QB" || p.Position == "Quarterback") && p.Gender == "M" && canPick(p) {
			picks = append(picks, takePick(p, "QB_M"))
			break
		}
	}

	// 2. Female QB
	for _, p := range scorers {
		if (p.Position == "QB" || p.Position == "Quarterback") && p.Gender == "F" && canPick(p) {
			picks = append(picks, takePick(p, "QB_F"))
			break
		}
	}

	// 3. Receivers (5 slots). Quota needs at least 2 female receivers to hit min 3 female offense with QB_F.
	//
	// Slots are assigned from the canonical list by position, not derived from
	// len(picks): if an earlier slot (say QB_F) went unfilled because no such
	// scorer existed, len(picks) undercounts and produces a slot name like
	// "REC_0" that nothing else recognises, silently corrupting the label.
	recSlots := []string{"REC_1", "REC_2", "REC_3", "REC_4", "REC_5"}
	recIdx := 0
	femaleRecNeeded := 2
	for _, p := range scorers {
		if femaleRecNeeded <= 0 || recIdx >= len(recSlots) {
			break
		}
		if (p.Position == "Receiver" || p.Position == "Center" || p.Position == "WR") && p.Gender == "F" && canPick(p) {
			picks = append(picks, takePick(p, recSlots[recIdx]))
			recIdx++
			femaleRecNeeded--
		}
	}

	// Remaining receivers up to 5 total receivers
	for _, slot := range recSlots {
		alreadyFilled := false
		for _, pk := range picks {
			if pk.Slot == slot {
				alreadyFilled = true
				break
			}
		}
		if !alreadyFilled {
			for _, p := range scorers {
				if (p.Position == "Receiver" || p.Position == "Center" || p.Position == "WR") && canPick(p) {
					picks = append(picks, takePick(p, slot))
					break
				}
			}
		}
	}

	// 4. Rusher (1 slot)
	for _, p := range scorers {
		if (p.Position == "Rusher" || p.Position == "RUSH") && canPick(p) {
			picks = append(picks, takePick(p, "RUSHER"))
			break
		}
	}

	// 5. Defenders (6 slots). Quota needs at least 3 female defenders.
	// See the receivers section above for why this indexes into the canonical
	// slot list instead of deriving a number from len(picks).
	defSlots := []string{"DEF_1", "DEF_2", "DEF_3", "DEF_4", "DEF_5", "DEF_6"}
	defIdx := 0
	femaleDefNeeded := 3
	for _, p := range scorers {
		if femaleDefNeeded <= 0 || defIdx >= len(defSlots) {
			break
		}
		if (p.Position == "Defender" || p.Position == "DB" || p.Position == "CB" || p.Position == "Safety" || p.Position == "LB") && p.Gender == "F" && canPick(p) {
			picks = append(picks, takePick(p, defSlots[defIdx]))
			defIdx++
			femaleDefNeeded--
		}
	}

	// Remaining defenders up to 6 total defenders
	for _, slot := range defSlots {
		alreadyFilled := false
		for _, pk := range picks {
			if pk.Slot == slot {
				alreadyFilled = true
				break
			}
		}
		if !alreadyFilled {
			for _, p := range scorers {
				if (p.Position == "Defender" || p.Position == "DB" || p.Position == "CB" || p.Position == "Safety" || p.Position == "LB") && canPick(p) {
					picks = append(picks, takePick(p, slot))
					break
				}
			}
		}
	}

	var totalPts float64
	for _, pk := range picks {
		totalPts += pk.Points
	}
	return picks, math.Round(totalPts*10) / 10
}

func BuildDreamTeamForTest(scorers []dto.TopScoringPlayerItem) ([]dto.FantasyLineupPickResponse, float64) {
	return buildDreamTeam(scorers)
}
