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

// What the claimant asked for, fixed at submit time. Determines which queue reviews it:
// ROSTER goes to the team manager, NEW_PLAYER to the league office.
const (
	ClaimKindRoster    = "ROSTER"
	ClaimKindNewPlayer = "NEW_PLAYER"
)

// A team manager's advisory opinion on a NEW_PLAYER request. Absent is a normal state —
// the admin can decide without it, so an unresponsive manager cannot strand a request.
const (
	EndorsementEndorsed = "ENDORSED"
	EndorsementDeclined = "DECLINED"
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

	Kind            string     `json:"claim_kind"`
	Status          string     `json:"status"`
	EmailVerifiedAt *time.Time `json:"email_verified_at,omitempty"`
	ReviewedBy      *string    `json:"reviewed_by,omitempty"`
	ReviewedAt      *time.Time `json:"reviewed_at,omitempty"`
	RejectReason    string     `json:"reject_reason,omitempty"`

	// The team manager's advisory opinion on a NEW_PLAYER request. Never binding.
	Endorsement     string     `json:"endorsement,omitempty"`
	EndorsedBy      *string    `json:"endorsed_by,omitempty"`
	EndorsedAt      *time.Time `json:"endorsed_at,omitempty"`
	EndorsementNote string     `json:"endorsement_note,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// Relations / joined review context
	Player *Player `json:"player,omitempty"`
	Team   *Team   `json:"team,omitempty"`
}

// IsNewPlayerRequest reports whether this claim asks for a player to be created rather
// than claiming an existing roster entry.
//
// This reads Kind, not PlayerID: approving a NEW_PLAYER request writes the newly
// created player's id onto the claim, so PlayerID stops distinguishing the two the
// moment a request is approved.
func (c *PlayerClaim) IsNewPlayerRequest() bool {
	if c == nil {
		return false
	}
	if c.Kind != "" {
		return c.Kind == ClaimKindNewPlayer
	}
	// Defensive: a row read through a query that predates claim_kind.
	return c.PlayerID == nil || *c.PlayerID == ""
}

// Reviewer is who is acting on a claim. IsAdmin is explicit rather than inferred from
// an empty TeamID: "unscoped" and "administrator" happen to coincide today, and
// routing authority off that coincidence is how privilege checks quietly rot.
type Reviewer struct {
	UserID  string
	TeamID  string // the team a team_head is scoped to; empty for an admin
	IsAdmin bool
}

// CanDecide reports whether this reviewer may approve or reject the claim outright.
//
// A NEW_PLAYER request is the league office's decision: there is no history to check a
// brand-new player against, so this is not an identity judgement but a question of who
// joins the league at all. A manager's knowledge still counts — through CanEndorse.
func (c *PlayerClaim) CanDecide(r Reviewer) bool {
	if c == nil {
		return false
	}
	if r.IsAdmin {
		return true
	}
	if c.IsNewPlayerRequest() {
		return false
	}
	return r.TeamID != "" && r.TeamID == c.TeamID
}

// CanEndorse reports whether this reviewer may record an advisory opinion. Only the
// managers of the claim's own team, and only on NEW_PLAYER requests — an admin holds
// the decision itself and has no use for a second, weaker verb.
func (c *PlayerClaim) CanEndorse(r Reviewer) bool {
	if c == nil || !c.IsNewPlayerRequest() {
		return false
	}
	return !r.IsAdmin && r.TeamID != "" && r.TeamID == c.TeamID
}
