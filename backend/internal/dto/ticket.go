package dto

// ─── Match Day (event day) DTOs ───────────────────────────────────────────────

type CreateEventDayRequest struct {
	Title    string `json:"title" binding:"required"`
	Date     string `json:"date" binding:"required"` // YYYY-MM-DD
	Venue    string `json:"venue"`
	IsActive *bool  `json:"is_active"`
}

type UpdateEventDayRequest struct {
	Title    *string `json:"title"`
	Date     *string `json:"date"` // YYYY-MM-DD
	Venue    *string `json:"venue"`
	IsActive *bool   `json:"is_active"`
}

type EventDayResponse struct {
	ID        string          `json:"id"`
	Title     string          `json:"title"`
	Date      string          `json:"date"`
	Venue     string          `json:"venue"`
	IsActive  bool            `json:"is_active"`
	Matches   []EventDayMatch `json:"matches,omitempty"`
	CreatedAt string          `json:"created_at"`
}

type EventDayMatch struct {
	ID        string `json:"id"`
	HomeTeam  string `json:"home_team"`
	AwayTeam  string `json:"away_team"`
	StartTime string `json:"start_time"`
	Status    string `json:"status"`
	Venue     string `json:"venue"`
}

// ─── Ticket Product DTOs ──────────────────────────────────────────────────────

type CreateTicketProductRequest struct {
	Name          string  `json:"name" binding:"required"`
	Description   string  `json:"description"`
	BasePrice     int     `json:"base_price" binding:"min=0"`
	IsHidden      bool    `json:"is_hidden"`
	AccessCode    *string `json:"access_code,omitempty"`
	IsActive      *bool   `json:"is_active"`
	AllowGamePass *bool   `json:"allow_game_pass"`
	SortOrder     int     `json:"sort_order"`
}

type UpdateTicketProductRequest struct {
	Name          *string `json:"name"`
	Description   *string `json:"description"`
	BasePrice     *int    `json:"base_price" binding:"omitempty,min=0"`
	IsHidden      *bool   `json:"is_hidden"`
	AccessCode    *string `json:"access_code"`
	IsActive      *bool   `json:"is_active"`
	AllowGamePass *bool   `json:"allow_game_pass"`
	SortOrder     *int    `json:"sort_order"`
}

// SaveProductDayRequest sets a product's price and capacity on one match day,
// creating the row if the product was not yet on sale that day.
type SaveProductDayRequest struct {
	EventDayID string `json:"event_day_id" binding:"required"`
	// nil clears the override, falling back to the product's base price.
	PriceOverride *int  `json:"price_override" binding:"omitempty,min=0"`
	Capacity      int   `json:"capacity" binding:"min=0"`
	IsActive      *bool `json:"is_active"`
}

type TicketProductDayResponse struct {
	ID            string `json:"id"`
	ProductID     string `json:"product_id"`
	EventDayID    string `json:"event_day_id"`
	EventTitle    string `json:"event_title"`
	EventDate     string `json:"event_date"`
	EventVenue    string `json:"event_venue"`
	Price         int    `json:"price"`
	PriceOverride *int   `json:"price_override,omitempty"`
	Capacity      int    `json:"capacity"`
	SoldCount     int    `json:"sold_count"`
	HeldCount     int    `json:"held_count"`
	// Available is seats left; -1 means unlimited.
	Available int  `json:"available"`
	IsActive  bool `json:"is_active"`
}

type TicketProductResponse struct {
	ID            string                     `json:"id"`
	Name          string                     `json:"name"`
	Slug          string                     `json:"slug"`
	Description   string                     `json:"description"`
	BasePrice     int                        `json:"base_price"`
	IsHidden      bool                       `json:"is_hidden"`
	AccessCode    *string                    `json:"access_code,omitempty"`
	IsActive      bool                       `json:"is_active"`
	AllowGamePass bool                       `json:"allow_game_pass"`
	SortOrder     int                        `json:"sort_order"`
	Days          []TicketProductDayResponse `json:"days"`
}

// ─── Game Pass DTOs ───────────────────────────────────────────────────────────

type GamePassRuleDTO struct {
	MinDays    int     `json:"min_days" binding:"required,min=2"`
	PercentOff float64 `json:"percent_off" binding:"min=0,max=100"`
	IsActive   *bool   `json:"is_active"`
}

type SaveGamePassRulesRequest struct {
	Rules []GamePassRuleDTO `json:"rules" binding:"required,max=50,dive"`
}

type GamePassRuleResponse struct {
	MinDays    int     `json:"min_days"`
	PercentOff float64 `json:"percent_off"`
	IsActive   bool    `json:"is_active"`
}

