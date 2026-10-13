package ports

import (
	"context"
	"time"

	"showtime-backend/internal/domain"

	"github.com/jackc/pgx/v5/pgxpool"
)

type ScheduledEmailRepository interface {
	// Schedule stores an email to send later. A row with the same dedupe key is
	// left alone, so scheduling is safe to repeat.
	Schedule(ctx context.Context, e *domain.ScheduledEmail) error
	// ClaimDue atomically takes up to limit due rows and marks them SENDING, so
	// two workers can never send the same email.
	ClaimDue(ctx context.Context, limit int) ([]domain.ScheduledEmail, error)
	MarkSent(ctx context.Context, id string) error
	// MarkFailed records a failed attempt. The row goes back to PENDING for a retry
	// at retryAt, or to FAILED when retryAt is nil.
	MarkFailed(ctx context.Context, id string, reason string, retryAt *time.Time) error
	MarkCancelled(ctx context.Context, id string, reason string) error
	// CancelForTicket cancels every unsent email for a ticket.
	CancelForTicket(ctx context.Context, ticketID string) error
	// RescheduleForEventDay recomputes the send time of unsent day reminders after
	// a match day's date changes.
	RescheduleForEventDay(ctx context.Context, eventDayID string, daysBefore, hour int) error
	// RecoverStuck returns rows left SENDING by a crashed worker to PENDING.
	RecoverStuck(ctx context.Context, olderThan time.Duration) (int64, error)
}

type PostgresScheduledEmailRepository struct {
	db *pgxpool.Pool
}

func NewScheduledEmailRepository(db *pgxpool.Pool) *PostgresScheduledEmailRepository {
	return &PostgresScheduledEmailRepository{db: db}
}

func (r *PostgresScheduledEmailRepository) Schedule(ctx context.Context, e *domain.ScheduledEmail) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO scheduled_emails (kind, ticket_id, ticket_day_id, to_email, send_at, dedupe_key)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (dedupe_key) DO NOTHING`,
		e.Kind, e.TicketID, e.TicketDayID, e.ToEmail, e.SendAt, e.DedupeKey)
	return err
}

func (r *PostgresScheduledEmailRepository) ClaimDue(ctx context.Context, limit int) ([]domain.ScheduledEmail, error) {
	rows, err := r.db.Query(ctx, `
		UPDATE scheduled_emails SET status = 'SENDING', attempts = attempts + 1, updated_at = NOW()
		WHERE id IN (
			SELECT id FROM scheduled_emails
			WHERE status = 'PENDING' AND send_at <= NOW()
			ORDER BY send_at ASC
			LIMIT $1
			FOR UPDATE SKIP LOCKED)
		RETURNING id, kind, ticket_id, ticket_day_id, to_email, send_at, status, attempts, last_error,
		          sent_at, dedupe_key, created_at, updated_at`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.ScheduledEmail
	for rows.Next() {
		var e domain.ScheduledEmail
		if err := rows.Scan(&e.ID, &e.Kind, &e.TicketID, &e.TicketDayID, &e.ToEmail, &e.SendAt, &e.Status,
			&e.Attempts, &e.LastError, &e.SentAt, &e.DedupeKey, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (r *PostgresScheduledEmailRepository) MarkSent(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE scheduled_emails SET status = 'SENT', sent_at = NOW(), last_error = NULL, updated_at = NOW() WHERE id = $1`, id)
	return err
}

func (r *PostgresScheduledEmailRepository) MarkFailed(ctx context.Context, id string, reason string, retryAt *time.Time) error {
	if retryAt == nil {
		_, err := r.db.Exec(ctx,
			`UPDATE scheduled_emails SET status = 'FAILED', last_error = $2, updated_at = NOW() WHERE id = $1`, id, reason)
		return err
	}
	_, err := r.db.Exec(ctx,
		`UPDATE scheduled_emails SET status = 'PENDING', send_at = $3, last_error = $2, updated_at = NOW() WHERE id = $1`,
		id, reason, *retryAt)
	return err
}

func (r *PostgresScheduledEmailRepository) MarkCancelled(ctx context.Context, id string, reason string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE scheduled_emails SET status = 'CANCELLED', last_error = $2, updated_at = NOW() WHERE id = $1`, id, reason)
	return err
}

func (r *PostgresScheduledEmailRepository) CancelForTicket(ctx context.Context, ticketID string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE scheduled_emails SET status = 'CANCELLED', last_error = 'ticket no longer valid', updated_at = NOW()
		WHERE ticket_id = $1 AND status IN ('PENDING', 'SENDING')`, ticketID)
	return err
}

func (r *PostgresScheduledEmailRepository) RescheduleForEventDay(ctx context.Context, eventDayID string, daysBefore, hour int) error {
	_, err := r.db.Exec(ctx, `
		UPDATE scheduled_emails se
		SET send_at = (((ed.date - $2::int)::timestamp + make_interval(hours => $3::int)) AT TIME ZONE 'Africa/Lagos'),
		    updated_at = NOW()
		FROM ticket_days td
		JOIN event_days ed ON ed.id = td.event_day_id
		WHERE se.ticket_day_id = td.id AND td.event_day_id = $1
		  AND se.kind = 'DAY_REMINDER' AND se.status = 'PENDING'`,
		eventDayID, daysBefore, hour)
	return err
}

func (r *PostgresScheduledEmailRepository) RecoverStuck(ctx context.Context, olderThan time.Duration) (int64, error) {
	res, err := r.db.Exec(ctx, `
		UPDATE scheduled_emails SET status = 'PENDING', updated_at = NOW()
		WHERE status = 'SENDING' AND updated_at < NOW() - make_interval(secs => $1::float8)`,
		olderThan.Seconds())
	if err != nil {
		return 0, err
	}
	return res.RowsAffected(), nil
}
