package domain

import "time"

type TeamManager struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	TeamID    string    `json:"team_id"`
	CreatedAt time.Time `json:"created_at"`
}
