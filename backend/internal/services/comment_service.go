package services

import (
	"context"
	"fmt"
	"math"
	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
	"strings"
)

type ICommentService interface {
	GetCommentsByEntity(ctx context.Context, entityType string, entityID string, callerUserID string, page int, limit int) (*dto.CommentListResponse, error)
	CreateComment(ctx context.Context, userID string, req dto.CreateCommentRequest) (*dto.CommentResponse, error)
	DeleteComment(ctx context.Context, commentID string, userID string, isAdmin bool) error
	ToggleLike(ctx context.Context, commentID string, userID string) (bool, int, error)
	UpdateNewsCommentSettings(ctx context.Context, newsID string, commentsEnabled bool) error
}

type CommentService struct {
	commentRepo ports.ICommentRepository
	newsRepo    ports.NewsRepository
	matchRepo   ports.MatchRepository
}

func NewCommentService(commentRepo ports.ICommentRepository, newsRepo ports.NewsRepository, matchRepo ports.MatchRepository) ICommentService {
	return &CommentService{
		commentRepo: commentRepo,
		newsRepo:    newsRepo,
		matchRepo:   matchRepo,
	}
}

func (s *CommentService) GetCommentsByEntity(ctx context.Context, entityType string, entityID string, callerUserID string, page int, limit int) (*dto.CommentListResponse, error) {
	if entityType != "news" && entityType != "match" {
		return nil, fmt.Errorf("invalid entity_type: must be 'news' or 'match'")
	}
	if entityID == "" {
		return nil, fmt.Errorf("entity_id is required")
	}

	// Clamped rather than rejected: a bad page number on a public read should
	// show the first page, not an error where comments used to be.
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = dto.DefaultCommentPageSize
	}
	if limit > dto.MaxCommentPageSize {
		limit = dto.MaxCommentPageSize
	}

	result, err := s.commentRepo.GetCommentsByEntity(ctx, entityType, entityID, callerUserID, limit, (page-1)*limit)
	if err != nil {
		return nil, err
	}

	items := make([]dto.CommentResponse, 0, len(result.Comments))
	for _, c := range result.Comments {
		items = append(items, mapCommentToResponse(c))
	}

	totalPages := 0
	if result.TotalTopLevel > 0 {
		totalPages = int(math.Ceil(float64(result.TotalTopLevel) / float64(limit)))
	}

	return &dto.CommentListResponse{
		Data:       items,
		Total:      result.TotalTopLevel,
		TotalAll:   result.TotalAll,
		Page:       page,
		Limit:      limit,
		TotalPages: totalPages,
		HasMore:    page < totalPages,
	}, nil
}

func (s *CommentService) CreateComment(ctx context.Context, userID string, req dto.CreateCommentRequest) (*dto.CommentResponse, error) {
	if userID == "" {
		return nil, fmt.Errorf("unauthorized: you must be logged in to post a comment")
	}

	content := strings.TrimSpace(req.Content)
	if content == "" {
		return nil, fmt.Errorf("comment content cannot be empty")
	}
	if len(content) > 1000 {
		return nil, fmt.Errorf("comment content exceeds maximum length of 1000 characters")
	}

	if req.EntityType != "news" && req.EntityType != "match" {
		return nil, fmt.Errorf("invalid entity_type: must be 'news' or 'match'")
	}

	// Verify entity existence & comment feature flags
	if req.EntityType == "news" {
		article, err := s.newsRepo.FindByID(ctx, req.EntityID)
		if err != nil || article == nil {
			return nil, fmt.Errorf("news article not found")
		}
		if !article.CommentsEnabled {
			return nil, fmt.Errorf("comments are disabled for this news article")
		}
	} else if req.EntityType == "match" {
		match, err := s.matchRepo.GetMatchByID(ctx, req.EntityID)
		if err != nil || match == nil {
			return nil, fmt.Errorf("match not found")
		}
	}

	// Handle 1-level reply nesting: if parent_id is given, ensure parent exists
	var targetParentID *string
	if req.ParentID != nil && *req.ParentID != "" {
		parent, err := s.commentRepo.GetCommentByID(ctx, *req.ParentID)
		if err != nil || parent == nil {
			return nil, fmt.Errorf("parent comment not found")
		}
		// If parent is itself a reply, attach this reply to the top-level parent
		if parent.ParentID != nil {
			targetParentID = parent.ParentID
		} else {
			targetParentID = &parent.ID
		}
	}

	comment := &domain.Comment{
		EntityType: req.EntityType,
		EntityID:   req.EntityID,
		UserID:     userID,
		Content:    content,
		ParentID:   targetParentID,
	}

	if err := s.commentRepo.CreateComment(ctx, comment); err != nil {
		return nil, err
	}

	resp := mapCommentToResponse(*comment)
	return &resp, nil
}

func (s *CommentService) DeleteComment(ctx context.Context, commentID string, userID string, isAdmin bool) error {
	if userID == "" {
		return fmt.Errorf("unauthorized")
	}
	return s.commentRepo.DeleteComment(ctx, commentID, userID, isAdmin)
}

func (s *CommentService) ToggleLike(ctx context.Context, commentID string, userID string) (bool, int, error) {
	if userID == "" {
		return false, 0, fmt.Errorf("unauthorized: you must be logged in to like a comment")
	}
	return s.commentRepo.ToggleLike(ctx, commentID, userID)
}

func (s *CommentService) UpdateNewsCommentSettings(ctx context.Context, newsID string, commentsEnabled bool) error {
	return s.newsRepo.UpdateCommentSettings(ctx, newsID, commentsEnabled)
}

func mapCommentToResponse(c domain.Comment) dto.CommentResponse {
	replies := make([]dto.CommentResponse, 0, len(c.Replies))
	for _, r := range c.Replies {
		replies = append(replies, mapCommentToResponse(r))
	}

	return dto.CommentResponse{
		ID:              c.ID,
		EntityType:      c.EntityType,
		EntityID:        c.EntityID,
		UserID:          c.UserID,
		UserFullName:    c.UserFullName,
		UserAvatar:      c.UserAvatar,
		UserRole:        c.UserRole,
		Content:         c.Content,
		ParentID:        c.ParentID,
		LikesCount:      c.LikesCount,
		IsLikedByCaller: c.IsLikedByCaller,
		CreatedAt:       c.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:       c.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
		Replies:         replies,
	}
}
