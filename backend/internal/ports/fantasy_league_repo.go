package ports

import (
	"context"
	"errors"
	"fmt"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrLeagueFull is returned when a join would push a league past its max_members.
var ErrLeagueFull = errors.New("this league is full")

type IFantasyLeagueRepository interface {
	CreateLeague(ctx context.Context, l *domain.FantasyLeague) error
	GetLeagueByID(ctx context.Context, id string) (*domain.FantasyLeague, error)
	GetLeagueByInviteCode(ctx context.Context, code string) (*domain.FantasyLeague, error)
	GetOverallLeague(ctx context.Context, seasonID string) (*domain.FantasyLeague, error)
	ListLeaguesByUser(ctx context.Context, userID, seasonID string) ([]domain.FantasyLeague, error)
	ListPublicLeagues(ctx context.Context, seasonID string) ([]domain.FantasyLeague, error)

	AddMember(ctx context.Context, m *domain.FantasyLeagueMember) error
	CountActiveMembers(ctx context.Context, leagueID string) (int, error)
	GetMember(ctx context.Context, leagueID, userID string) (*domain.FantasyLeagueMember, error)
	GetMemberByPaystackRef(ctx context.Context, ref string) (*domain.FantasyLeagueMember, error)
	UpdateMemberPaymentStatus(ctx context.Context, id string, status domain.FantasyLeaguePaymentStatus) error

	GetLeaderboard(ctx context.Context, leagueID string, gameweekID *string, page, limit int) ([]dto.LeaderboardEntry, int, error)
	GetOverallLeaderboard(ctx context.Context, seasonID string, gameweekID *string, page, limit int) ([]dto.LeaderboardEntry, int, error)
}

type FantasyLeagueRepository struct {
	pool *pgxpool.Pool
}

func NewFantasyLeagueRepository(pool *pgxpool.Pool) IFantasyLeagueRepository {
	return &FantasyLeagueRepository{pool: pool}
}

func (r *FantasyLeagueRepository) CreateLeague(ctx context.Context, l *domain.FantasyLeague) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	query := `
		INSERT INTO fantasy_leagues (season_id, name, type, invite_code, created_by_user_id, entry_fee, max_members)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at, updated_at
	`
	return r.pool.QueryRow(ctx, query,
		l.SeasonID, l.Name, l.Type, l.InviteCode, l.CreatedByUserID, l.EntryFee, l.MaxMembers,
	).Scan(&l.ID, &l.CreatedAt, &l.UpdatedAt)
}

func (r *FantasyLeagueRepository) GetLeagueByID(ctx context.Context, id string) (*domain.FantasyLeague, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	query := `
		SELECT id, season_id, name, type, COALESCE(invite_code, ''), created_by_user_id,
		       entry_fee, max_members,
		       gross_entry_kobo, platform_cut_kobo, prize_pool_kobo, settled_at,
		       (SELECT COUNT(*) FROM fantasy_league_members flm
		         WHERE flm.league_id = fantasy_leagues.id AND flm.payment_status IN ('FREE', 'PAID')),
		       created_at, updated_at
		FROM fantasy_leagues
		WHERE id = $1
	`
	var l domain.FantasyLeague
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&l.ID, &l.SeasonID, &l.Name, &l.Type, &l.InviteCode, &l.CreatedByUserID,
		&l.EntryFee, &l.MaxMembers,
		&l.GrossEntryKobo, &l.PlatformCutKobo, &l.PrizePoolKobo, &l.SettledAt, &l.MemberCount, &l.CreatedAt, &l.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get league: %w", err)
	}
	return &l, nil
}

func (r *FantasyLeagueRepository) GetLeagueByInviteCode(ctx context.Context, code string) (*domain.FantasyLeague, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	query := `
		SELECT id, season_id, name, type, COALESCE(invite_code, ''), created_by_user_id,
		       entry_fee, max_members,
		       gross_entry_kobo, platform_cut_kobo, prize_pool_kobo, settled_at,
		       (SELECT COUNT(*) FROM fantasy_league_members flm
		         WHERE flm.league_id = fantasy_leagues.id AND flm.payment_status IN ('FREE', 'PAID')),
		       created_at, updated_at
		FROM fantasy_leagues
		WHERE UPPER(invite_code) = UPPER($1)
	`
	var l domain.FantasyLeague
	err := r.pool.QueryRow(ctx, query, code).Scan(
		&l.ID, &l.SeasonID, &l.Name, &l.Type, &l.InviteCode, &l.CreatedByUserID,
		&l.EntryFee, &l.MaxMembers,
		&l.GrossEntryKobo, &l.PlatformCutKobo, &l.PrizePoolKobo, &l.SettledAt, &l.MemberCount, &l.CreatedAt, &l.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get league by invite code: %w", err)
	}
	return &l, nil
}

