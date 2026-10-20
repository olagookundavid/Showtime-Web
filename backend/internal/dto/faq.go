package dto

// ── Requests (admin) ─────────────────────────────────────────────────────────

type CreateFAQPageRequest struct {
	Key         string `json:"key" binding:"required"`
	Name        string `json:"name" binding:"required"`
	Path        string `json:"path"`
	Description string `json:"description"`
}

// UpdateFAQPageRequest replaces the page's editable fields. The key never changes.
type UpdateFAQPageRequest struct {
	Name        string `json:"name" binding:"required"`
	Path        string `json:"path"`
	Description string `json:"description"`
}

type CreateFAQCategoryRequest struct {
	Title string `json:"title" binding:"required"`
	Icon  string `json:"icon"`
}

// UpdateFAQCategoryRequest replaces the category's title and icon. The slug never changes.
type UpdateFAQCategoryRequest struct {
	Title string `json:"title" binding:"required"`
	Icon  string `json:"icon"`
}

type CreateFAQItemRequest struct {
	CategoryID *string `json:"category_id"` // omit or null for an ungrouped page
	Question   string  `json:"question" binding:"required"`
	Answer     string  `json:"answer" binding:"required"`
	IsActive   *bool   `json:"is_active"` // defaults to true
}

// UpdateFAQItemRequest replaces the question in full; send every field.
type UpdateFAQItemRequest struct {
	CategoryID *string `json:"category_id"`
	Question   string  `json:"question" binding:"required"`
	Answer     string  `json:"answer" binding:"required"`
	IsActive   *bool   `json:"is_active" binding:"required"`
}

// ReorderFAQRequest sets display order to the position in IDs. Kind is
// "category" or "item"; send the ids of one page's categories, or of one
// category's (or one ungrouped page's) items.
type ReorderFAQRequest struct {
	Kind string   `json:"kind" binding:"required"`
	IDs  []string `json:"ids" binding:"required"`
}

// ── Responses ────────────────────────────────────────────────────────────────

type FAQPageSummaryResponse struct {
	Key           string `json:"key"`
	Name          string `json:"name"`
	Path          string `json:"path"`
	Description   string `json:"description"`
	CategoryCount int    `json:"category_count"`
	ItemCount     int    `json:"item_count"`
}

type FAQItemResponse struct {
	ID           string  `json:"id"`
	CategoryID   *string `json:"category_id"`
	Question     string  `json:"question"`
	Answer       string  `json:"answer"`
	DisplayOrder int     `json:"display_order"`
	IsActive     bool    `json:"is_active"`
}

type FAQCategoryResponse struct {
	ID           string            `json:"id"`
	Slug         string            `json:"slug"`
	Title        string            `json:"title"`
	Icon         string            `json:"icon"`
	DisplayOrder int               `json:"display_order"`
	FAQs         []FAQItemResponse `json:"faqs"`
}

// FAQPageResponse is everything a page shows: its categories (each with their
// questions) and the questions that belong to no category. The public endpoint
// returns active questions only and drops categories left empty by that.
type FAQPageResponse struct {
	Key         string                `json:"key"`
	Name        string                `json:"name"`
	Path        string                `json:"path"`
	Description string                `json:"description"`
	Categories  []FAQCategoryResponse `json:"categories"`
	FAQs        []FAQItemResponse     `json:"faqs"`
}
