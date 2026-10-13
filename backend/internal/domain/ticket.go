package domain

import "time"

// ─── Event Day (match day) ────────────────────────────────────────────────────
//
// A match day is the date matches, fantasy gameweeks and team of the week hang
// off. Tickets no longer belong to it; products are sold on it (see
// TicketProductDay).

type EventDay struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Date      time.Time `json:"date"`
	Venue     string    `json:"venue"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// Relations
	Matches []Match `json:"matches,omitempty"`
}

// ─── Ticket Product ───────────────────────────────────────────────────────────

// TicketProduct is something that can be bought a ticket for: 5K, VIP, VVIP.
// Its price and capacity are set per match day through TicketProductDay.
type TicketProduct struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	Slug          string    `json:"slug"`
	Description   string    `json:"description"`
	BasePrice     int       `json:"base_price"`
	IsHidden      bool      `json:"is_hidden"`
	AccessCode    *string   `json:"access_code,omitempty"`
	IsActive      bool      `json:"is_active"`
	AllowGamePass bool      `json:"allow_game_pass"`
	SortOrder     int       `json:"sort_order"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`

	// Relations
	Days []TicketProductDay `json:"days,omitempty"`
}

// TicketProductDay is a product on sale for one match day. It is the row locked
// to keep a day from overselling.
type TicketProductDay struct {
	ID            string `json:"id"`
	ProductID     string `json:"product_id"`
	EventDayID    string `json:"event_day_id"`
	PriceOverride *int   `json:"price_override,omitempty"`
	// Price is the effective price: the override when set, else the product's
	// base price. Filled in on read.
	Price    int  `json:"price"`
	Capacity int  `json:"capacity"`
	IsActive bool `json:"is_active"`
	// SoldCount counts paid seats; HeldCount counts unpaid ones still inside the
	// reservation window. Both are derived from tickets on read.
	SoldCount int `json:"sold_count"`
	HeldCount int `json:"held_count"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// Relations
	EventDay *EventDay `json:"event_day,omitempty"`
}

// Available is how many seats are left; -1 means unlimited.
func (d TicketProductDay) Available() int {
	if d.Capacity <= 0 {
		return -1
	}
	left := d.Capacity - d.SoldCount - d.HeldCount
	if left < 0 {
		return 0
	}
	return left
}

// GamePassRule is one rung of the Game Pass discount ladder.
type GamePassRule struct {
	ID         string  `json:"id"`
	MinDays    int     `json:"min_days"`
	PercentOff float64 `json:"percent_off"`
	IsActive   bool    `json:"is_active"`
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

// PurchaseType separates the two buying flows over the same products.
type PurchaseType string

const (
	PurchaseTypeSingle   PurchaseType = "SINGLE"
	PurchaseTypeGamePass PurchaseType = "GAME_PASS"
)

// Ticket is one purchase: one code, one payment, covering one or more match days.
type Ticket struct {
	ID           string       `json:"id"`
	ProductID    *string      `json:"product_id,omitempty"`
	ProductName  string       `json:"product_name"`
	PurchaseType PurchaseType `json:"purchase_type"`
	Email        string       `json:"email"`
	UserID       *string      `json:"user_id,omitempty"`
	Quantity     int          `json:"quantity"`
	// UnitPrice is what one person pays for every day on the ticket, before any
	// discount. Subtotal is UnitPrice x Quantity.
	UnitPrice          int          `json:"unit_price"`
	Subtotal           int          `json:"subtotal"`
	TotalAmount        int          `json:"total_amount"`
	Status             TicketStatus `json:"status"`
	PaystackReference  *string      `json:"paystack_reference,omitempty"`
	PaystackAccessCode *string      `json:"paystack_access_code,omitempty"`
	TicketCode         string       `json:"ticket_code"`
	Phone              string       `json:"phone"`
	Name               string       `json:"name"`
	// Snapshot of any discount code redeemed on this purchase.
	DiscountCode   *string `json:"discount_code,omitempty"`
	DiscountAmount int     `json:"discount_amount"`
	// DiscountCodeID is not a column. It carries the code to reserve into
	// Create, so the hold is taken in the same transaction that claims the seat.
	DiscountCodeID *string `json:"-"`
	// Game Pass percentage off, snapshotted so a later change to the ladder does
	// not rewrite what this buyer was charged.
	GamePassDiscountPercent float64   `json:"game_pass_discount_percent"`
	GamePassDiscountAmount  int       `json:"game_pass_discount_amount"`
	TeamID                  *string   `json:"team_id,omitempty"`
	ReferralCode            *string   `json:"referral_code,omitempty"`
	CreatedAt               time.Time `json:"created_at"`
	UpdatedAt               time.Time `json:"updated_at"`

	// Relations
	Days []TicketDay `json:"days,omitempty"`
	Team *Team       `json:"team,omitempty"`
}

// TicketDay is one match day a ticket covers, and whether it has been used.
type TicketDay struct {
	ID           string `json:"id"`
	TicketID     string `json:"ticket_id"`
	EventDayID   string `json:"event_day_id"`
	ProductDayID string `json:"product_day_id"`
	UnitPrice    int    `json:"unit_price"`
	// Snapshot of the match day at purchase time.
	Title       string     `json:"title"`
	Date        time.Time  `json:"date"`
	Venue       string     `json:"venue"`
	CheckedInAt *time.Time `json:"checked_in_at,omitempty"`
	CheckedInBy *string    `json:"checked_in_by,omitempty"`
}

// ─── Ticket Referral Code ──────────────────────────────────────────────────────

type TicketReferralCode struct {
	ID        string    `json:"id"`
	Code      string    `json:"code"`
	Name      string    `json:"name"`
	Email     *string   `json:"email,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type ReferralStats struct {
	ID           string    `json:"id"`
	Code         string    `json:"code"`
	Name         string    `json:"name"`
	Email        *string   `json:"email,omitempty"`
	TicketsSold  int       `json:"tickets_sold"`
	TotalRevenue int       `json:"total_revenue"`
	CreatedAt    time.Time `json:"created_at"`
}