func (r *FantasyLeagueRepository) GetOverallLeague(ctx context.Context, seasonID string) (*domain.FantasyLeague, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	query := `
		SELECT id, season_id, name, type, COALESCE(invite_code, ''), created_by_user_id,
		       entry_fee, max_members,
		       gross_entry_kobo, platform_cut_kobo, prize_pool_kobo, settled_at,
		       (SELECT COUNT(*) FROM fantasy_league_members flm
		         WHERE flm.league_id = fantasy_leagues.id AND flm.payment_status IN ('FREE', 'PAID')),
		       created_at, updated_at
		FROM fantasy_leagues
		WHERE season_id = $1 AND type = 'OVERALL'
		ORDER BY created_at ASC
		LIMIT 1
	`
	var l domain.FantasyLeague
	err := r.pool.QueryRow(ctx, query, seasonID).Scan(
		&l.ID, &l.SeasonID, &l.Name, &l.Type, &l.InviteCode, &l.CreatedByUserID,
		&l.EntryFee, &l.MaxMembers,
		&l.GrossEntryKobo, &l.PlatformCutKobo, &l.PrizePoolKobo, &l.SettledAt, &l.MemberCount, &l.CreatedAt, &l.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get overall league: %w", err)
	}
	return &l, nil
}

func (r *FantasyLeagueRepository) ListLeaguesByUser(ctx context.Context, userID, seasonID string) ([]domain.FantasyLeague, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	query := `
		SELECT fl.id, fl.season_id, fl.name, fl.type, COALESCE(fl.invite_code, ''), fl.created_by_user_id,
		       fl.entry_fee, fl.max_members,
		       fl.gross_entry_kobo, fl.platform_cut_kobo, fl.prize_pool_kobo, fl.settled_at,
		       (SELECT COUNT(*) FROM fantasy_league_members m
		         WHERE m.league_id = fl.id AND m.payment_status IN ('FREE', 'PAID')),
		       fl.created_at, fl.updated_at
		FROM fantasy_leagues fl
		JOIN fantasy_league_members flm ON flm.league_id = fl.id
		WHERE flm.user_id = $1 AND fl.season_id = $2 AND flm.payment_status IN ('FREE', 'PAID')
		ORDER BY fl.created_at DESC
	`
	rows, err := r.pool.Query(ctx, query, userID, seasonID)
	if err != nil {
		return nil, fmt.Errorf("failed to list user leagues: %w", err)
	}
	defer rows.Close()

	var list []domain.FantasyLeague
	for rows.Next() {
		var l domain.FantasyLeague
		if err := rows.Scan(
			&l.ID, &l.SeasonID, &l.Name, &l.Type, &l.InviteCode, &l.CreatedByUserID,
			&l.EntryFee, &l.MaxMembers,
			&l.GrossEntryKobo, &l.PlatformCutKobo, &l.PrizePoolKobo, &l.SettledAt, &l.MemberCount, &l.CreatedAt, &l.UpdatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, l)
	}
	return list, nil
}

func (r *FantasyLeagueRepository) ListPublicLeagues(ctx context.Context, seasonID string) ([]domain.FantasyLeague, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	// OVERALL is deliberately excluded: it is the system-wide league every team
	// is in, and listing it here would expose its invite code in the browse list.
	query := `
		SELECT id, season_id, name, type, COALESCE(invite_code, ''), created_by_user_id,
		       entry_fee, max_members,
		       gross_entry_kobo, platform_cut_kobo, prize_pool_kobo, settled_at,
		       (SELECT COUNT(*) FROM fantasy_league_members flm
		         WHERE flm.league_id = fantasy_leagues.id AND flm.payment_status IN ('FREE', 'PAID')),
		       created_at, updated_at
		FROM fantasy_leagues
		WHERE season_id = $1 AND type = 'PUBLIC'
		ORDER BY created_at ASC
	`
	rows, err := r.pool.Query(ctx, query, seasonID)
	if err != nil {
		return nil, fmt.Errorf("failed to list public leagues: %w", err)
	}
	defer rows.Close()

	var list []domain.FantasyLeague
	for rows.Next() {
		var l domain.FantasyLeague
		if err := rows.Scan(
			&l.ID, &l.SeasonID, &l.Name, &l.Type, &l.InviteCode, &l.CreatedByUserID,
			&l.EntryFee, &l.MaxMembers,
			&l.GrossEntryKobo, &l.PlatformCutKobo, &l.PrizePoolKobo, &l.SettledAt, &l.MemberCount, &l.CreatedAt, &l.UpdatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, l)
	}
	return list, nil
}

