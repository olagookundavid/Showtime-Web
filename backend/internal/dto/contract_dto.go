package dto

type IssueContractRequest struct {
	PlayerID       string `json:"player_id" binding:"required"`
	ContractLength *int   `json:"contract_length"` // default 13
	PlayerValue    *int64 `json:"player_value"`    // default 1,000,000
	Notes          string `json:"notes"`
}

type ContractActionRequest struct {
	Action string `json:"action" binding:"required"` // "accept" | "reject"
	Notes  string `json:"notes"`
}

type RenewContractRequest struct {
	ContractLength *int   `json:"contract_length"`
	PlayerValue    *int64 `json:"player_value"`
}

type ContractResponse struct {
	ID                string          `json:"id"`
	PlayerID          string          `json:"player_id"`
	TeamID            string          `json:"team_id"`
	Status            string          `json:"status"`
	ContractLength    int             `json:"contract_length"`
	MatchesAtStart    int             `json:"matches_at_start"`
	MatchesPlayed     int             `json:"matches_played"`
	MatchesRemaining  int             `json:"matches_remaining"`
	PlayerValue       int64           `json:"player_value"`
	OfferedBy         string          `json:"offered_by,omitempty"`
	OfferedAt         string          `json:"offered_at"`
	AcceptedAt        *string         `json:"accepted_at,omitempty"`
	ExpiredAt         *string         `json:"expired_at,omitempty"`
	TerminatedAt      *string         `json:"terminated_at,omitempty"`
	TerminationReason string          `json:"termination_reason,omitempty"`
	Notes             string          `json:"notes,omitempty"`
	CreatedAt         string          `json:"created_at"`
	UpdatedAt         string          `json:"updated_at"`
	Player            *PlayerResponse `json:"player,omitempty"`
	Team              *TeamResponse   `json:"team,omitempty"`
}

// ResignablePlayerResponse is a free agent whose last contract ended with the asking
// team (expired, released or terminated), which may re-sign them at any time.
type ResignablePlayerResponse struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Position     string `json:"position"`
	Image        string `json:"image"`
	JerseyNumber int    `json:"jersey_number"`
	// HasAccount: with one the player accepts the offer; without, re-signing starts
	// the contract at once.
	HasAccount         bool   `json:"has_account"`
	LastContractLength int    `json:"last_contract_length"`
	EndedAt            string `json:"ended_at"`
	// EndReason is EXPIRED, RELEASED, TRANSFERRED, ... as recorded on the contract.
	EndReason          string `json:"end_reason"`
	OfferPending       bool   `json:"offer_pending"`
}
