package dto

import "time"

type TOTWPlayerSlotInput struct {
	PlayerID   string  `json:"player_id" binding:"required"`
	SlotCode   string  `json:"slot_code" binding:"required"`
	Position   string  `json:"position" binding:"required"`
	Unit       string  `json:"unit" binding:"required"` // "Offence" | "Defence"
	CoordX     string  `json:"coord_x"`
	CoordY     string  `json:"coord_y"`
	Rating     float64 `json:"rating"`
	Stat1Value string  `json:"stat1_value"`
	Stat1Label string  `json:"stat1_label"`
	Stat2Value string  `json:"stat2_value"`
	Stat2Label string  `json:"stat2_label"`
	Stat3Value string  `json:"stat3_value"`
	Stat3Label string  `json:"stat3_label"`
}

type SaveTOTWRequest struct {
	CompetitionID string                `json:"competition_id" binding:"required"`
	EventDayID    *string               `json:"event_day_id,omitempty"`
	WeekTitle     string                `json:"week_title" binding:"required"` // e.g. "Week 3"
	Headline      string                `json:"headline" binding:"required"`   // e.g. "Showtime Pro · Gameday 3"
	SubHeadline   string                `json:"sub_headline"`                  // default "Offence & defence lineup"
	IsPublished   bool                  `json:"is_published"`
	Players       []TOTWPlayerSlotInput `json:"players" binding:"required"`    // Starting XIV
}

type TOTWPlayerResponse struct {
	ID           string          `json:"id"`
	TOTWID       string          `json:"totw_id"`
	PlayerID     string          `json:"player_id"`
	SlotCode     string          `json:"slot_code"`
	Position     string          `json:"position"`
	Unit         string          `json:"unit"`
	CoordX       string          `json:"coord_x"`
	CoordY       string          `json:"coord_y"`
	Rating       float64         `json:"rating"`
	Stat1Value   string          `json:"stat1_value"`
	Stat1Label   string          `json:"stat1_label"`
	Stat2Value   string          `json:"stat2_value"`
	Stat2Label   string          `json:"stat2_label"`
	Stat3Value   string          `json:"stat3_value"`
	Stat3Label   string          `json:"stat3_label"`
	DisplayOrder int             `json:"display_order"`
	Player       *PlayerResponse `json:"player,omitempty"`
}

type TOTWResponse struct {
	ID            string               `json:"id"`
	CompetitionID string               `json:"competition_id"`
	EventDayID    *string              `json:"event_day_id,omitempty"`
	WeekTitle     string               `json:"week_title"`
	Headline      string               `json:"headline"`
	SubHeadline   string               `json:"sub_headline"`
	IsPublished   bool                 `json:"is_published"`
	PublishedAt   *time.Time           `json:"published_at,omitempty"`
	CreatedAt     time.Time            `json:"created_at"`
	UpdatedAt     time.Time            `json:"updated_at"`
	Competition   *CompetitionResponse `json:"competition,omitempty"`
	Players       []TOTWPlayerResponse `json:"players,omitempty"`
}

type TOTWListItemResponse struct {
	ID              string     `json:"id"`
	CompetitionID   string     `json:"competition_id"`
	CompetitionName string     `json:"competition_name,omitempty"`
	CompetitionLogo string     `json:"competition_logo,omitempty"`
	EventDayID      *string    `json:"event_day_id,omitempty"`
	WeekTitle       string     `json:"week_title"`
	Headline        string     `json:"headline"`
	SubHeadline     string     `json:"sub_headline,omitempty"`
	IsPublished     bool       `json:"is_published"`
	PublishedAt     *time.Time `json:"published_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
}
