package domain

import "time"

type Player struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	JerseyNumber int       `json:"jersey_number"`
	Position     string    `json:"position"`
	TeamID       string    `json:"team_id"`
	Bio          string    `json:"bio"`
	Image        string    `json:"image"`
	Email        string    `json:"email"`
	Gender       string    `json:"gender,omitempty"`
	UserID       *string   `json:"user_id,omitempty"`
	ClaimStatus  string    `json:"claim_status,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`

	// Relations
	Team        *Team               `json:"team,omitempty"`
	TeamHistory []PlayerTeamHistory `json:"team_history,omitempty"`
}

type PlayerTeamHistory struct {
	ID        string     `json:"id"`
	PlayerID  string     `json:"player_id"`
	TeamID    string     `json:"team_id"`
	JoinedAt  *time.Time `json:"joined_at"`
	LeftAt    *time.Time `json:"left_at"`
	CreatedAt time.Time  `json:"created_at"`

	// Relations
	Team *Team `json:"team,omitempty"`
}
