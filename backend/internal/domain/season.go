package domain

import "time"

// SeasonGraphic is one of the two "Team of the Season" graphics (offense /
// defense) shown on the homepage. Just an admin-uploaded image with an optional
// mobile variant.
type SeasonGraphic struct {
	ID             string    `json:"id"`
	Category       string    `json:"category"` // "offense" | "defense"
	ImageURL       string    `json:"image_url"`
	MobileImageURL string    `json:"mobile_image_url"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// SeasonMVP is an admin-curated MVP: a player plus a free-text role label. The
// Player relation is hydrated on read (name/image/team) so the card stays in
// sync with the player record.
type SeasonMVP struct {
	ID           string    `json:"id"`
	PlayerID     string    `json:"player_id"`
	Label        string    `json:"label"`
	DisplayOrder int       `json:"display_order"`
	IsActive     bool      `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	Player       *Player   `json:"player,omitempty"`
}
