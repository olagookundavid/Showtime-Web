package domain

import "time"

// The onboarding contract every new player starts on. They live in domain because two
// paths issue it — ContractService.ProvisionInitialContract, and the claim approval
// transaction in the claim repository — and the two must not drift.
const (
	// InitialContractMatches is the contract length every player is onboarded with.
	// The historical import gave all existing players 10 matches from the current
	// season, and newly created players get the same so the roster stays uniform.
	InitialContractMatches = 10
	// InitialContractPlayerValue is the transfer value a newly onboarded player starts at.
	InitialContractPlayerValue int64 = 1000000
	InitialContractNotes             = "Initial onboarding contract"
)

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
	LastNotifiedRemaining int    `json:"last_notified_remaining"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`

	// Computed/Joined fields
	MatchesPlayed    int     `json:"matches_played"`
	MatchesRemaining int     `json:"matches_remaining"`
	Player           *Player `json:"player,omitempty"`
	Team             *Team   `json:"team,omitempty"`
}