func (r *FantasyLeagueRepository) AddMember(ctx context.Context, m *domain.FantasyLeagueMember) error {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// FOR UPDATE serialises concurrent joins on the same league, so two racing
	// requests can't both read a not-yet-full count and overshoot max_members.
	var maxMembers int
	if err := tx.QueryRow(ctx, `SELECT max_members FROM fantasy_leagues WHERE id = $1 FOR UPDATE`, m.LeagueID).Scan(&maxMembers); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return errors.New("league not found")
		}
		return fmt.Errorf("failed to lock league: %w", err)
	}

	if maxMembers > 0 {
		var active int
		countQuery := `
			SELECT COUNT(*) FROM fantasy_league_members
			WHERE league_id = $1 AND payment_status IN ('FREE', 'PAID')
		`
		if err := tx.QueryRow(ctx, countQuery, m.LeagueID).Scan(&active); err != nil {
			return fmt.Errorf("failed to count league members: %w", err)
		}

		// Only a brand-new membership consumes a slot; an existing member
		// re-upserting (retrying a payment, say) must never be turned away.
		var alreadyMember bool
		existsQuery := `SELECT EXISTS(SELECT 1 FROM fantasy_league_members WHERE league_id = $1 AND user_id = $2)`
		if err := tx.QueryRow(ctx, existsQuery, m.LeagueID, m.UserID).Scan(&alreadyMember); err != nil {
			return fmt.Errorf("failed to check existing membership: %w", err)
		}

		if !alreadyMember && active >= maxMembers {
			return ErrLeagueFull
		}
	}

	query := `
		INSERT INTO fantasy_league_members (league_id, user_id, team_id, payment_status, paystack_reference, paystack_access_code)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (league_id, user_id) DO UPDATE
		SET payment_status = EXCLUDED.payment_status,
		    paystack_reference = COALESCE(EXCLUDED.paystack_reference, fantasy_league_members.paystack_reference),
		    paystack_access_code = COALESCE(EXCLUDED.paystack_access_code, fantasy_league_members.paystack_access_code)
		RETURNING id, joined_at
	`
	if err := tx.QueryRow(ctx, query,
		m.LeagueID, m.UserID, m.TeamID, m.PaymentStatus, m.PaystackReference, m.PaystackAccessCode,
	).Scan(&m.ID, &m.JoinedAt); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *FantasyLeagueRepository) CountActiveMembers(ctx context.Context, leagueID string) (int, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	query := `
		SELECT COUNT(*) FROM fantasy_league_members
		WHERE league_id = $1 AND payment_status IN ('FREE', 'PAID')
	`
	var count int
	if err := r.pool.QueryRow(ctx, query, leagueID).Scan(&count); err != nil {
		return 0, fmt.Errorf("failed to count league members: %w", err)
	}
	return count, nil
}

func (r *FantasyLeagueRepository) GetMember(ctx context.Context, leagueID, userID string) (*domain.FantasyLeagueMember, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	query := `
		SELECT id, league_id, user_id, team_id, payment_status, paystack_reference, paystack_access_code, joined_at
		FROM fantasy_league_members
		WHERE league_id = $1 AND user_id = $2
	`
	var m domain.FantasyLeagueMember
	err := r.pool.QueryRow(ctx, query, leagueID, userID).Scan(
		&m.ID, &m.LeagueID, &m.UserID, &m.TeamID, &m.PaymentStatus,
		&m.PaystackReference, &m.PaystackAccessCode, &m.JoinedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get league member: %w", err)
	}
	return &m, nil
}

func (r *FantasyLeagueRepository) GetMemberByPaystackRef(ctx context.Context, ref string) (*domain.FantasyLeagueMember, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	query := `
		SELECT id, league_id, user_id, team_id, payment_status, paystack_reference, paystack_access_code, joined_at
		FROM fantasy_league_members
		WHERE paystack_reference = $1
	`
	var m domain.FantasyLeagueMember
	err := r.pool.QueryRow(ctx, query, ref).Scan(
		&m.ID, &m.LeagueID, &m.UserID, &m.TeamID, &m.PaymentStatus,
		&m.PaystackReference, &m.PaystackAccessCode, &m.JoinedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get league member by paystack reference: %w", err)
	}
	return &m, nil
}

func (r *FantasyLeagueRepository) UpdateMemberPaymentStatus(ctx context.Context, id string, status domain.FantasyLeaguePaymentStatus) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	query := `UPDATE fantasy_league_members SET payment_status = $1 WHERE id = $2`
	_, err := r.pool.Exec(ctx, query, status, id)
	return err
}

