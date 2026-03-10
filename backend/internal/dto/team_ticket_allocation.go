package dto

type CreateOrUpdateAllocationRequest struct {
	EventDayID     string `json:"event_day_id" binding:"required"`
	TeamID         string `json:"team_id" binding:"required"`
	AllocatedCount int    `json:"allocated_count" binding:"required,min=0"`
}

type TeamTicketAllocationResponse struct {
	ID             string `json:"id"`
	EventDayID     string `json:"event_day_id"`
	TeamID         string `json:"team_id"`
	AllocatedCount int    `json:"allocated_count"`
	IssuedCount    int    `json:"issued_count"`
	TeamName       string `json:"team_name,omitempty"`
	EventTitle     string `json:"event_title,omitempty"`
}

type IssueTeamTicketRequest struct {
	EventDayID string `json:"event_day_id" binding:"required"`
	Name       string `json:"name" binding:"required"`
	Email      string `json:"email" binding:"required,email"`
}
