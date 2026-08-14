package ports

import (
	"context"
	"strconv"

	"showtime-backend/internal/domain"

	"github.com/jackc/pgx/v5/pgxpool"
)

type INotificationRepository interface {
	CreateNotification(ctx context.Context, n *domain.Notification) error
	GetNotificationsByUserID(ctx context.Context, userID string, unreadOnly bool, page, limit int) ([]domain.Notification, int64, error)
	MarkAsRead(ctx context.Context, id string, userID string) error
	MarkAllAsRead(ctx context.Context, userID string) error
	GetUnreadCount(ctx context.Context, userID string) (int, error)
}

type PostgresNotificationRepository struct {
	db *pgxpool.Pool
}

func NewNotificationRepository(db *pgxpool.Pool) INotificationRepository {
	return &PostgresNotificationRepository{db: db}
}

func (r *PostgresNotificationRepository) CreateNotification(ctx context.Context, n *domain.Notification) error {
	query := `
		INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, is_read, created_at
	`
	return r.db.QueryRow(ctx, query,
		n.UserID, n.Type, n.Title, n.Message, n.ReferenceType, n.ReferenceID,
	).Scan(&n.ID, &n.IsRead, &n.CreatedAt)
}

func (r *PostgresNotificationRepository) GetNotificationsByUserID(ctx context.Context, userID string, unreadOnly bool, page, limit int) ([]domain.Notification, int64, error) {
	whereClause := ` WHERE user_id = $1`
	args := []any{userID}
	argCount := 2

	if unreadOnly {
		whereClause += ` AND is_read = false`
	}

	var total int64
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM notifications`+whereClause, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := `
		SELECT id, user_id, type, title, message, COALESCE(reference_type, ''), reference_id, is_read, created_at
		FROM notifications` + whereClause + ` ORDER BY created_at DESC`

	if limit > 0 {
		offset := (page - 1) * limit
		if offset < 0 {
			offset = 0
		}
		query += ` LIMIT $` + strconv.Itoa(argCount) + ` OFFSET $` + strconv.Itoa(argCount+1)
		args = append(args, limit, offset)
	}

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var notifications []domain.Notification
	for rows.Next() {
		var n domain.Notification
		err := rows.Scan(
			&n.ID, &n.UserID, &n.Type, &n.Title, &n.Message,
			&n.ReferenceType, &n.ReferenceID, &n.IsRead, &n.CreatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		notifications = append(notifications, n)
	}
	return notifications, total, nil
}

func (r *PostgresNotificationRepository) MarkAsRead(ctx context.Context, id string, userID string) error {
	query := `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`
	_, err := r.db.Exec(ctx, query, id, userID)
	return err
}

func (r *PostgresNotificationRepository) MarkAllAsRead(ctx context.Context, userID string) error {
	query := `UPDATE notifications SET is_read = true WHERE user_id = $1`
	_, err := r.db.Exec(ctx, query, userID)
	return err
}

func (r *PostgresNotificationRepository) GetUnreadCount(ctx context.Context, userID string) (int, error) {
	query := `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false`
	var count int
	err := r.db.QueryRow(ctx, query, userID).Scan(&count)
	return count, err
}
