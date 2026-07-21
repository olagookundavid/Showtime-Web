package dto

import "time"

// HeroSlideNewsRequest is the inline article authored from the Hero Slides
// admin. Title/Content are required when creating (a slide's article can't be
// half-written); on update all fields are provided together since the admin
// form always submits the full article state (no partial-field PATCH here).
type HeroSlideNewsRequest struct {
	Title              string `json:"title" binding:"required"`
	Excerpt            string `json:"excerpt"`
	Content            string `json:"content" binding:"required"`
	FeaturedMediaType  string `json:"featured_media_type" binding:"omitempty,oneof=image youtube"`
	FeaturedYoutubeURL string `json:"featured_youtube_url"`
}

type CreateHeroSlideRequest struct {
	ImageURL       string               `json:"image_url" binding:"required"`
	MobileImageURL string               `json:"mobile_image_url"` // optional square variant for mobile
	DisplayOrder   *int                 `json:"display_order"`
	IsActive       *bool                `json:"is_active"`
	News           HeroSlideNewsRequest `json:"news" binding:"required"`
}

type UpdateHeroSlideRequest struct {
	ImageURL       *string               `json:"image_url"`
	MobileImageURL *string               `json:"mobile_image_url"` // nil = unchanged, "" = clear
	DisplayOrder   *int                  `json:"display_order"`
	IsActive       *bool                 `json:"is_active"`
	News           *HeroSlideNewsRequest `json:"news"` // nil = leave the linked article untouched
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
	// NewsSlug is the minimal public field — MainHeroCarousel links to
	// /news/{news_slug} when present. News is the full nested article,
	// populated for admin reads only (edit-form prefill).
	NewsSlug string                 `json:"news_slug,omitempty"`
	News     *HeroSlideNewsResponse `json:"news,omitempty"`
}
