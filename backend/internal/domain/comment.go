package domain

import "time"

type Comment struct {
	ID              string    `json:"id"`
	EntityType      string    `json:"entity_type"` // 'news' or 'match'
	EntityID        string    `json:"entity_id"`   // news_id or match_id
	UserID          string    `json:"user_id"`
	UserFullName    string    `json:"user_full_name"`
	UserAvatar      string    `json:"user_avatar,omitempty"`
	UserRole        string    `json:"user_role"`
	Content         string    `json:"content"`
	ParentID        *string   `json:"parent_id,omitempty"`
	LikesCount      int       `json:"likes_count"`
	IsLikedByCaller bool      `json:"is_liked_by_caller"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`

	// 1-level nested replies
	Replies []Comment `json:"replies"`
}

// CommentPage is one page of a thread. Only top-level comments are paginated —
// a parent always arrives with its full reply list attached, so "load more"
// never splits a conversation across a page boundary.
//
// TotalTopLevel drives the pagination maths; TotalAll counts replies too and is
// what the UI shows as the thread's comment count.
type CommentPage struct {
	Comments      []Comment
	TotalTopLevel int
	TotalAll      int
}