// PriceQuoteRequest asks what a selection would cost, using the same pricing code
// the real purchase uses.
type PriceQuoteRequest struct {
	ProductID    string   `json:"product_id" binding:"required"`
	EventDayIDs  []string `json:"event_day_ids" binding:"required,min=1,max=30"`
	PurchaseType string   `json:"purchase_type" binding:"required,oneof=SINGLE GAME_PASS"`
	Quantity     int      `json:"quantity" binding:"required,min=1,max=10"`
}

type PriceQuoteResponse struct {
	UnitPrice               int     `json:"unit_price"`
	Subtotal                int     `json:"subtotal"`
	GamePassDiscountPercent float64 `json:"game_pass_discount_percent"`
	GamePassDiscountAmount  int     `json:"game_pass_discount_amount"`
	Total                   int     `json:"total"`
	Days                    int     `json:"days"`
}

// ─── Ticket DTOs ──────────────────────────────────────────────────────────────

type PurchaseTicketRequest struct {
	ProductID string `json:"product_id" binding:"required"`
	// SINGLE takes exactly one day; GAME_PASS takes two or more.
	PurchaseType string   `json:"purchase_type" binding:"required,oneof=SINGLE GAME_PASS"`
	EventDayIDs  []string `json:"event_day_ids" binding:"required,min=1,max=30"`
	Email        string   `json:"email" binding:"required,email"`
	Name         string   `json:"name" binding:"required"`
	Phone        string   `json:"phone" binding:"required"`
	Quantity     int      `json:"quantity" binding:"required,min=1,max=10"`
	ReferralCode *string  `json:"referral_code,omitempty"`
	// Unlocks a hidden product. Required when the product is hidden.
	AccessCode string `json:"access_code"`
	// Optional discount code. Distinct from ReferralCode (attribution only) and
	// from a product's access_code (unlocks a hidden product) — this one changes
	// price. Single tickets only.
	DiscountCode string `json:"discount_code"`
}

// GiftTicketRequest is used by an App Admin to issue a complimentary ticket
// (no payment) that still triggers the full confirmation email.
type GiftTicketRequest struct {
	ProductID   string   `json:"product_id" binding:"required"`
	EventDayIDs []string `json:"event_day_ids" binding:"required,min=1,max=30"`
	Email       string   `json:"email" binding:"required,email"`
	Name        string   `json:"name" binding:"required"`
	Phone       string   `json:"phone"`
	Quantity    int      `json:"quantity" binding:"required,min=1,max=10"`
}

type TicketDayResponse struct {
	ID          string  `json:"id"`
	EventDayID  string  `json:"event_day_id"`
	Title       string  `json:"title"`
	Date        string  `json:"date"`
	Venue       string  `json:"venue"`
	UnitPrice   int     `json:"unit_price"`
	CheckedInAt *string `json:"checked_in_at,omitempty"`
	CheckedInBy *string `json:"checked_in_by,omitempty"`
}

type TicketResponse struct {
	ID                      string  `json:"id"`
	ProductID               string  `json:"product_id,omitempty"`
	ProductName             string  `json:"product_name,omitempty"`
	PurchaseType            string  `json:"purchase_type"`
	Email                   string  `json:"email"`
	Name                    string  `json:"name,omitempty"`
	Phone                   string  `json:"phone,omitempty"`
	Quantity                int     `json:"quantity"`
	UnitPrice               int     `json:"unit_price"`
	Subtotal                int     `json:"subtotal"`
	GamePassDiscountPercent float64 `json:"game_pass_discount_percent"`
	GamePassDiscountAmount  int     `json:"game_pass_discount_amount"`
	DiscountCode            string  `json:"discount_code,omitempty"`
	DiscountAmount          int     `json:"discount_amount"`
	TotalAmount             int     `json:"total_amount"`
	Status                  string  `json:"status"`
	PaystackReference       string  `json:"paystack_reference,omitempty"`
	TicketCode              string  `json:"ticket_code,omitempty"`
	AuthorizationURL        string  `json:"authorization_url,omitempty"`
	ReferralCode            string  `json:"referral_code,omitempty"`
	// One entry per match day the ticket covers, each with its own check-in.
	Days      []TicketDayResponse `json:"days"`
	CreatedAt string              `json:"created_at"`
}

// CheckinRequest checks a ticket in for one match day. EventDayID is optional:
// left out, the scanner's day is today's.
type CheckinRequest struct {
	CheckedInBy string `json:"checked_in_by" binding:"required"`
	EventDayID  string `json:"event_day_id"`
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
