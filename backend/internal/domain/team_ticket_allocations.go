package domain

import "time"

type TeamTicketAllocation struct {
	ID             string    `json:"id"`
	EventDayID     string    `json:"event_day_id"`
	TeamID         string    `json:"team_id"`
	AllocatedCount int       `json:"allocated_count"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`

	// Relations
	EventDay *EventDay `json:"event_day,omitempty"`
	Team     *Team     `json:"team,omitempty"`
}
