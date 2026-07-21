package domain

import "time"

type HeroSlide struct {
	ID             string    `json:"id"`
	ImageURL       string    `json:"image_url"`
	MobileImageURL string    `json:"mobile_image_url"`
	DisplayOrder   int       `json:"display_order"`
	IsActive       bool      `json:"is_active"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`

	// NewsID links this slide to the article it opens when clicked. Nil for
	// slides created before this feature (they render non-clickable).
	NewsID *string `json:"news_id,omitempty"`
	// News is hydrated on admin reads (for edit-form prefill) — nil otherwise.
	News *News `json:"news,omitempty"`
}
