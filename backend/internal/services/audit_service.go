package services

import (
	"context"
	"log"
	"showtime-backend/internal/ports"
	"time"
)

type IAuditService interface {
	LogAction(userID *string, action, entityType string, entityID *string, details *string)
	Close()
}

type AuditService struct {
	auditRepo ports.IAuditRepository
	authRepo  ports.IAuthRepository
	logCh     chan ports.AuditLog
	doneCh    chan struct{}
}

func NewAuditService(auditRepo ports.IAuditRepository, authRepo ports.IAuthRepository) IAuditService {
	s := &AuditService{
		auditRepo: auditRepo,
		authRepo:  authRepo,
		logCh:     make(chan ports.AuditLog, 1000), // Buffered channel to prevent blocking
		doneCh:    make(chan struct{}),
	}
	go s.processLogs()
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

	select {
	case s.logCh <- logEntry:
		// Attempt to enqueue log asynchronously
	default:
		// Log channel is full, log to console to avoid blocking the caller
		log.Println("[WARNING] Audit log channel full. Dropping log:", logEntry)
	}
}

func (s *AuditService) processLogs() {
	for {
		select {
		case logEntry := <-s.logCh:
			s.insertLog(logEntry)
		case <-s.doneCh:
			// Process remaining logs before shutting down
			close(s.logCh)
			for logEntry := range s.logCh {
				s.insertLog(logEntry)
			}
			return
		}
	}
}

func (s *AuditService) insertLog(logEntry ports.AuditLog) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Filter out actions from regular users
	if logEntry.UserID != nil {
		user, err := s.authRepo.GetUserByID(ctx, *logEntry.UserID)
		if err == nil && user != nil {
			if user.Role == "user" {
				return // Skip logging for regular users
			}
		}
	}

	err := s.auditRepo.InsertAuditLog(ctx, logEntry)
	if err != nil {
		log.Println("[ERROR] Failed to insert audit log:", err)
	}
}

func (s *AuditService) Close() {
	close(s.doneCh)
}
