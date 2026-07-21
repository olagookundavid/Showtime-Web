package domain

import "time"

type News struct {
	ID                 string    `json:"id"`
	Title              string    `json:"title"`
	Slug               string    `json:"slug"`
	Excerpt            string    `json:"excerpt"`
	Content            string    `json:"content"`
	FeaturedImage      string    `json:"featured_image"`
	FeaturedMediaType  string    `json:"featured_media_type"`
	FeaturedYoutubeURL string    `json:"featured_youtube_url"`
	Author             string    `json:"author"`
	Category           string    `json:"category"`
	PublishedAt        time.Time `json:"published_at"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
	// IsHeroOnly marks an article authored from the Hero Slides admin: hidden
	// from the public/admin news list, reachable only via its direct slug URL.
	IsHeroOnly bool `json:"is_hero_only"`
}
