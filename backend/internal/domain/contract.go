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

// ContractSettings are the contract numbers an admin can change at runtime (App
// Settings > Contracts). The constants above are the defaults used until they do.
type ContractSettings struct {
	// DefaultLength is how many team matches a contract runs when the manager doesn't
	// say: new offers, extensions and transfer contracts.
	DefaultLength int `json:"default_length"`
	// OnboardingLength is the length of the first contract a new or claimed player gets.
	OnboardingLength int `json:"onboarding_length"`
	// WarningMatches is how many matches from the end a contract starts to count as
	// "running out", for the warnings and the expiry summaries.
	WarningMatches int `json:"warning_matches"`
}

const (
	DefaultContractLength         = 13
	DefaultContractWarningMatches = 3
)

func DefaultContractSettings() ContractSettings {
	return ContractSettings{
		DefaultLength:    DefaultContractLength,
		OnboardingLength: InitialContractMatches,
		WarningMatches:   DefaultContractWarningMatches,
	}
}
