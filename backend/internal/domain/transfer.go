package domain

import "time"

type Transfer struct {
	ID               string     `json:"id"`
	Type             string     `json:"type"`   // REQUEST | LISTING | DIRECT_SALE
	Status           string     `json:"status"` // PENDING | REVIEW | ACCEPTED | REJECTED | CANCELLED | COMPLETED
	PlayerID         string     `json:"player_id"`
	FromTeamID       string     `json:"from_team_id"`
	ToTeamID         *string    `json:"to_team_id,omitempty"`
	InitiatedBy      string     `json:"initiated_by"`
	AskingPrice      *int64     `json:"asking_price,omitempty"`
	Notes            string     `json:"notes,omitempty"`
	ReviewNotes      string     `json:"review_notes,omitempty"`
	CompletedAt      *time.Time `json:"completed_at,omitempty"`
	FromTeamApproved bool       `json:"from_team_approved"`
	ToTeamApproved   bool       `json:"to_team_approved"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`

	// Relations
	Player   *Player       `json:"player,omitempty"`
	FromTeam *Team         `json:"from_team,omitempty"`
	ToTeam   *Team         `json:"to_team,omitempty"`
	Bids     []TransferBid `json:"bids,omitempty"`
}

type TransferBid struct {
	ID           string    `json:"id"`
	TransferID   string    `json:"transfer_id"`
	BidderTeamID string    `json:"bidder_team_id"`
	BidValue     int64     `json:"bid_value"`
	Status       string    `json:"status"` // PENDING | ACCEPTED | REJECTED
	BidderID     string    `json:"bidder_id"`
	CreatedAt    time.Time `json:"created_at"`

	// Relations
	BidderTeam *Team `json:"bidder_team,omitempty"`
}

type TeamBudget struct {
	ID          string    `json:"id"`
	TeamID      string    `json:"team_id"`
	TotalBudget int64     `json:"total_budget"`
	Spent       int64     `json:"spent"`
	Remaining   int64     `json:"remaining"` // TotalBudget - Spent
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	// Relations
	Team *Team `json:"team,omitempty"`
}

type TransferWindow struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	OpensAt   time.Time `json:"opens_at"`
	ClosesAt  time.Time `json:"closes_at"`
	IsActive  bool      `json:"is_active"`
	IsOpen    bool      `json:"is_open"` // Computed: IsActive && NOW between OpensAt and ClosesAt
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Notification struct {
	ID            string    `json:"id"`
	UserID        string    `json:"user_id"`
	Type          string    `json:"type"`
	Title         string    `json:"title"`
	Message       string    `json:"message"`
	ReferenceType string    `json:"reference_type,omitempty"`
	ReferenceID   *string   `json:"reference_id,omitempty"`
	IsRead        bool      `json:"is_read"`
	CreatedAt     time.Time `json:"created_at"`
}
