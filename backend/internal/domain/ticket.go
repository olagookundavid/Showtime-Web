package domain

import "time"

// ─── Event Day ────────────────────────────────────────────────────────────────

type EventDay struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Date      time.Time `json:"date"`
	Venue     string    `json:"venue"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// Relations
	Tiers   []TicketTier `json:"tiers,omitempty"`
	Matches []Match      `json:"matches,omitempty"`
}

// ─── Ticket Tier ──────────────────────────────────────────────────────────────

type TicketTier struct {
	ID          string    `json:"id"`
	EventDayID  string    `json:"event_day_id"`
	Name        string    `json:"name"`
	Price       int       `json:"price"`
	Capacity    int       `json:"capacity"`
	SoldCount   int       `json:"sold_count"`
	Description string    `json:"description"`
	IsHidden    bool      `json:"is_hidden"`
	AccessCode  *string   `json:"access_code,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// ─── Ticket ───────────────────────────────────────────────────────────────────

type TicketStatus string

const (
	TicketStatusPending   TicketStatus = "PENDING"
	TicketStatusPaid      TicketStatus = "PAID"
	TicketStatusFailed    TicketStatus = "FAILED"
	TicketStatusUsed      TicketStatus = "USED"
	TicketStatusCancelled TicketStatus = "CANCELLED"
	TicketStatusExpired   TicketStatus = "EXPIRED"
)

type Ticket struct {
	ID                 string       `json:"id"`
	EventDayID         string       `json:"event_day_id"`
	TierID             string       `json:"tier_id"`
	Email              string       `json:"email"`
	UserID             *string      `json:"user_id,omitempty"`
	Quantity           int          `json:"quantity"`
	UnitPrice          int          `json:"unit_price"`
	TotalAmount        int          `json:"total_amount"`
	Status             TicketStatus `json:"status"`
	PaystackReference  *string      `json:"paystack_reference,omitempty"`
	PaystackAccessCode *string      `json:"paystack_access_code,omitempty"`
	TicketCode         string       `json:"ticket_code"`
	TeamID             *string      `json:"team_id,omitempty"`
	CheckedInAt        *time.Time   `json:"checked_in_at,omitempty"`
	CheckedInBy        *string      `json:"checked_in_by,omitempty"`
	CreatedAt          time.Time    `json:"created_at"`
	UpdatedAt          time.Time    `json:"updated_at"`

	// Relations
	EventDay *EventDay   `json:"event_day,omitempty"`
	Tier     *TicketTier `json:"tier,omitempty"`
	Team     *Team       `json:"team,omitempty"`
}
