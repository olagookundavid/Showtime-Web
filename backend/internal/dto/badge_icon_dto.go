package dto

import "time"

// SaveBadgeIconRequest adds artwork to the badge library or changes it.
type SaveBadgeIconRequest struct {
	Name     string `json:"name" binding:"required"`
	ImageURL string `json:"image_url" binding:"required"`
}

type BadgeIconResponse struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	ImageURL  string    `json:"image_url"`
	UsedBy    []string  `json:"used_by"` // names of the badges showing this artwork
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// UpdateBadgeIconResponse also says how many badges moved to a replaced image.
type UpdateBadgeIconResponse struct {
	Icon          BadgeIconResponse `json:"icon"`
	BadgesUpdated int               `json:"badges_updated"`
}
