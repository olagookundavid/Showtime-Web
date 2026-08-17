package ports

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"showtime-backend/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrClaimConflict is returned when the one-open-claim-per-player index rejects an
// insert, i.e. somebody else claimed this player first. Callers turn it into a 409.
var ErrClaimConflict = errors.New("this player has already been claimed")

type IClaimRepository interface {
	// Codes
	CreateClaimCode(ctx context.Context, c *domain.TeamClaimCode) error
	RevokeLiveClaimCodesForTeam(ctx context.Context, teamID string) error
	RevokeClaimCodeByID(ctx context.Context, id string, scopedTeamID string) error
	GetLiveClaimCodeByTeam(ctx context.Context, teamID string) (*domain.TeamClaimCode, error)
	ListClaimCodes(ctx context.Context) ([]domain.TeamClaimCode, error)
	GetClaimCodeByCode(ctx context.Context, code string) (*domain.TeamClaimCode, error)
	IncrementClaimCodeUses(ctx context.Context, id string) error

	// Public claim flow
	GetTeamByID(ctx context.Context, teamID string) (*domain.Team, error)
	GetClaimablePlayersByTeam(ctx context.Context, teamID string) ([]domain.Player, error)
	CreateClaimWithAccount(ctx context.Context, claim *domain.PlayerClaim, user domain.User) (string, error)
	GetClaimByVerifyTokenHash(ctx context.Context, tokenHash []byte) (*domain.PlayerClaim, error)
	MarkClaimEmailVerified(ctx context.Context, claimID string) error
	SetClaimVerifyToken(ctx context.Context, claimID string, tokenHash []byte, expires time.Time) error

	// Claimant's own view
	GetClaimByUserID(ctx context.Context, userID string) (*domain.PlayerClaim, error)
	UpdateClaimPhoto(ctx context.Context, claimID, photo string) error

	// Review
	GetClaimByID(ctx context.Context, id string) (*domain.PlayerClaim, error)
	ListClaims(ctx context.Context, teamID, status, search string, page, limit int) ([]domain.PlayerClaim, int64, error)
	GetClaimReviewContext(ctx context.Context, playerID string) (pastTeams []string, matchesPlayed int, err error)
	ApproveClaim(ctx context.Context, claimID, reviewerID string, override domain.Player) (playerID string, createdNewPlayer bool, err error)
	RejectClaim(ctx context.Context, claimID, reviewerID, reason string) error
	RevokeApprovedClaim(ctx context.Context, claimID string) error
}

type PostgresClaimRepository struct {
	db *pgxpool.Pool
}

func NewClaimRepository(db *pgxpool.Pool) IClaimRepository {
	return &PostgresClaimRepository{db: db}
}

// --- Codes ---

func (r *PostgresClaimRepository) CreateClaimCode(ctx context.Context, c *domain.TeamClaimCode) error {
	query := `
		INSERT INTO team_claim_codes (team_id, code, expires_at, max_uses, created_by)
		VALUES ($1, $2, $3, $4, NULLIF($5::text, '')::uuid)
		RETURNING id, uses, created_at
	`
	createdBy := ""
	if c.CreatedBy != nil {
		createdBy = *c.CreatedBy
	}
	return r.db.QueryRow(ctx, query, c.TeamID, c.Code, c.ExpiresAt, c.MaxUses, createdBy).
		Scan(&c.ID, &c.Uses, &c.CreatedAt)
}

