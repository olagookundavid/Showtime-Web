package ports

import (
	"context"
	"strconv"
	"time"

	"showtime-backend/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type IContractRepository interface {
	CreateContract(ctx context.Context, c *domain.Contract) error
	GetContractByID(ctx context.Context, id string) (*domain.Contract, error)
	GetActiveContractByPlayerID(ctx context.Context, playerID string) (*domain.Contract, error)
	GetContractsByTeamID(ctx context.Context, teamID string, status string, search string, page, limit int) ([]domain.Contract, int64, error)
	GetPendingContractsByPlayerID(ctx context.Context, playerID string) ([]domain.Contract, error)
	GetContractsByPlayerID(ctx context.Context, playerID string) ([]domain.Contract, error)
	UpdateContractStatus(ctx context.Context, id string, status string, terminationReason string, acceptedAt, expiredAt, terminatedAt *time.Time) error
	ReactivateContract(ctx context.Context, id string) error
	GetFreeAgents(ctx context.Context, search string, page, limit int) ([]domain.Player, int64, error)
	GetTeamFinishedMatchCount(ctx context.Context, teamID string) (int, error)
	GetExpiringContracts(ctx context.Context, teamIDs ...string) ([]domain.Contract, error)
	// UpdateLastNotifiedRemaining records which "matches left" warning a contract has had.
	// claimed is false when it already had this one, so two overlapping expiry runs
	// (the 10-minute job and a match finishing) can't both announce it.
	UpdateLastNotifiedRemaining(ctx context.Context, id string, remaining int) (claimed bool, err error)
	// GetLastContractByPlayerID is the player's most recent contract that ever took
	// effect (ACTIVE, EXPIRED or TERMINATED), or nil.
	GetLastContractByPlayerID(ctx context.Context, playerID string) (*domain.Contract, error)
	// GetResignablePlayers is every free agent whose last contract expired with teamID:
	// the team's own players it may re-sign outside a transfer window.
	GetResignablePlayers(ctx context.Context, teamID string) ([]ResignablePlayer, error)
	RemovePlayerFromScheduledTeamSheets(ctx context.Context, playerID, teamID string) error
	CancelContract(ctx context.Context, id string) error
}

// ResignablePlayer is a free agent whose last contract ran out with the team asking.
type ResignablePlayer struct {
	PlayerID       string
	Name           string
	Position       string
	Image          string
	JerseyNumber   int
	UserID         *string
	ContractLength int
	ExpiredAt      time.Time
	OfferPending   bool
}

type PostgresContractRepository struct {
	db *pgxpool.Pool
}

func NewContractRepository(db *pgxpool.Pool) IContractRepository {
	return &PostgresContractRepository{db: db}
}

// AutoProvisionActiveContracts was removed in migration 067. It was a one-time
// backfill for the historical player import, but it was wired into the read path of
// GetContractsByTeamID, so it re-ran on every contracts page load. Its second
// statement was not team-scoped and reset every auto-provisioned row from EXPIRED
// back to ACTIVE, which both undid every contract expiry and inserted a fresh
// duplicate each cycle — 9,045 ACTIVE contracts across 853 players. New players are
// given their first 10-match contract explicitly at creation instead.

func (r *PostgresContractRepository) CancelContract(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx, `UPDATE contracts SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1 AND status = 'PENDING'`, id)
	return err
}

func (r *PostgresContractRepository) CreateContract(ctx context.Context, c *domain.Contract) error {
	// offered_by is NULLIF'd for the same reason as players.team_id: domain.Contract
	// .OfferedBy is a plain string, and a system-issued contract has no offering
	// manager, so "" would otherwise be cast into a UUID column and fail the insert.
	query := `
		INSERT INTO contracts (
			player_id, team_id, status, contract_length, matches_at_start,
			player_value, offered_by, offered_at, notes, accepted_at
		) VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7::text, '')::uuid, NOW(), $8,
			CASE WHEN $3::text = 'ACTIVE' THEN NOW() END)
		RETURNING id, offered_at, created_at, updated_at
	`
	return r.db.QueryRow(ctx, query,
		c.PlayerID, c.TeamID, c.Status, c.ContractLength, c.MatchesAtStart,
		c.PlayerValue, c.OfferedBy, c.Notes,
	).Scan(&c.ID, &c.OfferedAt, &c.CreatedAt, &c.UpdatedAt)
}

