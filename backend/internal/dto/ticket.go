package dto

type PurchaseTicketRequest struct {
	MatchID   string `json:"match_id" binding:"required"`
	Email     string `json:"email" binding:"required,email"`
	Quantity  int    `json:"quantity" binding:"required,min=1,max=10"`
	UnitPrice int    `json:"unit_price" binding:"required,min=1"`
}

type TicketResponse struct {
	ID                string  `json:"id"`
	MatchID           string  `json:"match_id"`
	Email             string  `json:"email"`
	Quantity          int     `json:"quantity"`
	UnitPrice         int     `json:"unit_price"`
	TotalAmount       int     `json:"total_amount"`
	Status            string  `json:"status"`
	PaystackReference string  `json:"paystack_reference,omitempty"`
	TicketCode        string  `json:"ticket_code,omitempty"`
	CheckedInAt       *string `json:"checked_in_at,omitempty"`
	CheckedInBy       *string `json:"checked_in_by,omitempty"`
	AuthorizationURL  string  `json:"authorization_url,omitempty"`
	MatchTitle        string  `json:"match_title,omitempty"`
	MatchDate         string  `json:"match_date,omitempty"`
	MatchVenue        string  `json:"match_venue,omitempty"`
	HomeTeam          string  `json:"home_team,omitempty"`
	AwayTeam          string  `json:"away_team,omitempty"`
	CreatedAt         string  `json:"created_at"`
}

type CheckinRequest struct {
	CheckedInBy string `json:"checked_in_by" binding:"required"`
}
