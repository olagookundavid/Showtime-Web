package domain

import "time"

type HeroSlide struct {
	ID           string    `json:"id"`
	ImageURL     string    `json:"image_url"`
	DisplayOrder int       `json:"display_order"`
	IsActive     bool      `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
