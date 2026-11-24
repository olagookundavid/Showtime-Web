package dto

import "time"

type CreateHeroSlideRequest struct {
	ImageURL       string `json:"image_url" binding:"required"`
	MobileImageURL string `json:"mobile_image_url"`  // optional square variant for mobile
	DestinationURL string `json:"destination_url"`   // optional; internal path or external URL, pasted in by the admin
	Headline       string `json:"headline"`          // optional caption shown in the side preview panel
	DisplayOrder   *int   `json:"display_order"`
	IsActive       *bool  `json:"is_active"`
}

type UpdateHeroSlideRequest struct {
	ImageURL       *string `json:"image_url"`
	MobileImageURL *string `json:"mobile_image_url"`  // nil = unchanged, "" = clear
	DestinationURL *string `json:"destination_url"`   // nil = unchanged, "" = clear
	Headline       *string `json:"headline"`          // nil = unchanged, "" = clear
	DisplayOrder   *int    `json:"display_order"`
	IsActive       *bool   `json:"is_active"`
}

type HeroSlideNewsResponse struct {
	ID                 string `json:"id"`
	Slug               string `json:"slug"`
	Title              string `json:"title"`
	Excerpt            string `json:"excerpt"`
	Content            string `json:"content"`
	Category           string `json:"category"`
	FeaturedMediaType  string `json:"featured_media_type"`
	FeaturedYoutubeURL string `json:"featured_youtube_url"`
}

type HeroSlideResponse struct {
	ID             string    `json:"id"`
	ImageURL       string    `json:"image_url"`
	MobileImageURL string    `json:"mobile_image_url"`
	DisplayOrder   int       `json:"display_order"`
	IsActive       bool      `json:"is_active"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
	// DestinationURL is where the slide links to — preferred over the legacy
	// NewsSlug/News fields, which are kept only for slides created before
	// this field existed.
	DestinationURL string                 `json:"destination_url,omitempty"`
	Headline       string                 `json:"headline,omitempty"`
	NewsSlug       string                 `json:"news_slug,omitempty"`
	News           *HeroSlideNewsResponse `json:"news,omitempty"`
}
