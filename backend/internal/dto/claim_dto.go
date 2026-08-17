package dto

// --- Claim code management (team manager / admin) ---

type CreateClaimCodeRequest struct {
	TeamID string `json:"team_id"` // admin only; team heads are scoped by middleware
	// ExpiresInDays defaults to 30. MaxUses defaults to 100 — generous, because the
	// code is not the security boundary; manager approval is.
	ExpiresInDays *int `json:"expires_in_days"`
	MaxUses       *int `json:"max_uses"`
}

type ClaimCodeResponse struct {
	ID        string  `json:"id"`
	TeamID    string  `json:"team_id"`
	TeamName  string  `json:"team_name,omitempty"`
	Code      string  `json:"code"`
	ExpiresAt *string `json:"expires_at,omitempty"`
	MaxUses   int     `json:"max_uses"`
	Uses      int     `json:"uses"`
	Revoked   bool    `json:"revoked"`
	CreatedAt string  `json:"created_at"`
}

// --- Public claim flow ---

type VerifyClaimCodeRequest struct {
	Code string `json:"code" binding:"required"`
}

// ClaimablePlayer carries only what the public roster page already exposes. Nothing
// identifying (email, phone, user_id) is included: the code is shared with a whole
// squad and must be assumed public.
type ClaimablePlayer struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	JerseyNumber int    `json:"jersey_number,omitempty"`
	Position     string `json:"position,omitempty"`
}

type VerifyClaimCodeResponse struct {
	TeamID   string            `json:"team_id"`
	TeamName string            `json:"team_name"`
	TeamLogo string            `json:"team_logo,omitempty"`
	Players  []ClaimablePlayer `json:"players"`
}

type SubmitClaimRequest struct {
	Code     string `json:"code" binding:"required"`
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
	Phone    string `json:"phone"`

	// PlayerID empty means "my name wasn't in the list" — a request for the manager to
	// create a player, using the Proposed* fields below as a starting point.
	PlayerID string `json:"player_id"`

	FullName             string `json:"full_name"`
	ProposedJerseyNumber *int   `json:"proposed_jersey_number"`
	ProposedPosition     string `json:"proposed_position"`
}

type SubmitClaimResponse struct {
	ClaimID     string `json:"claim_id"`
	Status      string `json:"status"`
	AccessToken string `json:"access_token"`
	UserID      string `json:"user_id"`
	UserType    string `json:"user_type"`
	Message     string `json:"message"`
}

type VerifyClaimEmailRequest struct {
	Token string `json:"token" binding:"required"`
}

type UpdateClaimPhotoRequest struct {
	Photo string `json:"photo" binding:"required"`
}

// --- Claim review (team manager / admin) ---

// PlayerClaimResponse pairs what the claimant submitted with what the system already
// knows about the player, which is the whole point of the review screen: the manager
// needs something to cross-check the claim against.
type PlayerClaimResponse struct {
	ID       string  `json:"id"`
	PlayerID *string `json:"player_id,omitempty"`
	TeamID   string  `json:"team_id"`
	TeamName string  `json:"team_name,omitempty"`
	Status   string  `json:"status"`

	// Submitted by the claimant
	ClaimedEmail  string `json:"claimed_email"`
	ClaimedPhone  string `json:"claimed_phone,omitempty"`
	ClaimedPhoto  string `json:"claimed_photo,omitempty"`
	EmailVerified bool   `json:"email_verified"`

	// New-player request fields
	IsNewPlayerRequest   bool   `json:"is_new_player_request"`
	ProposedName         string `json:"proposed_name,omitempty"`
	ProposedJerseyNumber *int   `json:"proposed_jersey_number,omitempty"`
	ProposedPosition     string `json:"proposed_position,omitempty"`

	// Known context for an existing player, for the manager to cross-check against
	PlayerName         string   `json:"player_name,omitempty"`
	PlayerJerseyNumber int      `json:"player_jersey_number,omitempty"`
	PlayerPosition     string   `json:"player_position,omitempty"`
	PlayerImage        string   `json:"player_image,omitempty"`
	PastTeams          []string `json:"past_teams,omitempty"`
	MatchesPlayed      int      `json:"matches_played"`

	RejectReason string  `json:"reject_reason,omitempty"`
	ReviewedBy   *string `json:"reviewed_by,omitempty"`
	ReviewedAt   *string `json:"reviewed_at,omitempty"`
	CreatedAt    string  `json:"created_at"`
}

// ApproveClaimRequest lets the manager correct the roster fields at approval time. For
// an existing player these override what is on record; for a new-player request they
// are the authoritative values the players row is created with.
type ApproveClaimRequest struct {
	Name         string `json:"name"`
	JerseyNumber *int   `json:"jersey_number"`
	Position     string `json:"position"`
}

type RejectClaimRequest struct {
	Reason string `json:"reason" binding:"required"`
}

// MyClaimStatusResponse is what a player_pending user sees on their status screen.
type MyClaimStatusResponse struct {
	HasClaim      bool   `json:"has_claim"`
	ClaimID       string `json:"claim_id,omitempty"`
	Status        string `json:"status,omitempty"`
	TeamName      string `json:"team_name,omitempty"`
	PlayerName    string `json:"player_name,omitempty"`
	ClaimedEmail  string `json:"claimed_email,omitempty"`
	ClaimedPhone  string `json:"claimed_phone,omitempty"`
	ClaimedPhoto  string `json:"claimed_photo,omitempty"`
	EmailVerified bool   `json:"email_verified"`
	RejectReason  string `json:"reject_reason,omitempty"`
	CreatedAt     string `json:"created_at,omitempty"`
}
