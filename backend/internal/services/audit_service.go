package services

import (
	"context"
	"encoding/json"
	"log"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/samber/go-batchify"
)

type IAuditService interface {
	LogAction(userID *string, action, entityType string, entityID *string, details *string)
	ListLogs(ctx context.Context, f ports.AuditLogFilter) (dto.PaginatedResult[dto.AuditLogResponse], error)
	Close()
}

type AuditService struct {
	auditRepo ports.IAuditRepository
	authRepo  ports.IAuthRepository
	batcher   batchify.Batch[string, any]
	logStore  sync.Map
}

func NewAuditService(auditRepo ports.IAuditRepository, authRepo ports.IAuthRepository) IAuditService {
	s := &AuditService{
		auditRepo: auditRepo,
		authRepo:  authRepo,
		logStore:  sync.Map{},
	}

	// Initialize the batcher: 20 items or 10 seconds
	s.batcher = batchify.NewBatchWithTimer(20, s.flushLogs, 10*time.Second)

	return s
}

func (s *AuditService) LogAction(userID *string, action, entityType string, entityID *string, details *string) {
	logEntry := ports.AuditLog{
		UserID:     userID,
		Action:     action,
		EntityType: entityType,
		EntityID:   entityID,
		Details:    details,
		CreatedAt:  time.Now(),
	}

	// Filter out actions from regular users (same logic as before)
	// We do this check before batching to save resources
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if userID != nil {
		user, err := s.authRepo.GetUserByID(ctx, *userID)
		if err == nil && user != nil && user.Role == "user" {
			return // Skip logging for regular users
		}
	}

	// Use Worker Pool (ants) to make the logging completely non-blocking
	err := SubmitJob(func() {
		id := uuid.New().String()
		s.logStore.Store(id, logEntry)

		// batcher.Do joins the current batch
		_, _ = s.batcher.Do(id)
	})

	if err != nil {
		log.Println("[ERROR] Failed to submit audit log to worker pool:", err)
	}
}

func (s *AuditService) flushLogs(ids []string) (map[string]any, error) {
	if len(ids) == 0 {
		return nil, nil
	}

	logs := make([]ports.AuditLog, 0, len(ids))
	for _, id := range ids {
		if val, ok := s.logStore.Load(id); ok {
			logs = append(logs, val.(ports.AuditLog))
			s.logStore.Delete(id)
		}
	}

	if len(logs) > 0 {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		err := s.auditRepo.InsertAuditLogsBatch(ctx, logs)
		if err != nil {
			log.Printf("[ERROR] Failed to insert audit logs batch of %d: %v", len(logs), err)
			return nil, err
		}
	}

	return nil, nil
}

func (s *AuditService) Close() {
	if s.batcher != nil {
		s.batcher.Stop()
	}
}

func (s *AuditService) ListLogs(ctx context.Context, f ports.AuditLogFilter) (dto.PaginatedResult[dto.AuditLogResponse], error) {
	entries, total, err := s.auditRepo.ListAuditLogs(ctx, f)
	if err != nil {
		return dto.PaginatedResult[dto.AuditLogResponse]{}, err
	}

	items := make([]dto.AuditLogResponse, 0, len(entries))
	for _, e := range entries {
		item := dto.AuditLogResponse{
			ID:         e.ID,
			UserID:     e.UserID,
			UserName:   e.UserName,
			UserEmail:  e.UserEmail,
			UserRole:   e.UserRole,
			Action:     e.Action,
			EntityType: e.EntityType,
			EntityID:   e.EntityID,
			CreatedAt:  e.CreatedAt,
		}
		if e.Details != nil && json.Valid([]byte(*e.Details)) {
			item.Details = json.RawMessage(*e.Details)
		}
		items = append(items, item)
	}

	limit := f.Limit
	if limit < 1 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}
	page := f.Page
	if page < 1 {
		page = 1
	}
	totalPages := (total + limit - 1) / limit
	if totalPages < 1 {
		totalPages = 1
	}
	return dto.PaginatedResult[dto.AuditLogResponse]{Data: items, Total: total, Page: page, Limit: limit, TotalPages: totalPages}, nil
}
