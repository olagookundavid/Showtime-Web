package ports

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type AuditLog struct {
	ID         string
	UserID     *string
	Action     string
	EntityType string
	EntityID   *string
	Details    *string
	CreatedAt  time.Time
}

type IAuditRepository interface {
	InsertAuditLog(ctx context.Context, log AuditLog) error
}

type AuditRepository struct {
	Db *pgxpool.Pool
}

func NewAuditRepository(Db *pgxpool.Pool) IAuditRepository {
	return &AuditRepository{Db: Db}
}

func (r *AuditRepository) InsertAuditLog(ctx context.Context, log AuditLog) error {
	query := `
		INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
		VALUES ($1, $2, $3, $4, $5)
	`
	_, err := r.Db.Exec(ctx, query, log.UserID, log.Action, log.EntityType, log.EntityID, log.Details)
	return err
}
