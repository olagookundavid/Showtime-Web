package dto

// --- Players ---
type CreatePlayerRequest struct {
	Name          string `json:"name" binding:"required"`
	JerseyNumber  int    `json:"jersey_number"`
	Position      string `json:"position"`
	TeamID        string `json:"team_id" binding:"required"`
	Bio           string `json:"bio"`
	Image         string `json:"image"`
	Touchdowns    int    `json:"touchdowns"`
	Yards         int    `json:"yards"`
	Interceptions int    `json:"interceptions"`
	Tackles       int    `json:"tackles"`
}

type UpdatePlayerRequest struct {
	Name          string `json:"name"`
	JerseyNumber  *int   `json:"jersey_number"`
	Position      string `json:"position"`
	TeamID        string `json:"team_id"`
	Bio           string `json:"bio"`
	Image         string `json:"image"`
	Touchdowns    *int   `json:"touchdowns"`
	Yards         *int   `json:"yards"`
	Interceptions *int   `json:"interceptions"`
	Tackles       *int   `json:"tackles"`
}

type PlayerResponse struct {
	ID            string        `json:"id"`
	Name          string        `json:"name"`
	JerseyNumber  int           `json:"jersey_number"`
	Position      string        `json:"position"`
	Team          *TeamResponse `json:"team,omitempty"`
	Bio           string        `json:"bio"`
	Image         string        `json:"image"`
	Touchdowns    int           `json:"touchdowns"`
	Yards         int           `json:"yards"`
	Interceptions int           `json:"interceptions"`
	Tackles       int           `json:"tackles"`
}
