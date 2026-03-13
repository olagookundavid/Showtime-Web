package services

import (
	"context"
	"log"
	"showtime-backend/internal/ports"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/samber/go-batchify"
)

type IAuditService interface {
	LogAction(userID *string, action, entityType string, entityID *string, details *string)
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
		log.Printf("[INFO] Successfully batched %d audit logs", len(logs))
	}

	return nil, nil
}

func (s *AuditService) Close() {
	if s.batcher != nil {
		s.batcher.Stop()
	}
}
