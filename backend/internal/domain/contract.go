package domain

import "time"

type Contract struct {
	ID                string     `json:"id"`
	PlayerID          string     `json:"player_id"`
	TeamID            string     `json:"team_id"`
	Status            string     `json:"status"` // PENDING, ACTIVE, EXPIRED, TERMINATED, REJECTED
	ContractLength    int        `json:"contract_length"`
	MatchesAtStart    int        `json:"matches_at_start"`
	PlayerValue       int64      `json:"player_value"`
	OfferedBy         string     `json:"offered_by"`
	OfferedAt         time.Time  `json:"offered_at"`
	AcceptedAt        *time.Time `json:"accepted_at,omitempty"`
	ExpiredAt         *time.Time `json:"expired_at,omitempty"`
	TerminatedAt      *time.Time `json:"terminated_at,omitempty"`
	TerminationReason string     `json:"termination_reason,omitempty"`
	Notes             string     `json:"notes,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`

	// Computed/Joined fields
	MatchesPlayed    int     `json:"matches_played"`
	MatchesRemaining int     `json:"matches_remaining"`
	Player           *Player `json:"player,omitempty"`
	Team             *Team   `json:"team,omitempty"`
}
