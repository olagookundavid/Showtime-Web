package dto

import "time"

type CreateBadgeRequest struct {
	Code        string `json:"code" binding:"required"`
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
	Category    string `json:"category"`
	ColorScheme string `json:"color_scheme"`
}

type UpdateBadgeRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
	Category    string `json:"category"`
	ColorScheme string `json:"color_scheme"`
}

type AwardBadgeRequest struct {
	PlayerID      string  `json:"player_id" binding:"required"`
	BadgeID       string  `json:"badge_id" binding:"required"`
	CompetitionID *string `json:"competition_id,omitempty"`
	SeasonID      *string `json:"season_id,omitempty"`
	MatchID       *string `json:"match_id,omitempty"`
	Reason        string  `json:"reason"`
	Increment     *int    `json:"increment,omitempty"` // default 1 if not specified
}

type BadgeResponse struct {
	ID          string    `json:"id"`
	Code        string    `json:"code"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Icon        string    `json:"icon"`
	Category    string    `json:"category"`
	ColorScheme string    `json:"color_scheme"`
	IsSystem    bool      `json:"is_system"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type PlayerBadgeAwardResponse struct {
	ID            string    `json:"id"`
	PlayerID      string    `json:"player_id"`
	BadgeID       string    `json:"badge_id"`
	CompetitionID *string   `json:"competition_id,omitempty"`
	SeasonID      *string   `json:"season_id,omitempty"`
	MatchID       *string   `json:"match_id,omitempty"`
	TOTWID        *string   `json:"totw_id,omitempty"`
	Reason        string          `json:"reason"`
	Count         int             `json:"count"`
	AwardedBy     *string         `json:"awarded_by,omitempty"`
	CreatedAt     time.Time       `json:"created_at"`
	Badge         *BadgeResponse  `json:"badge,omitempty"`
	Player        *PlayerResponse `json:"player,omitempty"`
	CompetitionName *string       `json:"competition_name,omitempty"`
}

type PlayerBadgeResponse struct {
	ID            string                     `json:"id"`
	PlayerID      string                     `json:"player_id"`
	BadgeID       string                     `json:"badge_id"`
	Code          string                     `json:"code"`
	Name          string                     `json:"name"`
	Description   string                     `json:"description"`
	Icon          string                     `json:"icon"`
	Category      string                     `json:"category"`
	ColorScheme   string                     `json:"color_scheme"`
	Count         int                        `json:"count"`
	LastAwardedAt time.Time                  `json:"last_awarded_at"`
	Awards        []PlayerBadgeAwardResponse `json:"awards,omitempty"`
}
