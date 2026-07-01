package dto

import "time"

type CreateHeroSlideRequest struct {
	ImageURL       string `json:"image_url" binding:"required"`
	MobileImageURL string `json:"mobile_image_url"` // optional square variant for mobile
	DisplayOrder   *int   `json:"display_order"`
	IsActive       *bool  `json:"is_active"`
}

type UpdateHeroSlideRequest struct {
	ImageURL       *string `json:"image_url"`
	MobileImageURL *string `json:"mobile_image_url"` // nil = unchanged, "" = clear
	DisplayOrder   *int    `json:"display_order"`
	IsActive       *bool   `json:"is_active"`
}

type HeroSlideResponse struct {
	ID             string    `json:"id"`
	ImageURL       string    `json:"image_url"`
	MobileImageURL string    `json:"mobile_image_url"`
	DisplayOrder   int       `json:"display_order"`
	IsActive       bool      `json:"is_active"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}
