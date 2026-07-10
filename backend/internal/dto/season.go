package dto

// ── Team of the Season graphics ──────────────────────────────────────────────

type UpsertSeasonGraphicRequest struct {
	Category       string `json:"category" binding:"required,oneof=offense defense"`
	ImageURL       string `json:"image_url" binding:"required"`
	MobileImageURL string `json:"mobile_image_url"`
}

type SeasonGraphicResponse struct {
	ID             string `json:"id"`
	Category       string `json:"category"`
	ImageURL       string `json:"image_url"`
	MobileImageURL string `json:"mobile_image_url"`
}

// ── MVPs ─────────────────────────────────────────────────────────────────────

type CreateSeasonMVPRequest struct {
	PlayerID     string `json:"player_id" binding:"required"`
	Label        string `json:"label" binding:"required"`
	DisplayOrder *int   `json:"display_order"`
}

type UpdateSeasonMVPRequest struct {
	Label        *string `json:"label"`
	DisplayOrder *int    `json:"display_order"`
	IsActive     *bool   `json:"is_active"`
}

type SeasonMVPResponse struct {
	ID           string `json:"id"`
	PlayerID     string `json:"player_id"`
	Label        string `json:"label"`
	DisplayOrder int    `json:"display_order"`
	IsActive     bool   `json:"is_active"`
	// Hydrated player fields for the card
	PlayerName         string `json:"player_name"`
	PlayerImage        string `json:"player_image"`
	PlayerJerseyNumber int    `json:"player_jersey_number"`
	PlayerPosition     string `json:"player_position"`
	TeamName           string `json:"team_name"`
	TeamLogo           string `json:"team_logo"`
}
