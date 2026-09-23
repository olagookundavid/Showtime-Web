package domain

import "time"

type TOTWPlayer struct {
	ID           string   `json:"id"`
	TOTWID       string   `json:"totw_id"`
	PlayerID     string   `json:"player_id"`
	SlotCode     string   `json:"slot_code"` // e.g. "OFF_QB", "OFF_WR1", "DEF_S1"
	Position     string   `json:"position"`  // "QB", "WR", "FQB/RB", "C", "S", "R", "DEF"
	Unit         string   `json:"unit"`      // "Offence" | "Defence"
	CoordX       string   `json:"coord_x"`   // e.g. "50%"
	CoordY       string   `json:"coord_y"`   // e.g. "85%"
	Rating       float64  `json:"rating"`    // e.g. 9.6
	Stat1Value   string   `json:"stat1_value"`
	Stat1Label   string   `json:"stat1_label"`
	Stat2Value   string   `json:"stat2_value"`
	Stat2Label   string   `json:"stat2_label"`
	Stat3Value   string   `json:"stat3_value"`
	Stat3Label   string   `json:"stat3_label"`
	DisplayOrder int      `json:"display_order"`
	CreatedAt    time.Time `json:"created_at"`
	Player       *Player  `json:"player,omitempty"`
}

type TeamOfTheWeek struct {
	ID            string       `json:"id"`
	CompetitionID string       `json:"competition_id"`
	EventDayID    *string      `json:"event_day_id,omitempty"`
	WeekTitle     string       `json:"week_title"`   // e.g. "Week 3"
	Headline      string       `json:"headline"`     // e.g. "Showtime Pro · Gameday 3"
	SubHeadline   string       `json:"sub_headline"` // e.g. "Offence & defence lineup"
	IsPublished   bool         `json:"is_published"`
	PublishedAt   *time.Time   `json:"published_at,omitempty"`
	CreatedBy     *string      `json:"created_by,omitempty"`
	CreatedAt     time.Time    `json:"created_at"`
	UpdatedAt     time.Time    `json:"updated_at"`
	Competition   *Competition `json:"competition,omitempty"`
	Players       []TOTWPlayer `json:"players,omitempty"`
}