func (r *FantasyLeagueRepository) GetLeaderboard(ctx context.Context, leagueID string, gameweekID *string, page, limit int) ([]dto.LeaderboardEntry, int, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 50
	}
	offset := (page - 1) * limit

	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var total int
	countQuery := `
		SELECT COUNT(flm.id)
		FROM fantasy_league_members flm
		WHERE flm.league_id = $1 AND flm.payment_status IN ('FREE', 'PAID')
	`
	if err := r.pool.QueryRow(ctx, countQuery, leagueID).Scan(&total); err != nil {
		return nil, 0, err
	}

	var query string
	var args []interface{}

	if gameweekID != nil {
		query = `
			SELECT u.id, COALESCE(u.full_name, ''), ft.name, ft.id,
			       COALESCE(fl.points, 0.000) as gw_pts,
			       COALESCE(ft.total_points, 0.000) as tot_pts
			FROM fantasy_league_members flm
			JOIN fantasy_teams ft ON flm.team_id = ft.id
			JOIN users u ON flm.user_id = u.id
			LEFT JOIN fantasy_lineups fl ON fl.team_id = ft.id AND fl.gameweek_id = $2 AND fl.status = 'LOCKED'
			WHERE flm.league_id = $1 AND flm.payment_status IN ('FREE', 'PAID')
			ORDER BY gw_pts DESC, tot_pts DESC, u.full_name ASC
			LIMIT $3 OFFSET $4
		`
		args = []interface{}{leagueID, *gameweekID, limit, offset}
	} else {
		query = `
			SELECT u.id, COALESCE(u.full_name, ''), ft.name, ft.id,
			       0.000 as gw_pts,
			       COALESCE(ft.total_points, 0.000) as tot_pts
			FROM fantasy_league_members flm
			JOIN fantasy_teams ft ON flm.team_id = ft.id
			JOIN users u ON flm.user_id = u.id
			WHERE flm.league_id = $1 AND flm.payment_status IN ('FREE', 'PAID')
			ORDER BY tot_pts DESC, u.full_name ASC
			LIMIT $2 OFFSET $3
		`
		args = []interface{}{leagueID, limit, offset}
	}

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query league leaderboard: %w", err)
	}
	defer rows.Close()

	var list []dto.LeaderboardEntry
	rank := offset + 1
	for rows.Next() {
		var item dto.LeaderboardEntry
		if err := rows.Scan(
			&item.UserID, &item.UserName, &item.TeamName, &item.TeamID,
			&item.GWPoints, &item.TotalPoints,
		); err != nil {
			return nil, 0, err
		}
		item.Rank = rank
		rank++
		list = append(list, item)
	}
	return list, total, nil
}

func (r *FantasyLeagueRepository) GetOverallLeaderboard(ctx context.Context, seasonID string, gameweekID *string, page, limit int) ([]dto.LeaderboardEntry, int, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 50
	}
	offset := (page - 1) * limit

	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var total int
	countQuery := `SELECT COUNT(id) FROM fantasy_teams WHERE season_id = $1`
	if err := r.pool.QueryRow(ctx, countQuery, seasonID).Scan(&total); err != nil {
		return nil, 0, err
	}

	var query string
	var args []interface{}

	if gameweekID != nil {
		query = `
			SELECT u.id, COALESCE(u.full_name, ''), ft.name, ft.id,
			       COALESCE(fl.points, 0.000) as gw_pts,
			       COALESCE(ft.total_points, 0.000) as tot_pts
			FROM fantasy_teams ft
			JOIN users u ON ft.user_id = u.id
			LEFT JOIN fantasy_lineups fl ON fl.team_id = ft.id AND fl.gameweek_id = $2 AND fl.status = 'LOCKED'
			WHERE ft.season_id = $1
			ORDER BY gw_pts DESC, tot_pts DESC, u.full_name ASC
			LIMIT $3 OFFSET $4
		`
		args = []interface{}{seasonID, *gameweekID, limit, offset}
	} else {
		query = `
			SELECT u.id, COALESCE(u.full_name, ''), ft.name, ft.id,
			       0.000 as gw_pts,
			       COALESCE(ft.total_points, 0.000) as tot_pts
			FROM fantasy_teams ft
			JOIN users u ON ft.user_id = u.id
			WHERE ft.season_id = $1
			ORDER BY tot_pts DESC, u.full_name ASC
			LIMIT $2 OFFSET $3
		`
		args = []interface{}{seasonID, limit, offset}
	}

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query overall leaderboard: %w", err)
	}
	defer rows.Close()

	var list []dto.LeaderboardEntry
	rank := offset + 1
	for rows.Next() {
		var item dto.LeaderboardEntry
		if err := rows.Scan(
			&item.UserID, &item.UserName, &item.TeamName, &item.TeamID,
			&item.GWPoints, &item.TotalPoints,
		); err != nil {
			return nil, 0, err
		}
		item.Rank = rank
		rank++
		list = append(list, item)
	}
	return list, total, nil
}
