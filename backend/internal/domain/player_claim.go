package domain

import "time"

// Claim statuses. REJECTED is terminal for the claim but not for the player: the
// partial unique index on player_claims excludes it, so a rejected player returns to
// the claim dropdown for someone else to claim.
const (
	ClaimStatusPending  = "PENDING"
	ClaimStatusApproved = "APPROVED"
	ClaimStatusRejected = "REJECTED"
)

// players.claim_status. Distinct from "has a users row": a pending claimant already has
// an account (so email uniqueness is caught at submit time) but is not yet claimed.
const (
	PlayerClaimStatusUnclaimed = "UNCLAIMED"
	PlayerClaimStatusPending   = "PENDING"
	PlayerClaimStatusClaimed   = "CLAIMED"
)

// RolePlayerPending is the role a claimant holds between submitting and being
// approved. It grants nothing: one status screen and the ability to upload their own
// claim photo. Only an approved claim promotes it to "player".
const RolePlayerPending = "player_pending"

type TeamClaimCode struct {
	ID        string     `json:"id"`
	TeamID    string     `json:"team_id"`
	Code      string     `json:"code"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	MaxUses   int        `json:"max_uses"`
	Uses      int        `json:"uses"`
	RevokedAt *time.Time `json:"revoked_at,omitempty"`
	CreatedBy *string    `json:"created_by,omitempty"`
	CreatedAt time.Time  `json:"created_at"`

	// Relations
	Team *Team `json:"team,omitempty"`
}

// Live reports whether the code can still be redeemed. Callers must not surface which
// of these conditions failed — see ClaimService.ValidateCode.
func (c *TeamClaimCode) Live(now time.Time) bool {
	if c == nil || c.RevokedAt != nil {
		return false
	}
	if c.ExpiresAt != nil && c.ExpiresAt.Before(now) {
		return false
	}
	return c.Uses < c.MaxUses
}

type PlayerClaim struct {
	ID       string  `json:"id"`
	PlayerID *string `json:"player_id,omitempty"` // nil = request to create a new player
	TeamID   string  `json:"team_id"`
	UserID   *string `json:"user_id,omitempty"`
	CodeID   *string `json:"code_id,omitempty"`

	ClaimedEmail string `json:"claimed_email"`
	ClaimedPhone string `json:"claimed_phone"`
	ClaimedPhoto string `json:"claimed_photo"`

	ProposedName         string `json:"proposed_name,omitempty"`
	ProposedJerseyNumber *int   `json:"proposed_jersey_number,omitempty"`
	ProposedPosition     string `json:"proposed_position,omitempty"`

	Status          string     `json:"status"`
	EmailVerifiedAt *time.Time `json:"email_verified_at,omitempty"`
	ReviewedBy      *string    `json:"reviewed_by,omitempty"`
	ReviewedAt      *time.Time `json:"reviewed_at,omitempty"`
	RejectReason    string     `json:"reject_reason,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`

	// Relations / joined review context
	Player *Player `json:"player,omitempty"`
	Team   *Team   `json:"team,omitempty"`
}

// IsNewPlayerRequest reports whether this claim asks for a player to be created rather
// than claiming an existing roster entry.
func (c *PlayerClaim) IsNewPlayerRequest() bool {
	return c == nil || c.PlayerID == nil || *c.PlayerID == ""
}
