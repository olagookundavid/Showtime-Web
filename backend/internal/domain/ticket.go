package domain

import "time"

type TicketStatus string

const (
	TicketStatusPending   TicketStatus = "PENDING"
	TicketStatusPaid      TicketStatus = "PAID"
	TicketStatusFailed    TicketStatus = "FAILED"
	TicketStatusUsed      TicketStatus = "USED"
	TicketStatusCancelled TicketStatus = "CANCELLED"
)

type Ticket struct {
	ID                 string       `json:"id"`
	MatchID            string       `json:"match_id"`
	Email              string       `json:"email"`
	UserID             *string      `json:"user_id,omitempty"`
	Quantity           int          `json:"quantity"`
	UnitPrice          int          `json:"unit_price"`
	TotalAmount        int          `json:"total_amount"`
	Status             TicketStatus `json:"status"`
	PaystackReference  string       `json:"paystack_reference"`
	PaystackAccessCode string       `json:"paystack_access_code"`
	TicketCode         string       `json:"ticket_code"`
	CheckedInAt        *time.Time   `json:"checked_in_at,omitempty"`
	CheckedInBy        *string      `json:"checked_in_by,omitempty"`
	CreatedAt          time.Time    `json:"created_at"`
	UpdatedAt          time.Time    `json:"updated_at"`

	// Relations
	Match *Match `json:"match,omitempty"`
}
