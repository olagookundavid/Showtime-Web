package ports

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ExpiringContract is one player in a contract-expiry summary: either still under
// contract with three or fewer team matches left, or recently expired and not yet
// signed by anyone.
type ExpiringContract struct {
	ContractID     string
	PlayerID       string
	PlayerName     string
	Position       string
	TeamID         string
	TeamName       string
	ContractLength int
	// Remaining is team matches left; 0 once expired.
	Remaining int
	// ExpiredAt is set only for an expired contract.
	ExpiredAt *time.Time
	// HasAccount says whether the player can accept an offer themselves.
	HasAccount bool
	// OfferPending says the team has already sent this player a new offer.
	OfferPending bool
}

// DigestRecipient is someone a summary goes to.
type DigestRecipient struct {
	UserID string
	Name   string
	Email  string
	Role   string
}

type IContractDigestRepository interface {
	// ListExpiring returns the at-risk (warnMatches or fewer matches left) and recently
	// expired contracts, for the given teams or for every team when teamIDs is empty.
	// Expired contracts count from expiredSince on.
	ListExpiring(ctx context.Context, teamIDs []string, warnMatches int, expiredSince time.Time) ([]ExpiringContract, error)
	TeamManagers(ctx context.Context, teamID string) ([]DigestRecipient, error)
	// UsersByIDs resolves chosen recipients, dropping ids that no longer exist.
	UsersByIDs(ctx context.Context, ids []string) ([]DigestRecipient, error)
	// SearchStaffUsers finds people who could be chosen as recipients: anyone with a
	// role above plain user and player, matched on name or email.
	SearchStaffUsers(ctx context.Context, search string, limit int) ([]DigestRecipient, error)
}

type ContractDigestRepository struct {
	db *pgxpool.Pool
}

func NewContractDigestRepository(db *pgxpool.Pool) IContractDigestRepository {
	return &ContractDigestRepository{db: db}
}

func (r *ContractDigestRepository) ListExpiring(ctx context.Context, teamIDs []string, warnMatches int, expiredSince time.Time) ([]ExpiringContract, error) {
	query := `
		WITH finished AS (
			SELECT t.id AS team_id, count(m.id) FILTER (WHERE m.status = 'FINISHED') AS n
			FROM teams t
			LEFT JOIN matches m ON t.id IN (m.home_team_id, m.away_team_id)
			GROUP BY t.id
		), candidates AS (
			SELECT DISTINCT ON (c.player_id)
			       c.id, c.player_id, c.team_id, c.status, c.contract_length,
			       GREATEST(c.contract_length - (f.n - c.matches_at_start), 0) AS remaining,
			       c.expired_at
			FROM contracts c
			JOIN finished f ON f.team_id = c.team_id
			WHERE (c.status = 'ACTIVE' AND c.contract_length - (f.n - c.matches_at_start) <= $1)
			   OR (c.status = 'EXPIRED' AND c.expired_at >= $2
			       AND NOT EXISTS (SELECT 1 FROM contracts ac WHERE ac.player_id = c.player_id AND ac.status = 'ACTIVE'))
			ORDER BY c.player_id, (c.status = 'ACTIVE') DESC, c.expired_at DESC NULLS LAST
		)
		SELECT k.id, k.player_id, p.name, COALESCE(p.position, ''), k.team_id, t.name, k.contract_length,
		       CASE WHEN k.status = 'EXPIRED' THEN 0 ELSE k.remaining END,
		       CASE WHEN k.status = 'EXPIRED' THEN k.expired_at END,
		       p.user_id IS NOT NULL,
		       EXISTS (SELECT 1 FROM contracts pc WHERE pc.player_id = k.player_id AND pc.team_id = k.team_id AND pc.status = 'PENDING')
		FROM candidates k
		JOIN players p ON p.id = k.player_id
		JOIN teams t ON t.id = k.team_id
		WHERE COALESCE(p.status, 'active') = 'active'
		  AND (cardinality($3::uuid[]) = 0 OR k.team_id = ANY($3::uuid[]))
		ORDER BY t.name, 8, p.name`

	if teamIDs == nil {
		teamIDs = []string{}
	}
	rows, err := r.db.Query(ctx, query, warnMatches, expiredSince, teamIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []ExpiringContract
	for rows.Next() {
		var e ExpiringContract
		if err := rows.Scan(&e.ContractID, &e.PlayerID, &e.PlayerName, &e.Position, &e.TeamID, &e.TeamName,
			&e.ContractLength, &e.Remaining, &e.ExpiredAt, &e.HasAccount, &e.OfferPending); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (r *ContractDigestRepository) TeamManagers(ctx context.Context, teamID string) ([]DigestRecipient, error) {
	return r.recipients(ctx, `
		SELECT u.id, COALESCE(NULLIF(u.first_name, ''), u.full_name), u.email, u.role
		FROM team_managers tm JOIN users u ON u.id = tm.user_id
		WHERE tm.team_id = $1
		ORDER BY tm.created_at`, teamID)
}

func (r *ContractDigestRepository) UsersByIDs(ctx context.Context, ids []string) ([]DigestRecipient, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	return r.recipients(ctx, `
		SELECT u.id, COALESCE(NULLIF(u.first_name, ''), u.full_name), u.email, u.role
		FROM users u WHERE u.id = ANY($1::uuid[])
		ORDER BY u.full_name`, ids)
}

func (r *ContractDigestRepository) SearchStaffUsers(ctx context.Context, search string, limit int) ([]DigestRecipient, error) {
	if limit < 1 || limit > 50 {
		limit = 20
	}
	return r.recipients(ctx, `
		SELECT u.id, u.full_name, u.email, u.role
		FROM users u
		WHERE u.role NOT IN ('user', 'player', 'player_pending')
		  AND ($1 = '' OR u.full_name ILIKE '%' || $1 || '%' OR u.email ILIKE '%' || $1 || '%')
		ORDER BY u.full_name
		LIMIT $2`, search, limit)
}

func (r *ContractDigestRepository) recipients(ctx context.Context, query string, args ...any) ([]DigestRecipient, error) {
	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []DigestRecipient
	for rows.Next() {
		var d DigestRecipient
		if err := rows.Scan(&d.UserID, &d.Name, &d.Email, &d.Role); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}
