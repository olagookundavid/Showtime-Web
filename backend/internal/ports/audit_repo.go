package ports

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
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

// AuditLogEntry is an audit row joined to the user who caused it.
type AuditLogEntry struct {
	AuditLog
	UserName  *string
	UserEmail *string
	UserRole  *string
}

// AuditLogFilter narrows the audit trail. The zero value is "everything routine, newest first".
type AuditLogFilter struct {
	// Search matches the request path, the recorded details and the actor's name or email.
	Search string
	UserID string
	// Action is an exact match: an HTTP verb (POST, PUT, ...) or a system action name.
	Action string
	// SystemOnly keeps only events the platform raised itself (contract expiry...), which
	// have no HTTP verb for an action.
	SystemOnly bool
	From, To   *time.Time
	// IncludeNoise lets the health-check pings and anonymous login attempts back in.
	IncludeNoise bool
	Page, Limit  int
}

type IAuditRepository interface {
	InsertAuditLog(ctx context.Context, log AuditLog) error
	InsertAuditLogsBatch(ctx context.Context, logs []AuditLog) error
	ListAuditLogs(ctx context.Context, f AuditLogFilter) ([]AuditLogEntry, int, error)
}

type AuditRepository struct {
	Db *pgxpool.Pool
}

func NewAuditRepository(Db *pgxpool.Pool) IAuditRepository {
	return &AuditRepository{Db: Db}
}

func (r *AuditRepository) InsertAuditLog(ctx context.Context, log AuditLog) error {
	query := `
		INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`
	_, err := r.Db.Exec(ctx, query, log.UserID, log.Action, log.EntityType, log.EntityID, log.Details, eventTime(log))
	return err
}

func (r *AuditRepository) InsertAuditLogsBatch(ctx context.Context, logs []AuditLog) error {
	if len(logs) == 0 {
		return nil
	}

	// Using pgx CopyFrom for efficient batch insertion
	rows := make([][]interface{}, len(logs))
	for i, log := range logs {
		rows[i] = []interface{}{log.UserID, log.Action, log.EntityType, log.EntityID, log.Details, eventTime(log)}
	}

	_, err := r.Db.CopyFrom(
		ctx,
		pgx.Identifier{"audit_logs"},
		[]string{"user_id", "action", "entity_type", "entity_id", "details", "created_at"},
		pgx.CopyFromRows(rows),
	)
	return err
}

// eventTime is when the action happened. Rows are written in batches up to ten seconds
// after the fact, so the database default (the flush time) would blur the order of events.
func eventTime(log AuditLog) time.Time {
	if log.CreatedAt.IsZero() {
		return time.Now()
	}
	return log.CreatedAt
}

func (r *AuditRepository) ListAuditLogs(ctx context.Context, f AuditLogFilter) ([]AuditLogEntry, int, error) {
	var (
		where []string
		args  []interface{}
	)
	arg := func(v interface{}) string {
		args = append(args, v)
		return fmt.Sprintf("$%d", len(args))
	}

	if f.UserID != "" {
		where = append(where, "a.user_id = "+arg(f.UserID)+"::uuid")
	}
	if f.Action != "" {
		where = append(where, "a.action = "+arg(f.Action))
	}
	if f.SystemOnly {
		where = append(where, "a.action NOT IN ('GET','HEAD','OPTIONS','POST','PUT','PATCH','DELETE')")
	}
	if f.From != nil {
		where = append(where, "a.created_at >= "+arg(*f.From))
	}
	if f.To != nil {
		where = append(where, "a.created_at < "+arg(*f.To))
	}
	if q := strings.TrimSpace(f.Search); q != "" {
		p := arg("%" + q + "%")
		where = append(where, fmt.Sprintf(
			"(a.entity_type ILIKE %[1]s OR a.entity_id ILIKE %[1]s OR a.details::text ILIKE %[1]s OR u.email ILIKE %[1]s OR u.full_name ILIKE %[1]s)", p))
	}
	if !f.IncludeNoise {
		where = append(where,
			"a.entity_type NOT LIKE '%/healthcheck'",
			"NOT (a.user_id IS NULL AND a.entity_type LIKE '/api/v1/auth/%')")
	}

	clause := ""
	if len(where) > 0 {
		clause = "WHERE " + strings.Join(where, " AND ")
	}
	from := "FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id " + clause

	var total int
	if err := r.Db.QueryRow(ctx, "SELECT count(*) "+from, args...).Scan(&total); err != nil {
		return nil, 0, err
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

	query := `
		SELECT a.id::text, a.user_id::text, a.action, a.entity_type, a.entity_id, a.details::text, a.created_at,
		       u.full_name, u.email, u.role ` + from + `
		ORDER BY a.created_at DESC, a.id
		LIMIT ` + arg(limit) + ` OFFSET ` + arg((page-1)*limit)

	rows, err := r.Db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	entries := make([]AuditLogEntry, 0, limit)
	for rows.Next() {
		var e AuditLogEntry
		if err := rows.Scan(&e.ID, &e.UserID, &e.Action, &e.EntityType, &e.EntityID, &e.Details, &e.CreatedAt,
			&e.UserName, &e.UserEmail, &e.UserRole); err != nil {
			return nil, 0, err
		}
		entries = append(entries, e)
	}
	return entries, total, rows.Err()
}
