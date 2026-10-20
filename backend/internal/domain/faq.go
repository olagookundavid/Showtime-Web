package domain

import "time"

// FAQPage is a place on the site that shows FAQs. Key is the short slug the
// front end asks for (e.g. "game-pass"); Path is only a hint to the admin about
// where the FAQs appear.
type FAQPage struct {
	Key         string    `json:"key"`
	Name        string    `json:"name"`
	Path        string    `json:"path"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// FAQPageSummary is a page with how much it holds, for the admin's page list.
type FAQPageSummary struct {
	FAQPage
	CategoryCount int `json:"category_count"`
	ItemCount     int `json:"item_count"`
}

// FAQCategory groups a page's questions (the FAQ page does; Game Pass doesn't).
type FAQCategory struct {
	ID           string    `json:"id"`
	PageKey      string    `json:"page_key"`
	Slug         string    `json:"slug"`
	Title        string    `json:"title"`
	Icon         string    `json:"icon"`
	DisplayOrder int       `json:"display_order"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// FAQItem is one question and its answer. CategoryID is nil on pages that
// don't group their questions.
type FAQItem struct {
	ID           string    `json:"id"`
	PageKey      string    `json:"page_key"`
	CategoryID   *string   `json:"category_id"`
	Question     string    `json:"question"`
	Answer       string    `json:"answer"`
	DisplayOrder int       `json:"display_order"`
	IsActive     bool      `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
