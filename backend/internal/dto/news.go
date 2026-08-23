package dto

import "time"

type CreateNewsRequest struct {
	Title              string `json:"title" binding:"required"`
	Excerpt            string `json:"excerpt"`
	Content            string `json:"content" binding:"required"`
	FeaturedImage      string `json:"featured_image"`
	FeaturedMediaType  string `json:"featured_media_type" binding:"omitempty,oneof=image youtube"`
	FeaturedYoutubeURL string `json:"featured_youtube_url"`
	Author             string `json:"author"`
	Category           string `json:"category"`
	// Pointer so an omitted field means "leave it alone" rather than "disable
	// comments": bound as a plain bool, any client that doesn't send the key
	// would silently turn commenting off on every save.
	CommentsEnabled *bool `json:"comments_enabled"`
}

type NewsResponse struct {
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
	CommentsEnabled    bool      `json:"comments_enabled"`
}

type PaginationQuery struct {
	Page     int    `form:"page,default=1" binding:"min=1"`
	Limit    int    `form:"limit,default=10" binding:"min=1,max=100"`
	Search   string `form:"search"`
	Author   string `form:"author"`
	Category string `form:"category"`
}

type PaginatedResponse struct {
	Data       interface{} `json:"data"`
	Total      int64       `json:"total"`
	Page       int         `json:"page"`
	Limit      int         `json:"limit"`
	TotalPages int         `json:"total_pages"`
}
