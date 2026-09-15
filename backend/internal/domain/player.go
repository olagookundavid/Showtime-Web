package domain

import (
	"strings"
	"time"
)

// PositionUnassigned is the sentinel stored in players.position when a player
// has no role yet. Migration 090 makes the column NOT NULL DEFAULT this value,
// so nothing downstream has to special-case NULL or "" -- readers can compare
// positions directly and the UI has something to render.
const PositionUnassigned = "-"

// NormalizePosition coerces a position to what the column is allowed to hold.
// Every write path to players.position must run through this, otherwise the
// NOT NULL constraint from migration 090 is satisfied by a blank string and the
// sentinel stops meaning anything. "null" is matched as text because CSV
// imports and older clients send the literal word.
func NormalizePosition(position string) string {
	trimmed := strings.TrimSpace(position)
	if trimmed == "" || strings.EqualFold(trimmed, "null") {
		return PositionUnassigned
	}
	return trimmed
}

type Player struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	JerseyNumber int       `json:"jersey_number"`
	Position          string    `json:"position"`
	SecondaryPosition *string   `json:"secondary_position,omitempty"`
	TeamID       string    `json:"team_id"`
	Bio          string    `json:"bio"`
	Image        string    `json:"image"`
	Email        string    `json:"email"`
	Gender       string    `json:"gender,omitempty"`
	UserID       *string   `json:"user_id,omitempty"`
	ClaimStatus  string    `json:"claim_status,omitempty"`
	// Status is "active" or "inactive". Deleting a player deactivates them
	// (migration 088) rather than removing the row, so their stats survive and
	// they still appear in historical views -- greyed out rather than gone.
	Status         string     `json:"status,omitempty"`
	DeactivatedAt  *time.Time `json:"deactivated_at,omitempty"`
	IsReserve      bool       `json:"is_reserve"`
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
