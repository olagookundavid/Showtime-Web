package domain

import "time"

type TOTWEntry struct {
	ID            string       `json:"id"`
	CompetitionID string       `json:"competition_id"`
	EventDayDate  time.Time    `json:"event_day_date"`
	PlayerID      string       `json:"player_id"`
	PositionGroup string       `json:"position_group"` // QB | WR | DEF
	CreatedAt     time.Time    `json:"created_at"`
	UpdatedAt     time.Time    `json:"updated_at"`

	// Relationships
	Player      *Player      `json:"player,omitempty"`
	Competition *Competition `json:"competition,omitempty"`
}

type TOTWFilter struct {
	CompetitionID string
	EventDayDate  *time.Time
}
