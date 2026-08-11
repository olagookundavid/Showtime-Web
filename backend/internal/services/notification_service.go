package services

import (
	"context"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

type INotificationService interface {
	Send(ctx context.Context, userID, nType, title, message, refType string, refID *string) error
	GetUserNotifications(ctx context.Context, userID string, unreadOnly bool, page, limit int) (dto.PaginatedResult[dto.NotificationResponse], error)
	MarkAsRead(ctx context.Context, id string, userID string) error
	MarkAllAsRead(ctx context.Context, userID string) error
	GetUnreadCount(ctx context.Context, userID string) (int, error)
}

type NotificationService struct {
	repo ports.INotificationRepository
}

func NewNotificationService(repo ports.INotificationRepository) INotificationService {
	return &NotificationService{repo: repo}
}

func (s *NotificationService) Send(ctx context.Context, userID, nType, title, message, refType string, refID *string) error {
	if userID == "" {
		return nil
	}
	n := &domain.Notification{
		UserID:        userID,
		Type:          nType,
		Title:         title,
		Message:       message,
		ReferenceType: refType,
		ReferenceID:   refID,
	}
	return s.repo.CreateNotification(ctx, n)
}

func (s *NotificationService) GetUserNotifications(ctx context.Context, userID string, unreadOnly bool, page, limit int) (dto.PaginatedResult[dto.NotificationResponse], error) {
	items, total, err := s.repo.GetNotificationsByUserID(ctx, userID, unreadOnly, page, limit)
	if err != nil {
		return dto.PaginatedResult[dto.NotificationResponse]{}, err
	}

	res := make([]dto.NotificationResponse, 0, len(items))
	for _, n := range items {
		refID := ""
		if n.ReferenceID != nil {
			refID = *n.ReferenceID
		}
		res = append(res, dto.NotificationResponse{
			ID:            n.ID,
			UserID:        n.UserID,
			Type:          n.Type,
			Title:         n.Title,
			Message:       n.Message,
			ReferenceType: n.ReferenceType,
			ReferenceID:   refID,
			IsRead:        n.IsRead,
			CreatedAt:     n.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		})
	}

	totalPages := 0
	if limit > 0 {
		totalPages = int((total + int64(limit) - 1) / int64(limit))
	}

	return dto.PaginatedResult[dto.NotificationResponse]{
		Data:       res,
		Total:      int(total),
		Page:       page,
		Limit:      limit,
		TotalPages: totalPages,
	}, nil
}

func (s *NotificationService) MarkAsRead(ctx context.Context, id string, userID string) error {
	return s.repo.MarkAsRead(ctx, id, userID)
}

func (s *NotificationService) MarkAllAsRead(ctx context.Context, userID string) error {
	return s.repo.MarkAllAsRead(ctx, userID)
}

func (s *NotificationService) GetUnreadCount(ctx context.Context, userID string) (int, error) {
	return s.repo.GetUnreadCount(ctx, userID)
}
