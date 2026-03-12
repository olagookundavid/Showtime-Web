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
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`

	// Relations
	Team *Team `json:"team,omitempty"`
}
