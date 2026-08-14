package dto

type CreateTransferRequestDTO struct {
	PlayerID string `json:"player_id" binding:"required"`
	ToTeamID string `json:"to_team_id" binding:"required"`
	Notes    string `json:"notes"`
}

type CreatePlayerListingDTO struct {
	PlayerID    string `json:"player_id" binding:"required"`
	AskingPrice int64  `json:"asking_price" binding:"required"`
}

type CreateDirectSaleDTO struct {
	PlayerID string `json:"player_id" binding:"required"`
	ToTeamID string `json:"to_team_id" binding:"required"`
	Price    int64  `json:"price" binding:"required"`
}

type TransferActionDTO struct {
	Action string `json:"action" binding:"required"` // "accept" | "reject" | "review"
	Notes  string `json:"notes"`
}

type CreateBidDTO struct {
	BidValue int64 `json:"bid_value" binding:"required"`
}

type TransferWindowRequest struct {
	Name     string `json:"name" binding:"required"`
	OpensAt  string `json:"opens_at" binding:"required"`  // ISO string
	ClosesAt string `json:"closes_at" binding:"required"` // ISO string
	IsActive *bool  `json:"is_active"`
}

type TransferResponse struct {
	ID               string             `json:"id"`
	Type             string             `json:"type"`
	Status           string             `json:"status"`
	PlayerID         string             `json:"player_id"`
	FromTeamID       string             `json:"from_team_id"`
	ToTeamID         *string            `json:"to_team_id,omitempty"`
	InitiatedBy      string             `json:"initiated_by,omitempty"`
	AskingPrice      *int64             `json:"asking_price,omitempty"`
	Notes            string             `json:"notes,omitempty"`
	ReviewNotes      string             `json:"review_notes,omitempty"`
	CompletedAt      *string            `json:"completed_at,omitempty"`
	FromTeamApproved bool               `json:"from_team_approved"`
	ToTeamApproved   bool               `json:"to_team_approved"`
	CreatedAt        string             `json:"created_at"`
	UpdatedAt        string             `json:"updated_at"`
	Player           *PlayerResponse    `json:"player,omitempty"`
	FromTeam         *TeamResponse      `json:"from_team,omitempty"`
	ToTeam           *TeamResponse      `json:"to_team,omitempty"`
	Bids             []BidResponse      `json:"bids,omitempty"`
}

type BidResponse struct {
	ID           string        `json:"id"`
	TransferID   string        `json:"transfer_id"`
	BidderTeamID string        `json:"bidder_team_id"`
	BidValue     int64         `json:"bid_value"`
	Status       string        `json:"status"`
	BidderID     string        `json:"bidder_id,omitempty"`
	CreatedAt    string        `json:"created_at"`
	BidderTeam   *TeamResponse `json:"bidder_team,omitempty"`
}

type TeamBudgetResponse struct {
	ID          string        `json:"id"`
	TeamID      string        `json:"team_id"`
	TotalBudget int64         `json:"total_budget"`
	Spent       int64         `json:"spent"`
	Remaining   int64         `json:"remaining"`
	CreatedAt   string        `json:"created_at"`
	UpdatedAt   string        `json:"updated_at"`
	Team        *TeamResponse `json:"team,omitempty"`
}

type TransferWindowResponse struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	OpensAt   string `json:"opens_at"`
	ClosesAt  string `json:"closes_at"`
	IsActive  bool   `json:"is_active"`
	IsOpen    bool   `json:"is_open"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

type NotificationResponse struct {
	ID            string `json:"id"`
	UserID        string `json:"user_id"`
	Type          string `json:"type"`
	Title         string `json:"title"`
	Message       string `json:"message"`
	ReferenceType string `json:"reference_type,omitempty"`
	ReferenceID   string `json:"reference_id,omitempty"`
	IsRead        bool   `json:"is_read"`
	CreatedAt     string `json:"created_at"`
}
