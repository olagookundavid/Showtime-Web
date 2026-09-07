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

	// DestinationURL is where the slide links to — an internal path
	// (e.g. "/stats", "/news/some-slug") or a full external URL, pasted in
	// by the admin. Empty means non-clickable.
	DestinationURL string `json:"destination_url"`

	// NewsID/News are legacy: slides created before DestinationURL existed
	// link to an auto-created hidden article instead. Kept read-only so old
	// slides keep working; Create/Update never populate NewsID anymore.
	NewsID *string `json:"news_id,omitempty"`
	News   *News   `json:"news,omitempty"`
}