func (r *PostgresClaimRepository) RevokeLiveClaimCodesForTeam(ctx context.Context, teamID string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE team_claim_codes SET revoked_at = NOW() WHERE team_id = $1 AND revoked_at IS NULL`, teamID)
	return err
}

func (r *PostgresClaimRepository) RevokeClaimCodeByID(ctx context.Context, id string, scopedTeamID string) error {
	query := `UPDATE team_claim_codes SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL`
	args := []any{id}
	if scopedTeamID != "" {
		query += ` AND team_id = $2`
		args = append(args, scopedTeamID)
	}
	tag, err := r.db.Exec(ctx, query, args...)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errors.New("claim code not found or already revoked")
	}
	return nil
}

const claimCodeColumns = `id, team_id, code, expires_at, max_uses, uses, revoked_at, created_by, created_at`

func scanClaimCode(row pgx.Row) (*domain.TeamClaimCode, error) {
	var c domain.TeamClaimCode
	err := row.Scan(&c.ID, &c.TeamID, &c.Code, &c.ExpiresAt, &c.MaxUses, &c.Uses, &c.RevokedAt, &c.CreatedBy, &c.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *PostgresClaimRepository) GetLiveClaimCodeByTeam(ctx context.Context, teamID string) (*domain.TeamClaimCode, error) {
	row := r.db.QueryRow(ctx,
		`SELECT `+claimCodeColumns+` FROM team_claim_codes WHERE team_id = $1 AND revoked_at IS NULL`, teamID)
	c, err := scanClaimCode(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return c, err
}

func (r *PostgresClaimRepository) ListClaimCodes(ctx context.Context) ([]domain.TeamClaimCode, error) {
	rows, err := r.db.Query(ctx, `
		SELECT c.id, c.team_id, c.code, c.expires_at, c.max_uses, c.uses, c.revoked_at, c.created_by, c.created_at,
		       t.name
		FROM team_claim_codes c
		JOIN teams t ON t.id = c.team_id
		WHERE c.revoked_at IS NULL
		ORDER BY t.name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []domain.TeamClaimCode{}
	for rows.Next() {
		var c domain.TeamClaimCode
		var teamName string
		if err := rows.Scan(&c.ID, &c.TeamID, &c.Code, &c.ExpiresAt, &c.MaxUses, &c.Uses,
			&c.RevokedAt, &c.CreatedBy, &c.CreatedAt, &teamName); err != nil {
			return nil, err
		}
		c.Team = &domain.Team{ID: c.TeamID, Name: teamName}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (r *PostgresClaimRepository) GetClaimCodeByCode(ctx context.Context, code string) (*domain.TeamClaimCode, error) {
	row := r.db.QueryRow(ctx,
		`SELECT `+claimCodeColumns+` FROM team_claim_codes WHERE UPPER(code) = UPPER($1)`, code)
	c, err := scanClaimCode(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return c, err
}

// IncrementClaimCodeUses bumps the counter without exceeding max_uses, so a burst of
// concurrent redemptions can't push a code past its cap.
func (r *PostgresClaimRepository) IncrementClaimCodeUses(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE team_claim_codes SET uses = uses + 1 WHERE id = $1 AND uses < max_uses`, id)
	return err
}

// --- Public claim flow ---

func (r *PostgresClaimRepository) GetTeamByID(ctx context.Context, teamID string) (*domain.Team, error) {
	var t domain.Team
	err := r.db.QueryRow(ctx,
		`SELECT id, name, COALESCE(short_name, ''), COALESCE(logo, '') FROM teams WHERE id = $1`, teamID).
		Scan(&t.ID, &t.Name, &t.ShortName, &t.Logo)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// GetClaimablePlayersByTeam returns only UNCLAIMED players, so a player who is already
// claimed or has a claim pending disappears from the dropdown.
func (r *PostgresClaimRepository) GetClaimablePlayersByTeam(ctx context.Context, teamID string) ([]domain.Player, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, name, COALESCE(jersey_number, 0), COALESCE(position, '')
		FROM players
		WHERE team_id = $1 AND claim_status = 'UNCLAIMED'
		ORDER BY name ASC
	`, teamID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []domain.Player{}
	for rows.Next() {
		var p domain.Player
		if err := rows.Scan(&p.ID, &p.Name, &p.JerseyNumber, &p.Position); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// CreateClaimWithAccount creates the pending login account and the claim row together,
// and flips the player to PENDING, in one transaction. All three or none: a users row
// without a claim would be an account nobody can review, and a claim without a users
// row would leave the claimant unable to log in and see their status.
//
// Returns the new user's ID.
func (r *PostgresClaimRepository) CreateClaimWithAccount(ctx context.Context, claim *domain.PlayerClaim, user domain.User) (string, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Re-check the player inside the transaction. The unique index is the real guard
	// against a concurrent claim, but this gives a clean error for the common case.
	if !claim.IsNewPlayerRequest() {
		var claimStatus string
		var teamID *string
		err := tx.QueryRow(ctx,
			`SELECT claim_status, team_id FROM players WHERE id = $1 FOR UPDATE`, *claim.PlayerID).
			Scan(&claimStatus, &teamID)
		if errors.Is(err, pgx.ErrNoRows) {
			return "", errors.New("player not found")
		}
		if err != nil {
			return "", err
		}
		if claimStatus != domain.PlayerClaimStatusUnclaimed {
			return "", ErrClaimConflict
		}
		if teamID == nil || *teamID != claim.TeamID {
			return "", errors.New("player does not belong to the team for this code")
		}
	}

	var userID string
	err = tx.QueryRow(ctx, `
		INSERT INTO users (full_name, email, password_hash, role, phone)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`, user.FullName, user.Email, user.Password.Hash, user.Role, user.Phone).Scan(&userID)
	if err != nil {
		if strings.Contains(err.Error(), "users_email_key") {
			return "", errors.New("that email address is already registered")
		}
		return "", err
	}
	claim.UserID = &userID

	err = tx.QueryRow(ctx, `
		INSERT INTO player_claims (
			player_id, team_id, user_id, code_id, claimed_email, claimed_phone,
			proposed_name, proposed_jersey_number, proposed_position,
			status, verify_token_hash, verify_token_expires
		) VALUES (
			NULLIF($1::text, '')::uuid, $2, $3, NULLIF($4::text, '')::uuid, $5, $6,
			$7, $8, $9, $10, $11, $12
		)
		RETURNING id, created_at, updated_at
	`,
		derefString(claim.PlayerID), claim.TeamID, userID, derefString(claim.CodeID),
		claim.ClaimedEmail, claim.ClaimedPhone,
		claim.ProposedName, claim.ProposedJerseyNumber, claim.ProposedPosition,
		domain.ClaimStatusPending, nil, nil,
	).Scan(&claim.ID, &claim.CreatedAt, &claim.UpdatedAt)
	if err != nil {
		if strings.Contains(err.Error(), "idx_player_claims_one_open_per_player") {
			return "", ErrClaimConflict
		}
		return "", err
	}

	if !claim.IsNewPlayerRequest() {
		if _, err := tx.Exec(ctx,
			`UPDATE players SET claim_status = $1, updated_at = NOW() WHERE id = $2`,
			domain.PlayerClaimStatusPending, *claim.PlayerID); err != nil {
			return "", err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return "", err
	}
	return userID, nil
}

func (r *PostgresClaimRepository) SetClaimVerifyToken(ctx context.Context, claimID string, tokenHash []byte, expires time.Time) error {
	_, err := r.db.Exec(ctx,
		`UPDATE player_claims SET verify_token_hash = $1, verify_token_expires = $2, updated_at = NOW() WHERE id = $3`,
		tokenHash, expires, claimID)
	return err
}

func (r *PostgresClaimRepository) GetClaimByVerifyTokenHash(ctx context.Context, tokenHash []byte) (*domain.PlayerClaim, error) {
	row := r.db.QueryRow(ctx, `SELECT `+claimColumns+` FROM player_claims
		WHERE verify_token_hash = $1 AND (verify_token_expires IS NULL OR verify_token_expires > NOW())`, tokenHash)
	c, err := scanClaim(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return c, err
}

func (r *PostgresClaimRepository) MarkClaimEmailVerified(ctx context.Context, claimID string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE player_claims
		SET email_verified_at = NOW(), verify_token_hash = NULL, verify_token_expires = NULL, updated_at = NOW()
		WHERE id = $1
	`, claimID)
	return err
}

// --- Claimant's own view ---

const claimColumns = `
	id, player_id, team_id, user_id, code_id, claimed_email, claimed_phone, claimed_photo,
	proposed_name, proposed_jersey_number, proposed_position, status, email_verified_at,
	reviewed_by, reviewed_at, reject_reason, created_at, updated_at`

func scanClaim(row pgx.Row) (*domain.PlayerClaim, error) {
	var c domain.PlayerClaim
	err := row.Scan(
		&c.ID, &c.PlayerID, &c.TeamID, &c.UserID, &c.CodeID, &c.ClaimedEmail, &c.ClaimedPhone, &c.ClaimedPhoto,
		&c.ProposedName, &c.ProposedJerseyNumber, &c.ProposedPosition, &c.Status, &c.EmailVerifiedAt,
		&c.ReviewedBy, &c.ReviewedAt, &c.RejectReason, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *PostgresClaimRepository) GetClaimByUserID(ctx context.Context, userID string) (*domain.PlayerClaim, error) {
	row := r.db.QueryRow(ctx,
		`SELECT `+claimColumns+` FROM player_claims WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, userID)
	c, err := scanClaim(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return c, err
}

func (r *PostgresClaimRepository) UpdateClaimPhoto(ctx context.Context, claimID, photo string) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE player_claims SET claimed_photo = $1, updated_at = NOW()
		WHERE id = $2 AND status = 'PENDING'
	`, photo, claimID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errors.New("claim is no longer pending")
	}
	return nil
}

// --- Review ---

func (r *PostgresClaimRepository) GetClaimByID(ctx context.Context, id string) (*domain.PlayerClaim, error) {
	row := r.db.QueryRow(ctx, `SELECT `+claimColumns+` FROM player_claims WHERE id = $1`, id)
	c, err := scanClaim(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return c, err
}

// ListClaims returns claims with the player and team context the review screen needs.
// Verified claims sort first: email verification does not prove identity, but it is a
// useful signal and a cheap spam filter, so the manager sees those at the top.
func (r *PostgresClaimRepository) ListClaims(ctx context.Context, teamID, status, search string, page, limit int) ([]domain.PlayerClaim, int64, error) {
	where := ` WHERE 1=1`
	args := []any{}
	n := 1

	if teamID != "" {
		where += ` AND pc.team_id = $` + strconv.Itoa(n)
		args = append(args, teamID)
		n++
	}
	if status != "" {
		where += ` AND pc.status = $` + strconv.Itoa(n)
		args = append(args, status)
		n++
	}
	if search != "" {
		where += ` AND (COALESCE(p.name, pc.proposed_name) ILIKE $` + strconv.Itoa(n) +
			` OR pc.claimed_email ILIKE $` + strconv.Itoa(n) + `)`
		args = append(args, "%"+search+"%")
		n++
	}

	var total int64
	countQuery := `
		SELECT COUNT(*) FROM player_claims pc
		LEFT JOIN players p ON p.id = pc.player_id` + where
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := `
		SELECT ` + claimColumnsPrefixed + `,
		       COALESCE(p.name, ''), COALESCE(p.jersey_number, 0), COALESCE(p.position, ''), COALESCE(p.image, ''),
		       t.name
		FROM player_claims pc
		LEFT JOIN players p ON p.id = pc.player_id
		JOIN teams t ON t.id = pc.team_id` + where + `
		ORDER BY (pc.email_verified_at IS NULL) ASC, pc.created_at ASC`

	if limit > 0 {
		offset := (page - 1) * limit
		if offset < 0 {
			offset = 0
		}
		query += ` LIMIT ` + strconv.Itoa(limit) + ` OFFSET ` + strconv.Itoa(offset)
	}

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	out := []domain.PlayerClaim{}
	for rows.Next() {
		var c domain.PlayerClaim
		var pName, pPosition, pImage, teamName string
		var pJersey int
		err := rows.Scan(
			&c.ID, &c.PlayerID, &c.TeamID, &c.UserID, &c.CodeID, &c.ClaimedEmail, &c.ClaimedPhone, &c.ClaimedPhoto,
			&c.ProposedName, &c.ProposedJerseyNumber, &c.ProposedPosition, &c.Status, &c.EmailVerifiedAt,
			&c.ReviewedBy, &c.ReviewedAt, &c.RejectReason, &c.CreatedAt, &c.UpdatedAt,
			&pName, &pJersey, &pPosition, &pImage, &teamName,
		)
		if err != nil {
			return nil, 0, err
		}
		if c.PlayerID != nil {
			c.Player = &domain.Player{ID: *c.PlayerID, Name: pName, JerseyNumber: pJersey, Position: pPosition, Image: pImage}
		}
		c.Team = &domain.Team{ID: c.TeamID, Name: teamName}
		out = append(out, c)
	}
	return out, total, rows.Err()
}

const claimColumnsPrefixed = `
	pc.id, pc.player_id, pc.team_id, pc.user_id, pc.code_id, pc.claimed_email, pc.claimed_phone, pc.claimed_photo,
	pc.proposed_name, pc.proposed_jersey_number, pc.proposed_position, pc.status, pc.email_verified_at,
	pc.reviewed_by, pc.reviewed_at, pc.reject_reason, pc.created_at, pc.updated_at`

// GetClaimReviewContext returns the historical facts a manager cross-checks a claim
// against: which teams this player has appeared for, and how many finished matches they
// were named in. A claimant can invent an email; they cannot invent this.
func (r *PostgresClaimRepository) GetClaimReviewContext(ctx context.Context, playerID string) ([]string, int, error) {
	rows, err := r.db.Query(ctx, `
		SELECT DISTINCT t.name
		FROM player_team_history h
		JOIN teams t ON t.id = h.team_id
		WHERE h.player_id = $1
		ORDER BY t.name ASC
	`, playerID)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	pastTeams := []string{}
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, 0, err
		}
		pastTeams = append(pastTeams, name)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	var matchesPlayed int
	err = r.db.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM match_team_sheets ts
		JOIN matches m ON m.id = ts.match_id
		WHERE ts.player_id = $1 AND m.status = 'FINISHED'
	`, playerID).Scan(&matchesPlayed)
	if err != nil {
		return pastTeams, 0, err
	}

	return pastTeams, matchesPlayed, nil
}

// ApproveClaim is the only path that grants role = 'player' and sets players.user_id.
//
// Everything happens in one transaction: for a new-player request the players row is
// created here (never at submit time, so the claim page cannot pollute the roster), and
// in both cases the account is promoted, the player is linked and marked CLAIMED, and
// the claim is stamped with who approved it.
//
// Returns the player ID and whether a new players row was created, so the caller can
// provision that player's first contract.
func (r *PostgresClaimRepository) ApproveClaim(ctx context.Context, claimID, reviewerID string, override domain.Player) (string, bool, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return "", false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var (
		claim     domain.PlayerClaim
		lockedRow = tx.QueryRow(ctx, `SELECT `+claimColumns+` FROM player_claims WHERE id = $1 FOR UPDATE`, claimID)
	)
	c, err := scanClaim(lockedRow)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, errors.New("claim not found")
	}
	if err != nil {
		return "", false, err
	}
	claim = *c

	if claim.Status != domain.ClaimStatusPending {
		return "", false, fmt.Errorf("claim is no longer pending (current status: %s)", claim.Status)
	}
	if claim.UserID == nil || *claim.UserID == "" {
		return "", false, errors.New("claim has no linked account")
	}

	createdNew := false
	playerID := ""

	if claim.IsNewPlayerRequest() {
		name := firstNonEmpty(override.Name, claim.ProposedName)
		if name == "" {
			return "", false, errors.New("a name is required to create this player")
		}
		position := firstNonEmpty(override.Position, claim.ProposedPosition)
		jersey := override.JerseyNumber
		if jersey == 0 && claim.ProposedJerseyNumber != nil {
			jersey = *claim.ProposedJerseyNumber
		}

		err = tx.QueryRow(ctx, `
			INSERT INTO players (name, jersey_number, position, team_id, email, user_id, claim_status)
			VALUES ($1, NULLIF($2, 0), $3, $4, $5, $6, $7)
			RETURNING id
		`, name, jersey, position, claim.TeamID, claim.ClaimedEmail, *claim.UserID,
			domain.PlayerClaimStatusClaimed).Scan(&playerID)
		if err != nil {
			return "", false, fmt.Errorf("failed to create player: %w", err)
		}
		createdNew = true

		if _, err := tx.Exec(ctx,
			`UPDATE player_claims SET player_id = $1 WHERE id = $2`, playerID, claimID); err != nil {
			return "", false, err
		}
	} else {
		playerID = *claim.PlayerID

		var currentStatus string
		if err := tx.QueryRow(ctx,
			`SELECT claim_status FROM players WHERE id = $1 FOR UPDATE`, playerID).Scan(&currentStatus); err != nil {
			return "", false, err
		}
		if currentStatus == domain.PlayerClaimStatusClaimed {
			return "", false, errors.New("this player has already been claimed")
		}

		_, err = tx.Exec(ctx, `
			UPDATE players
			SET user_id      = $1,
			    email        = $2,
			    name         = COALESCE(NULLIF($3, ''), name),
			    position     = COALESCE(NULLIF($4, ''), position),
			    jersey_number = COALESCE(NULLIF($5, 0), jersey_number),
			    claim_status = $6,
			    updated_at   = NOW()
			WHERE id = $7
		`, *claim.UserID, claim.ClaimedEmail, override.Name, override.Position,
			override.JerseyNumber, domain.PlayerClaimStatusClaimed, playerID)
		if err != nil {
			return "", false, fmt.Errorf("failed to link player: %w", err)
		}
	}

	// Promote the pending account to a real player account, and carry the phone number
	// the claimant supplied onto the user record.
	if _, err := tx.Exec(ctx, `
		UPDATE users SET role = 'player', phone = COALESCE(NULLIF($1, ''), phone), updated_at = NOW()
		WHERE id = $2
	`, claim.ClaimedPhone, *claim.UserID); err != nil {
		return "", false, err
	}

	if _, err := tx.Exec(ctx, `
		UPDATE player_claims
		SET status = $1, reviewed_by = NULLIF($2::text, '')::uuid, reviewed_at = NOW(), updated_at = NOW()
		WHERE id = $3
	`, domain.ClaimStatusApproved, reviewerID, claimID); err != nil {
		return "", false, err
	}

	if err := tx.Commit(ctx); err != nil {
		return "", false, err
	}
	return playerID, createdNew, nil
}

// RejectClaim marks the claim rejected and returns the player to the dropdown. The
// players row itself is never touched: a rejection is a statement about the claimant,
// not about the player.
func (r *PostgresClaimRepository) RejectClaim(ctx context.Context, claimID, reviewerID, reason string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var playerID *string
	var status string
	err = tx.QueryRow(ctx,
		`SELECT player_id, status FROM player_claims WHERE id = $1 FOR UPDATE`, claimID).Scan(&playerID, &status)
	if errors.Is(err, pgx.ErrNoRows) {
		return errors.New("claim not found")
	}
	if err != nil {
		return err
	}
	if status != domain.ClaimStatusPending {
		return fmt.Errorf("claim is no longer pending (current status: %s)", status)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE player_claims
		SET status = $1, reject_reason = $2, reviewed_by = NULLIF($3::text, '')::uuid,
		    reviewed_at = NOW(), updated_at = NOW()
		WHERE id = $4
	`, domain.ClaimStatusRejected, reason, reviewerID, claimID); err != nil {
		return err
	}

	if playerID != nil {
		if _, err := tx.Exec(ctx,
			`UPDATE players SET claim_status = $1, updated_at = NOW() WHERE id = $2 AND claim_status = $3`,
			domain.PlayerClaimStatusUnclaimed, *playerID, domain.PlayerClaimStatusPending); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

// RevokeApprovedClaim undoes an approval: the account is demoted to player_pending, the
// player is unlinked, and the claim returns to PENDING for review again. Admin-only —
// this is the "we approved the wrong person" escape hatch.
//
// The player goes back to PENDING rather than UNCLAIMED, restoring exactly the state
// submit produced. Freeing the player to UNCLAIMED while an open claim still existed
// would show them in the claim dropdown while the one-open-claim-per-player index
// rejected anyone who picked them. To release the player entirely, reject the
// now-pending claim.
func (r *PostgresClaimRepository) RevokeApprovedClaim(ctx context.Context, claimID string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var playerID, userID *string
	var status string
	err = tx.QueryRow(ctx,
		`SELECT player_id, user_id, status FROM player_claims WHERE id = $1 FOR UPDATE`, claimID).
		Scan(&playerID, &userID, &status)
	if errors.Is(err, pgx.ErrNoRows) {
		return errors.New("claim not found")
	}
	if err != nil {
		return err
	}
	if status != domain.ClaimStatusApproved {
		return fmt.Errorf("only an approved claim can be revoked (current status: %s)", status)
	}

	if playerID != nil {
		if _, err := tx.Exec(ctx, `
			UPDATE players SET user_id = NULL, claim_status = $1, updated_at = NOW() WHERE id = $2
		`, domain.PlayerClaimStatusPending, *playerID); err != nil {
			return err
		}
	}
	if userID != nil {
		if _, err := tx.Exec(ctx, `
			UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2
		`, domain.RolePlayerPending, *userID); err != nil {
			return err
		}
	}

	if _, err := tx.Exec(ctx, `
		UPDATE player_claims
		SET status = $1, reviewed_by = NULL, reviewed_at = NULL, updated_at = NOW()
		WHERE id = $2
	`, domain.ClaimStatusPending, claimID); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func derefString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}
