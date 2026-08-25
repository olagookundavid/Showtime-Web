package dto

// ─── Event Day DTOs ───────────────────────────────────────────────────────────

type CreateEventDayRequest struct {
	Title    string `json:"title" binding:"required"`
	Date     string `json:"date" binding:"required"` // YYYY-MM-DD
	Venue    string `json:"venue"`
	IsActive *bool  `json:"is_active"`
}

type UpdateEventDayRequest struct {
	Title    *string `json:"title"`
	Venue    *string `json:"venue"`
	IsActive *bool   `json:"is_active"`
}

type EventDayResponse struct {
	ID        string               `json:"id"`
	Title     string               `json:"title"`
	Date      string               `json:"date"`
	Venue     string               `json:"venue"`
	IsActive  bool                 `json:"is_active"`
	Tiers     []TicketTierResponse `json:"tiers,omitempty"`
	Matches   []EventDayMatch      `json:"matches,omitempty"`
	CreatedAt string               `json:"created_at"`
}

type EventDayMatch struct {
	ID        string `json:"id"`
	HomeTeam  string `json:"home_team"`
	AwayTeam  string `json:"away_team"`
	StartTime string `json:"start_time"`
	Status    string `json:"status"`
	Venue     string `json:"venue"`
}

// ─── Ticket Tier DTOs ─────────────────────────────────────────────────────────

type CreateTicketTierRequest struct {
	Name        string  `json:"name" binding:"required"`
	Price       int     `json:"price" binding:"min=0"`
	Capacity    int     `json:"capacity"`
	Description string  `json:"description"`
	IsHidden    bool    `json:"is_hidden"`
	AccessCode  *string `json:"access_code,omitempty"`
}

type TicketTierResponse struct {
	ID          string  `json:"id"`
	EventDayID  string  `json:"event_day_id"`
	Name        string  `json:"name"`
	Price       int     `json:"price"`
	Capacity    int     `json:"capacity"`
	SoldCount   int     `json:"sold_count"`
	Available   int     `json:"available"` // computed: capacity - sold_count (0 if unlimited)
	Description string  `json:"description"`
	IsHidden    bool    `json:"is_hidden"`
	AccessCode  *string `json:"access_code,omitempty"`
}

// ─── Ticket DTOs ──────────────────────────────────────────────────────────────

type PurchaseTicketRequest struct {
	EventDayID   string  `json:"event_day_id" binding:"required"`
	TierID       string  `json:"tier_id" binding:"required"`
	Email        string  `json:"email" binding:"required,email"`
	Name         string  `json:"name" binding:"required"`
	Phone        string  `json:"phone" binding:"required"`
	Quantity     int     `json:"quantity" binding:"required,min=1,max=10"`
	ReferralCode *string `json:"referral_code,omitempty"`
	// Optional discount code. Distinct from ReferralCode (attribution only) and
	// from a tier's access_code (unlocks a hidden tier) — this one changes price.
	DiscountCode string `json:"discount_code"`
}

// GiftTicketRequest is used by an App Admin to issue a complimentary ticket
// (no payment) that still triggers the full confirmation email.
type GiftTicketRequest struct {
	EventDayID string `json:"event_day_id" binding:"required"`
	TierID     string `json:"tier_id" binding:"required"`
	Email      string `json:"email" binding:"required,email"`
	Name       string `json:"name" binding:"required"`
	Phone      string `json:"phone"`
	Quantity   int    `json:"quantity" binding:"required,min=1,max=10"`
}

type TicketResponse struct {
	ID                string  `json:"id"`
	EventDayID        string  `json:"event_day_id"`
	TierID            string  `json:"tier_id"`
	Email             string  `json:"email"`
	Name              string  `json:"name,omitempty"`
	Phone             string  `json:"phone,omitempty"`
	Quantity          int     `json:"quantity"`
	UnitPrice         int     `json:"unit_price"`
	TotalAmount       int     `json:"total_amount"`
	Status            string  `json:"status"`
	PaystackReference string  `json:"paystack_reference,omitempty"`
	TicketCode        string  `json:"ticket_code,omitempty"`
	CheckedInAt       *string `json:"checked_in_at,omitempty"`
	CheckedInBy       *string `json:"checked_in_by,omitempty"`
	AuthorizationURL  string  `json:"authorization_url,omitempty"`
	ReferralCode      string  `json:"referral_code,omitempty"`
	// Joined fields
	TierName   string `json:"tier_name,omitempty"`
	EventTitle string `json:"event_title,omitempty"`
	EventDate  string `json:"event_date,omitempty"`
	EventVenue string `json:"event_venue,omitempty"`
	CreatedAt  string `json:"created_at"`
}

type CheckinRequest struct {
	CheckedInBy string `json:"checked_in_by" binding:"required"`
}

// ─── Ticket Referral Code DTOs ──────────────────────────────────────────────────

type CreateReferralRequest struct {
	Name  string  `json:"name" binding:"required"`
	Email *string `json:"email,omitempty"`
}

type ReferralResponse struct {
	ID        string  `json:"id"`
	Code      string  `json:"code"`
	Name      string  `json:"name"`
	Email     *string `json:"email,omitempty"`
	CreatedAt string  `json:"created_at"`
}

type ReferralStatsResponse struct {
	ID           string  `json:"id"`
	Code         string  `json:"code"`
	Name         string  `json:"name"`
	Email        *string `json:"email,omitempty"`
	TicketsSold  int     `json:"tickets_sold"`
	TotalRevenue int     `json:"total_revenue"`
	CreatedAt    string  `json:"created_at"`
}

