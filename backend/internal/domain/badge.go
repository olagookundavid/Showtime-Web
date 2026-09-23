package domain

import "time"

type Badge struct {
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

type PlayerBadge struct {
	ID            string             `json:"id"`
	PlayerID      string             `json:"player_id"`
	BadgeID       string             `json:"badge_id"`
	Count         int                `json:"count"`
	LastAwardedAt time.Time          `json:"last_awarded_at"`
	CreatedAt     time.Time          `json:"created_at"`
	UpdatedAt     time.Time          `json:"updated_at"`
	Badge         *Badge             `json:"badge,omitempty"`
	Awards        []PlayerBadgeAward `json:"awards,omitempty"`
}

type PlayerBadgeAward struct {
	ID            string     `json:"id"`
	PlayerID      string     `json:"player_id"`
	BadgeID       string     `json:"badge_id"`
	CompetitionID *string    `json:"competition_id,omitempty"`
	SeasonID      *string    `json:"season_id,omitempty"`
	MatchID       *string    `json:"match_id,omitempty"`
	TOTWID        *string    `json:"totw_id,omitempty"`
	Reason        string     `json:"reason"`
	Count         int        `json:"count"`
	AwardedBy     *string    `json:"awarded_by,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	Badge         *Badge     `json:"badge,omitempty"`
	Player        *Player    `json:"player,omitempty"`
	CompetitionName *string  `json:"competition_name,omitempty"`
}
