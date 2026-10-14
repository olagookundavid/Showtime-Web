package domain

import "time"

type ScheduledEmailKind string

const (
	ScheduledEmailDayReminder ScheduledEmailKind = "DAY_REMINDER"
)

type ScheduledEmailStatus string

const (
	ScheduledEmailPending   ScheduledEmailStatus = "PENDING"
	ScheduledEmailSending   ScheduledEmailStatus = "SENDING"
	ScheduledEmailSent      ScheduledEmailStatus = "SENT"
	ScheduledEmailFailed    ScheduledEmailStatus = "FAILED"
	ScheduledEmailCancelled ScheduledEmailStatus = "CANCELLED"
)

// ScheduledEmail is an email that is due at a later time. What it says is read
// from the ticket when it is sent, not stored here.
type ScheduledEmail struct {
	ID          string               `json:"id"`
	Kind        ScheduledEmailKind   `json:"kind"`
	TicketID    string               `json:"ticket_id"`
	TicketDayID *string              `json:"ticket_day_id,omitempty"`
	ToEmail     string               `json:"to_email"`
	SendAt      time.Time            `json:"send_at"`
	Status      ScheduledEmailStatus `json:"status"`
	Attempts    int                  `json:"attempts"`
	LastError   *string              `json:"last_error,omitempty"`
	SentAt      *time.Time           `json:"sent_at,omitempty"`
	DedupeKey   string               `json:"dedupe_key"`
	CreatedAt   time.Time            `json:"created_at"`
	UpdatedAt   time.Time            `json:"updated_at"`
}