func (r *PostgresContractRepository) GetContractByID(ctx context.Context, id string) (*domain.Contract, error) {
	query := `
		SELECT
			c.id, c.player_id, c.team_id, c.status, c.contract_length, c.matches_at_start,
			c.player_value, COALESCE(c.offered_by::text, ''), c.offered_at,
			c.accepted_at, c.expired_at, c.terminated_at, COALESCE(c.termination_reason, ''),
			COALESCE(c.notes, ''), c.created_at, c.updated_at,
			p.name, COALESCE(p.position, '-'), COALESCE(p.jersey_number, 0), COALESCE(p.image, ''),
			t.name, COALESCE(t.short_name, ''), COALESCE(t.logo, '')
		FROM contracts c
		JOIN players p ON c.player_id = p.id
		JOIN teams t ON c.team_id = t.id
		WHERE c.id = $1
	`
	var c domain.Contract
	c.Player = &domain.Player{}
	c.Team = &domain.Team{}
	err := r.db.QueryRow(ctx, query, id).Scan(
		&c.ID, &c.PlayerID, &c.TeamID, &c.Status, &c.ContractLength, &c.MatchesAtStart,
		&c.PlayerValue, &c.OfferedBy, &c.OfferedAt,
		&c.AcceptedAt, &c.ExpiredAt, &c.TerminatedAt, &c.TerminationReason,
		&c.Notes, &c.CreatedAt, &c.UpdatedAt,
		&c.Player.Name, &c.Player.Position, &c.Player.JerseyNumber, &c.Player.Image,
		&c.Team.Name, &c.Team.ShortName, &c.Team.Logo,
	)
	if err != nil {
		return nil, err
	}
	c.Player.ID = c.PlayerID
	c.Team.ID = c.TeamID
	return &c, nil
}

