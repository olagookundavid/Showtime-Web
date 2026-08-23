package ports

import (
	"context"
	"fmt"
	"showtime-backend/internal/domain"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ICommentRepository interface {
	GetCommentsByEntity(ctx context.Context, entityType string, entityID string, callerUserID string, limit int, offset int) (*domain.CommentPage, error)
	GetCommentByID(ctx context.Context, commentID string) (*domain.Comment, error)
	CreateComment(ctx context.Context, comment *domain.Comment) error
	DeleteComment(ctx context.Context, commentID string, userID string, isAdmin bool) error
	ToggleLike(ctx context.Context, commentID string, userID string) (bool, int, error)
}

type CommentRepository struct {
	db *pgxpool.Pool
}

func NewCommentRepository(db *pgxpool.Pool) ICommentRepository {
	return &CommentRepository{db: db}
}

// commentColumns is the shared projection for every comment read. The two page
// queries below number their placeholders differently, so the caller-liked
// expression is appended per-query rather than baked in here.
const commentColumns = `
	c.id, c.entity_type, c.entity_id, c.user_id, c.content, c.parent_id, c.likes_count, c.created_at, c.updated_at,
	COALESCE(u.full_name, 'User') AS user_full_name,
	COALESCE(u.role, 'user') AS user_role`

// scanCommentRows reads rows shaped by commentColumns plus a trailing
// is_liked_by_caller boolean.
func scanCommentRows(rows pgx.Rows) ([]domain.Comment, error) {
	defer rows.Close()

	comments := []domain.Comment{}
	for rows.Next() {
		var c domain.Comment
		var parentID *string
		if err := rows.Scan(
			&c.ID, &c.EntityType, &c.EntityID, &c.UserID, &c.Content, &parentID, &c.LikesCount, &c.CreatedAt, &c.UpdatedAt,
			&c.UserFullName, &c.UserRole, &c.IsLikedByCaller,
		); err != nil {
			return nil, fmt.Errorf("failed to scan comment: %w", err)
		}
		c.ParentID = parentID
		c.Replies = []domain.Comment{}
		comments = append(comments, c)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to read comments: %w", err)
	}
	return comments, nil
}

// GetCommentsByEntity returns one page of top-level comments, newest first, each
// with its replies attached oldest-first. limit/offset apply to top-level
// comments only — see domain.CommentPage.
func (r *CommentRepository) GetCommentsByEntity(ctx context.Context, entityType string, entityID string, callerUserID string, limit int, offset int) (*domain.CommentPage, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	page := &domain.CommentPage{Comments: []domain.Comment{}}

	// Counted separately rather than with COUNT(*) OVER(): a window count
	// returns no row at all once the offset runs past the end, which would
	// report an empty thread on the last "load more".
	err := r.db.QueryRow(ctx, `
		SELECT COUNT(*) FILTER (WHERE parent_id IS NULL), COUNT(*)
		FROM comments
		WHERE entity_type = $1 AND entity_id = $2
	`, entityType, entityID).Scan(&page.TotalTopLevel, &page.TotalAll)
	if err != nil {
		return nil, fmt.Errorf("failed to count comments: %w", err)
	}
	if page.TotalTopLevel == 0 || offset >= page.TotalTopLevel {
		return page, nil
	}

	// Newest first so page 1 is always the freshest part of the conversation and
	// "load more" walks backwards in time.
	topLevelQuery := `
		SELECT ` + commentColumns + `,
			CASE WHEN $3::text != '' AND EXISTS (
				SELECT 1 FROM comment_likes cl WHERE cl.comment_id = c.id AND cl.user_id = $3::uuid
			) THEN TRUE ELSE FALSE END AS is_liked_by_caller
		FROM comments c
		LEFT JOIN users u ON c.user_id = u.id
		WHERE c.entity_type = $1 AND c.entity_id = $2 AND c.parent_id IS NULL
		ORDER BY c.created_at DESC
		LIMIT $4 OFFSET $5
	`

	rows, err := r.db.Query(ctx, topLevelQuery, entityType, entityID, callerUserID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to query comments: %w", err)
	}
	topLevel, err := scanCommentRows(rows)
	if err != nil {
		return nil, err
	}
	if len(topLevel) == 0 {
		return page, nil
	}

	parentIDs := make([]string, 0, len(topLevel))
	for i := range topLevel {
		parentIDs = append(parentIDs, topLevel[i].ID)
	}

	// Replies for this page's parents only, oldest first — a thread reads top to
	// bottom the way it was written.
	replyQuery := `
		SELECT ` + commentColumns + `,
			CASE WHEN $1::text != '' AND EXISTS (
				SELECT 1 FROM comment_likes cl WHERE cl.comment_id = c.id AND cl.user_id = $1::uuid
			) THEN TRUE ELSE FALSE END AS is_liked_by_caller
		FROM comments c
		LEFT JOIN users u ON c.user_id = u.id
		WHERE c.parent_id = ANY($2::uuid[])
		ORDER BY c.created_at ASC
	`

	replyRows, err := r.db.Query(ctx, replyQuery, callerUserID, parentIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to query comment replies: %w", err)
	}
	replies, err := scanCommentRows(replyRows)
	if err != nil {
		return nil, err
	}

	byID := make(map[string]*domain.Comment, len(topLevel))
	for i := range topLevel {
		byID[topLevel[i].ID] = &topLevel[i]
	}
	for _, reply := range replies {
		if reply.ParentID == nil {
			continue
		}
		if parent, ok := byID[*reply.ParentID]; ok {
			parent.Replies = append(parent.Replies, reply)
		}
	}

	page.Comments = topLevel
	return page, nil
}

func (r *CommentRepository) GetCommentByID(ctx context.Context, commentID string) (*domain.Comment, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	query := `
		SELECT ` + commentColumns + `
		FROM comments c
		LEFT JOIN users u ON c.user_id = u.id
		WHERE c.id = $1
	`
	var c domain.Comment
	var parentID *string
	err := r.db.QueryRow(ctx, query, commentID).Scan(
		&c.ID, &c.EntityType, &c.EntityID, &c.UserID, &c.Content, &parentID, &c.LikesCount, &c.CreatedAt, &c.UpdatedAt,
		&c.UserFullName, &c.UserRole,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	c.ParentID = parentID
	return &c, nil
}

func (r *CommentRepository) CreateComment(ctx context.Context, comment *domain.Comment) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	query := `
		INSERT INTO comments (entity_type, entity_id, user_id, content, parent_id)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at
	`
	err := r.db.QueryRow(ctx, query,
		comment.EntityType, comment.EntityID, comment.UserID, comment.Content, comment.ParentID,
	).Scan(&comment.ID, &comment.CreatedAt, &comment.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to insert comment: %w", err)
	}

	// Author details for the optimistic render the client does with this
	// response. The comment is already committed, so a failure here is cosmetic
	// only — fall back to the same defaults the read path uses.
	fullName, role := "User", "user"
	_ = r.db.QueryRow(ctx, `SELECT COALESCE(full_name, 'User'), COALESCE(role, 'user') FROM users WHERE id = $1`, comment.UserID).Scan(&fullName, &role)
	comment.UserFullName = fullName
	comment.UserRole = role
	return nil
}

func (r *CommentRepository) DeleteComment(ctx context.Context, commentID string, userID string, isAdmin bool) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var query string
	var args []any
	if isAdmin {
		query = `DELETE FROM comments WHERE id = $1`
		args = []any{commentID}
	} else {
		query = `DELETE FROM comments WHERE id = $1 AND user_id = $2`
		args = []any{commentID, userID}
	}

	tag, err := r.db.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to delete comment: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("comment not found or unauthorized")
	}
	return nil
}

func (r *CommentRepository) ToggleLike(ctx context.Context, commentID string, userID string) (bool, int, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var exists bool
	err := r.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM comment_likes WHERE comment_id = $1 AND user_id = $2)`, commentID, userID).Scan(&exists)
	if err != nil {
		return false, 0, err
	}

	if exists {
		_, err = r.db.Exec(ctx, `DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2`, commentID, userID)
		if err != nil {
			return false, 0, err
		}
		var newCount int
		err = r.db.QueryRow(ctx, `UPDATE comments SET likes_count = GREATEST(0, likes_count - 1), updated_at = NOW() WHERE id = $1 RETURNING likes_count`, commentID).Scan(&newCount)
		return false, newCount, err
	}

	_, err = r.db.Exec(ctx, `INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2)`, commentID, userID)
	if err != nil {
		return false, 0, err
	}
	var newCount int
	err = r.db.QueryRow(ctx, `UPDATE comments SET likes_count = likes_count + 1, updated_at = NOW() WHERE id = $1 RETURNING likes_count`, commentID).Scan(&newCount)
	return true, newCount, err
}
