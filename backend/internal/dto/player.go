package dto

// --- Players ---
type CreatePlayerRequest struct {
	Name           string `json:"name" binding:"required"`
	JerseyNumber   int    `json:"jersey_number"`
	Position       string `json:"position"`
	TeamID         string `json:"team_id" binding:"required"`
	Bio            string `json:"bio"`
	Image          string `json:"image"`
	Email          string `json:"email"`
	ContractLength *int   `json:"contract_length"`
}

type UpdatePlayerRequest struct {
	Name         string `json:"name"`
	JerseyNumber *int   `json:"jersey_number"`
	Position     string `json:"position"`
	TeamID       string `json:"team_id"`
	Bio          string `json:"bio"`
	Image        string `json:"image"`
	Email        string `json:"email"`
}

type PlayerResponse struct {
	ID           string        `json:"id"`
	Name         string        `json:"name"`
	JerseyNumber int           `json:"jersey_number"`
	Position     string        `json:"position"`
	Team         *TeamResponse `json:"team,omitempty"`
	Bio          string        `json:"bio"`
	Image        string        `json:"image"`
	Email        string        `json:"email,omitempty"`
}