func (r *PostgresContractRepository) GetActiveContractByPlayerID(ctx context.Context, playerID string) (*domain.Contract, error) {
	query := `
		SELECT
			c.id, c.player_id, c.team_id, c.status, c.contract_length, c.matches_at_start,
			c.player_value, COALESCE(c.offered_by::text, ''), c.offered_at,
			c.accepted_at, c.expired_at, c.terminated_at, COALESCE(c.termination_reason, ''),
			COALESCE(c.notes, ''), c.created_at, c.updated_at
		FROM contracts c
		WHERE c.player_id = $1 AND c.status = 'ACTIVE'
		ORDER BY c.created_at DESC LIMIT 1
	`
	var c domain.Contract
	err := r.db.QueryRow(ctx, query, playerID).Scan(
		&c.ID, &c.PlayerID, &c.TeamID, &c.Status, &c.ContractLength, &c.MatchesAtStart,
		&c.PlayerValue, &c.OfferedBy, &c.OfferedAt,
		&c.AcceptedAt, &c.ExpiredAt, &c.TerminatedAt, &c.TerminationReason,
		&c.Notes, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *PostgresContractRepository) GetContractsByTeamID(ctx context.Context, teamID string, status string, search string, page, limit int) ([]domain.Contract, int64, error) {
	whereClause := ` WHERE 1=1`
	args := []any{}
	argCount := 1

	if teamID != "" {
		whereClause += ` AND c.team_id = $` + strconv.Itoa(argCount)
		args = append(args, teamID)
		argCount++
	}

	if status != "" {
		whereClause += ` AND c.status = $` + strconv.Itoa(argCount)
		args = append(args, status)
		argCount++
	}

	if search != "" {
		whereClause += ` AND (p.name ILIKE $` + strconv.Itoa(argCount) + ` OR t.name ILIKE $` + strconv.Itoa(argCount) + `)`
		args = append(args, "%"+search+"%")
		argCount++
	}

	countQuery := `
		SELECT COUNT(*)
		FROM contracts c
		JOIN players p ON c.player_id = p.id
		JOIN teams t ON c.team_id = t.id` + whereClause

	var total int64
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := `
		SELECT
			c.id, c.player_id, c.team_id, c.status, c.contract_length, c.matches_at_start,
			c.player_value, COALESCE(c.offered_by::text, ''), c.offered_at,
			c.accepted_at, c.expired_at, c.terminated_at, COALESCE(c.termination_reason, ''),
			COALESCE(c.notes, ''), c.created_at, c.updated_at,
			p.name, COALESCE(p.position, '-'), COALESCE(p.jersey_number, 0), COALESCE(p.image, ''),
			t.name, COALESCE(t.short_name, ''), COALESCE(t.logo, '')
		FROM contracts c
		JOIN players p ON c.player_id = p.id
		JOIN teams t ON c.team_id = t.id` + whereClause +
		` ORDER BY c.created_at DESC`

	if limit > 0 {
		offset := (page - 1) * limit
		if offset < 0 {
			offset = 0
		}
		query += ` LIMIT $` + strconv.Itoa(argCount) + ` OFFSET $` + strconv.Itoa(argCount+1)
		args = append(args, limit, offset)
	}

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var contracts []domain.Contract
	for rows.Next() {
		var c domain.Contract
		c.Player = &domain.Player{}
		c.Team = &domain.Team{}
		err := rows.Scan(
			&c.ID, &c.PlayerID, &c.TeamID, &c.Status, &c.ContractLength, &c.MatchesAtStart,
			&c.PlayerValue, &c.OfferedBy, &c.OfferedAt,
			&c.AcceptedAt, &c.ExpiredAt, &c.TerminatedAt, &c.TerminationReason,
			&c.Notes, &c.CreatedAt, &c.UpdatedAt,
			&c.Player.Name, &c.Player.Position, &c.Player.JerseyNumber, &c.Player.Image,
			&c.Team.Name, &c.Team.ShortName, &c.Team.Logo,
		)
		if err != nil {
			return nil, 0, err
		}
		c.Player.ID = c.PlayerID
		c.Team.ID = c.TeamID
		contracts = append(contracts, c)
	}
	return contracts, total, nil
}

func (r *PostgresContractRepository) GetPendingContractsByPlayerID(ctx context.Context, playerID string) ([]domain.Contract, error) {
	query := `
		SELECT
			c.id, c.player_id, c.team_id, c.status, c.contract_length, c.matches_at_start,
			c.player_value, COALESCE(c.offered_by::text, ''), c.offered_at,
			c.accepted_at, c.expired_at, c.terminated_at, COALESCE(c.termination_reason, ''),
			COALESCE(c.notes, ''), c.created_at, c.updated_at,
			t.name, COALESCE(t.short_name, ''), COALESCE(t.logo, '')
		FROM contracts c
		JOIN teams t ON c.team_id = t.id
		WHERE c.player_id = $1 AND c.status = 'PENDING'
		ORDER BY c.created_at DESC
	`
	rows, err := r.db.Query(ctx, query, playerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var contracts []domain.Contract
	for rows.Next() {
		var c domain.Contract
		c.Team = &domain.Team{}
		err := rows.Scan(
			&c.ID, &c.PlayerID, &c.TeamID, &c.Status, &c.ContractLength, &c.MatchesAtStart,
			&c.PlayerValue, &c.OfferedBy, &c.OfferedAt,
			&c.AcceptedAt, &c.ExpiredAt, &c.TerminatedAt, &c.TerminationReason,
			&c.Notes, &c.CreatedAt, &c.UpdatedAt,
			&c.Team.Name, &c.Team.ShortName, &c.Team.Logo,
		)
		if err != nil {
			return nil, err
		}
		c.Team.ID = c.TeamID
		contracts = append(contracts, c)
	}
	return contracts, nil
}

func (r *PostgresContractRepository) GetContractsByPlayerID(ctx context.Context, playerID string) ([]domain.Contract, error) {
	query := `
		SELECT
			c.id, c.player_id, c.team_id, c.status, c.contract_length, c.matches_at_start,
			c.player_value, COALESCE(c.offered_by::text, ''), c.offered_at,
			c.accepted_at, c.expired_at, c.terminated_at, COALESCE(c.termination_reason, ''),
			COALESCE(c.notes, ''), c.created_at, c.updated_at,
			t.name, COALESCE(t.short_name, ''), COALESCE(t.logo, '')
		FROM contracts c
		JOIN teams t ON c.team_id = t.id
		WHERE c.player_id = $1
		ORDER BY c.created_at DESC
	`
	rows, err := r.db.Query(ctx, query, playerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var contracts []domain.Contract
	for rows.Next() {
		var c domain.Contract
		c.Team = &domain.Team{}
		err := rows.Scan(
			&c.ID, &c.PlayerID, &c.TeamID, &c.Status, &c.ContractLength, &c.MatchesAtStart,
			&c.PlayerValue, &c.OfferedBy, &c.OfferedAt,
			&c.AcceptedAt, &c.ExpiredAt, &c.TerminatedAt, &c.TerminationReason,
			&c.Notes, &c.CreatedAt, &c.UpdatedAt,
			&c.Team.Name, &c.Team.ShortName, &c.Team.Logo,
		)
		if err != nil {
			return nil, err
		}
		c.Team.ID = c.TeamID
		contracts = append(contracts, c)
	}
	return contracts, nil
}

func (r *PostgresContractRepository) UpdateContractStatus(ctx context.Context, id string, status string, terminationReason string, acceptedAt, expiredAt, terminatedAt *time.Time) error {
	query := `
		UPDATE contracts SET
			status = $1,
			termination_reason = NULLIF($2, ''),
			accepted_at = COALESCE($3, accepted_at),
			expired_at = COALESCE($4, expired_at),
			terminated_at = COALESCE($5, terminated_at),
			updated_at = NOW()
		WHERE id = $6
	`
	_, err := r.db.Exec(ctx, query, status, terminationReason, acceptedAt, expiredAt, terminatedAt, id)
	return err
}

// ReactivateContract undoes a termination that was applied as part of a
// transfer which then failed. UpdateContractStatus COALESCEs terminated_at, so
// it cannot clear the timestamp — this explicitly nulls both it and the
// termination reason to leave the contract exactly as it was before.
func (r *PostgresContractRepository) ReactivateContract(ctx context.Context, id string) error {
	query := `
		UPDATE contracts SET
			status = 'ACTIVE',
			termination_reason = NULL,
			terminated_at = NULL,
			updated_at = NOW()
		WHERE id = $1
	`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *PostgresContractRepository) GetFreeAgents(ctx context.Context, search string, page, limit int) ([]domain.Player, int64, error) {
	// COALESCE'd so rows written before migration 088 added the column still read
	// as active. A deactivated player is not signable — leaving them here would
	// let a club re-sign someone an admin had just switched off.
	whereClause := ` WHERE NOT EXISTS (SELECT 1 FROM contracts c WHERE c.player_id = p.id AND c.status = 'ACTIVE') AND (p.team_id IS NULL OR TRIM(COALESCE(p.team_id::text, '')) = '') AND COALESCE(p.status, 'active') = 'active'`
	args := []any{}
	argCount := 1

	if search != "" {
		whereClause += ` AND (p.name ILIKE $` + strconv.Itoa(argCount) + ` OR p.position ILIKE $` + strconv.Itoa(argCount) + `)`
		args = append(args, "%"+search+"%")
		argCount++
	}

	var total int64
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM players p`+whereClause, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := `
		SELECT
			p.id, p.name, COALESCE(p.jersey_number, 0), COALESCE(p.position, '-'),
			COALESCE(p.gender, ''),
			COALESCE(p.team_id::text, ''), COALESCE(p.bio, ''), COALESCE(p.image, ''),
			p.email, p.user_id, p.created_at, p.updated_at
		FROM players p` + whereClause + ` ORDER BY p.name ASC`

	if limit > 0 {
		offset := (page - 1) * limit
		if offset < 0 {
			offset = 0
		}
		query += ` LIMIT $` + strconv.Itoa(argCount) + ` OFFSET $` + strconv.Itoa(argCount+1)
		args = append(args, limit, offset)
	}

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var players []domain.Player
	for rows.Next() {
		var p domain.Player
		var uid *string
		err := rows.Scan(
			&p.ID, &p.Name, &p.JerseyNumber, &p.Position,
			&p.Gender,
			&p.TeamID, &p.Bio, &p.Image, &p.Email, &uid,
			&p.CreatedAt, &p.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		p.UserID = uid
		players = append(players, p)
	}
	return players, total, nil
}

func (r *PostgresContractRepository) GetTeamFinishedMatchCount(ctx context.Context, teamID string) (int, error) {
	query := `
		SELECT COUNT(*) FROM matches
		WHERE (home_team_id = $1 OR away_team_id = $1) AND status = 'FINISHED'
	`
	var count int
	err := r.db.QueryRow(ctx, query, teamID).Scan(&count)
	return count, err
}

func (r *PostgresContractRepository) GetExpiringContracts(ctx context.Context, teamIDs ...string) ([]domain.Contract, error) {
	query := `
		SELECT
			c.id, c.player_id, c.team_id, c.status, c.contract_length, c.matches_at_start,
			c.player_value, COALESCE(c.offered_by::text, ''), c.offered_at,
			c.accepted_at, c.expired_at, c.terminated_at, COALESCE(c.termination_reason, ''),
			COALESCE(c.notes, ''), COALESCE(c.last_notified_remaining, -1), c.created_at, c.updated_at
		FROM contracts c
		WHERE c.status = 'ACTIVE'
	`
	args := []any{}
	if len(teamIDs) > 0 {
		query += ` AND c.team_id = ANY($1)`
		args = append(args, teamIDs)
	}

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var contracts []domain.Contract
	for rows.Next() {
		var c domain.Contract
		err := rows.Scan(
			&c.ID, &c.PlayerID, &c.TeamID, &c.Status, &c.ContractLength, &c.MatchesAtStart,
			&c.PlayerValue, &c.OfferedBy, &c.OfferedAt,
			&c.AcceptedAt, &c.ExpiredAt, &c.TerminatedAt, &c.TerminationReason,
			&c.Notes, &c.LastNotifiedRemaining, &c.CreatedAt, &c.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		contracts = append(contracts, c)
	}
	return contracts, nil
}

func (r *PostgresContractRepository) UpdateLastNotifiedRemaining(ctx context.Context, id string, remaining int) (bool, error) {
	query := `UPDATE contracts SET last_notified_remaining = $1, updated_at = NOW()
		WHERE id = $2 AND last_notified_remaining IS DISTINCT FROM $1`
	tag, err := r.db.Exec(ctx, query, remaining, id)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

func (r *PostgresContractRepository) GetLastContractByPlayerID(ctx context.Context, playerID string) (*domain.Contract, error) {
	query := `
		SELECT id, player_id, team_id, status, contract_length, matches_at_start, expired_at, terminated_at
		FROM contracts
		WHERE player_id = $1 AND status IN ('ACTIVE', 'EXPIRED', 'TERMINATED')
		ORDER BY COALESCE(expired_at, terminated_at, accepted_at, offered_at) DESC
		LIMIT 1`
	var c domain.Contract
	err := r.db.QueryRow(ctx, query, playerID).Scan(
		&c.ID, &c.PlayerID, &c.TeamID, &c.Status, &c.ContractLength, &c.MatchesAtStart, &c.ExpiredAt, &c.TerminatedAt)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *PostgresContractRepository) GetResignablePlayers(ctx context.Context, teamID string) ([]ResignablePlayer, error) {
	query := `
		WITH last_contract AS (
			SELECT DISTINCT ON (c.player_id) c.player_id, c.team_id, c.status, c.contract_length, c.expired_at
			FROM contracts c
			WHERE c.status IN ('ACTIVE', 'EXPIRED', 'TERMINATED')
			ORDER BY c.player_id, COALESCE(c.expired_at, c.terminated_at, c.accepted_at, c.offered_at) DESC
		)
		SELECT p.id, p.name, COALESCE(p.position, ''), COALESCE(p.image, ''), COALESCE(p.jersey_number, 0), p.user_id,
		       lc.contract_length, lc.expired_at,
		       EXISTS (SELECT 1 FROM contracts pc WHERE pc.player_id = p.id AND pc.team_id = $1 AND pc.status = 'PENDING')
		FROM last_contract lc
		JOIN players p ON p.id = lc.player_id
		WHERE lc.team_id = $1 AND lc.status = 'EXPIRED'
		  AND p.team_id IS NULL
		  AND COALESCE(p.status, 'active') = 'active'
		ORDER BY lc.expired_at DESC, p.name`
	rows, err := r.db.Query(ctx, query, teamID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []ResignablePlayer
	for rows.Next() {
		var rp ResignablePlayer
		if err := rows.Scan(&rp.PlayerID, &rp.Name, &rp.Position, &rp.Image, &rp.JerseyNumber, &rp.UserID,
			&rp.ContractLength, &rp.ExpiredAt, &rp.OfferPending); err != nil {
			return nil, err
		}
		out = append(out, rp)
	}
	return out, rows.Err()
}

func (r *PostgresContractRepository) RemovePlayerFromScheduledTeamSheets(ctx context.Context, playerID, teamID string) error {
	query := `
		DELETE FROM match_team_sheets mts
		USING matches m
		WHERE mts.match_id = m.id
		  AND mts.player_id = $1
		  AND mts.team_id = $2
		  AND m.status = 'SCHEDULED'
	`
	_, err := r.db.Exec(ctx, query, playerID, teamID)
	return err
}
