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
	Name        string  `json:"name" binding:"required"`
	Description string  `json:"description"`
	BasePrice   int     `json:"base_price" binding:"min=0"`
	IsHidden    bool    `json:"is_hidden"`
	AccessCode  *string `json:"access_code,omitempty"`
	IsActive    *bool   `json:"is_active"`
	// Seats per match day. 0 is unlimited.
	Capacity  int `json:"capacity" binding:"min=0"`
	SortOrder int `json:"sort_order"`
	// The competitions this ticket is sold for. Every match day of each one is on
	// sale automatically.
	CompetitionIDs []string `json:"competition_ids"`
}

type UpdateTicketProductRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	BasePrice   *int    `json:"base_price" binding:"omitempty,min=0"`
	IsHidden    *bool   `json:"is_hidden"`
	AccessCode  *string `json:"access_code"`
	IsActive    *bool   `json:"is_active"`
	Capacity    *int    `json:"capacity" binding:"omitempty,min=0"`
	SortOrder   *int    `json:"sort_order"`
	// nil leaves the links alone; an empty list unlinks every competition.
	CompetitionIDs []string `json:"competition_ids"`
}

// TicketProductDayResponse is one match day a ticket is on sale for.
type TicketProductDayResponse struct {
	// ID is the seat-lock row; empty until the day has first been looked up for a
	// purchase. Use EventDayID as the key.
	ID              string `json:"id"`
	ProductID       string `json:"product_id"`
	EventDayID      string `json:"event_day_id"`
	EventTitle      string `json:"event_title"`
	EventDate       string `json:"event_date"`
	EventVenue      string `json:"event_venue"`
	CompetitionID   string `json:"competition_id"`
	CompetitionName string `json:"competition_name"`
	Price           int    `json:"price"`
	Capacity        int    `json:"capacity"`
	SoldCount       int    `json:"sold_count"`
	HeldCount       int    `json:"held_count"`
	// Available is seats left; -1 means unlimited.
	Available int `json:"available"`
}

type TicketCompetitionResponse struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type TicketProductResponse struct {
	ID           string                      `json:"id"`
	Name         string                      `json:"name"`
	Slug         string                      `json:"slug"`
	Description  string                      `json:"description"`
	BasePrice    int                         `json:"base_price"`
	IsHidden     bool                        `json:"is_hidden"`
	AccessCode   *string                     `json:"access_code,omitempty"`
	IsActive     bool                        `json:"is_active"`
	Capacity     int                         `json:"capacity"`
	SortOrder    int                         `json:"sort_order"`
	Competitions []TicketCompetitionResponse `json:"competitions"`
	Days         []TicketProductDayResponse  `json:"days"`
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
	ProductID   string   `json:"product_id" binding:"required"`
	EventDayIDs []string `json:"event_day_ids" binding:"required,min=1,max=30"`
	Quantity    int      `json:"quantity" binding:"required,min=1,max=10"`
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
	// One or more match days; every purchase is a Game Pass.
	EventDayIDs  []string `json:"event_day_ids" binding:"required,min=1,max=30"`
	Email        string   `json:"email" binding:"required,email"`
	Name         string   `json:"name" binding:"required"`
	Phone        string   `json:"phone" binding:"required"`
	Quantity     int      `json:"quantity" binding:"required,min=1,max=10"`
	ReferralCode *string  `json:"referral_code,omitempty"`
	// Unlocks a hidden product. Required when the product is hidden.
	AccessCode string `json:"access_code"`
	// Discount codes are not accepted on tickets for now; a Game Pass has its own
	// percentage off. A code sent is refused rather than quietly ignored.
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
	SeasonPassID            string  `json:"season_pass_id,omitempty"`
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

// ─── Season Pass DTOs ─────────────────────────────────────────────────────────

type CreateSeasonPassRequest struct {
	// The ticket the pass is made from. Its linked competitions decide which match
	// days the pass covers, and its price per day is what the discount comes off.
	ProductID string `json:"product_id" binding:"required"`
	// Left out, it is "<ticket name> Season Pass".
	Name        string `json:"name"`
	Description string `json:"description"`
	// Percent off the ticket's price per day, 0 to 100.
	PercentOff float64 `json:"percent_off" binding:"min=0,max=100"`
	IsActive   *bool   `json:"is_active"`
}

type UpdateSeasonPassRequest struct {
	Name        *string  `json:"name"`
	Description *string  `json:"description"`
	PercentOff  *float64 `json:"percent_off" binding:"omitempty,min=0,max=100"`
	IsActive    *bool    `json:"is_active"`
}

// SeasonPassDayResponse is one match day a season pass covers.
type SeasonPassDayResponse struct {
	EventDayID      string `json:"event_day_id"`
	EventTitle      string `json:"event_title"`
	EventDate       string `json:"event_date"`
	EventVenue      string `json:"event_venue"`
	CompetitionID   string `json:"competition_id"`
	CompetitionName string `json:"competition_name"`
	// Price is the ticket's full price for this day, before the season discount.
	Price int `json:"price"`
	// Available is seats left; -1 means unlimited.
	Available int `json:"available"`
}

// SeasonPassResponse is a season pass with what it costs right now.
type SeasonPassResponse struct {
	ID          string  `json:"id"`
	ProductID   string  `json:"product_id"`
	ProductName string  `json:"product_name"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	PercentOff  float64 `json:"percent_off"`
	IsActive    bool    `json:"is_active"`
	// The ticket's own perks (its description), for showing alongside the pass.
	ProductDescription string                      `json:"product_description"`
	PricePerDay        int                         `json:"price_per_day"`
	Competitions       []TicketCompetitionResponse `json:"competitions"`

	// What the pass would cost for Quantity passes, today.
	Quantity int `json:"quantity"`
	// MatchDays are the days still to be played that the pass covers, earliest
	// first, and DaysRemaining is how many there are.
	MatchDays     []SeasonPassDayResponse `json:"match_days"`
	DaysRemaining int                     `json:"days_remaining"`
	// SkippedDays are remaining days left out because they have fewer seats than
	// Quantity. They are not charged for.
	SkippedDays []SeasonPassDayResponse `json:"skipped_days"`
	// FullPrice is every covered day at the ticket's price, times Quantity.
	FullPrice      int `json:"full_price"`
	DiscountAmount int `json:"discount_amount"`
	// Price is what Quantity passes cost: FullPrice less DiscountAmount.
	Price int `json:"price"`
	// Available is false when there is nothing left to buy (no match days remain).
	Available bool `json:"available"`
}

// PurchaseSeasonPassRequest buys a season pass. There is no list of match days:
// the server covers every remaining day, so what is charged cannot be argued with.
type PurchaseSeasonPassRequest struct {
	SeasonPassID string  `json:"season_pass_id" binding:"required"`
	Email        string  `json:"email" binding:"required,email"`
	Name         string  `json:"name" binding:"required"`
	Phone        string  `json:"phone" binding:"required"`
	Quantity     int     `json:"quantity" binding:"required,min=1,max=10"`
	ReferralCode *string `json:"referral_code,omitempty"`
	// Unlocks a pass made from a hidden ticket.
	AccessCode string `json:"access_code"`
}
