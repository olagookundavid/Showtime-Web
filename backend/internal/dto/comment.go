package dto

// Page sizing for comment threads. 30 matches the "load more" batch the UI
// renders; the max exists so a crafted ?limit= can't ask for a whole thread.
const (
	DefaultCommentPageSize = 30
	MaxCommentPageSize     = 100
)

type CreateCommentRequest struct {
	EntityType string  `json:"entity_type" binding:"required"` // 'news' or 'match'
	EntityID   string  `json:"entity_id" binding:"required"`
	Content    string  `json:"content" binding:"required"`
	ParentID   *string `json:"parent_id,omitempty"`
}

type UpdateNewsCommentSettingsRequest struct {
	CommentsEnabled bool `json:"comments_enabled"`
}

type CommentResponse struct {
	ID              string            `json:"id"`
	EntityType      string            `json:"entity_type"`
	EntityID        string            `json:"entity_id"`
	UserID          string            `json:"user_id"`
	UserFullName    string            `json:"user_full_name"`
	UserAvatar      string            `json:"user_avatar,omitempty"`
	UserRole        string            `json:"user_role"`
	Content         string            `json:"content"`
	ParentID        *string           `json:"parent_id,omitempty"`
	LikesCount      int               `json:"likes_count"`
	IsLikedByCaller bool              `json:"is_liked_by_caller"`
	CreatedAt       string            `json:"created_at"`
	UpdatedAt       string            `json:"updated_at"`
	Replies         []CommentResponse `json:"replies"`
}

// CommentListResponse mirrors PaginatedResponse's shape so the comment endpoint
// reads like every other paginated list in the API. Total counts top-level
// comments (what pages are made of); TotalAll includes replies and is the number
// the UI puts on the thread.
type CommentListResponse struct {
	Data       []CommentResponse `json:"data"`
	Total      int               `json:"total"`
	TotalAll   int               `json:"total_all"`
	Page       int               `json:"page"`
	Limit      int               `json:"limit"`
	TotalPages int               `json:"total_pages"`
	HasMore    bool              `json:"has_more"`
}
