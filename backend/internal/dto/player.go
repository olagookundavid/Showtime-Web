package dto

// --- Players ---
type CreatePlayerRequest struct {
	Name           string `json:"name" binding:"required"`
	JerseyNumber   int    `json:"jersey_number"`
	Position       string `json:"position"`
	Gender         string `json:"gender"`
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
	Gender       string `json:"gender"`
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
	Gender       string        `json:"gender,omitempty"`
	Team         *TeamResponse `json:"team,omitempty"`
	Bio          string        `json:"bio"`
	Image        string        `json:"image"`
	Email        string        `json:"email,omitempty"`
	// "active" or "inactive". Clients render an inactive player greyed out --
	// they are still searchable and still carry their history.
	Status    string `json:"status,omitempty"`
	IsReserve bool   `json:"is_reserve"`
}

type RosterSummaryResponse struct {
	MainCount       int  `json:"main_count"`
	ReserveCount    int  `json:"reserve_count"`
	MaxMainLimit    int  `json:"max_main_limit"`
	CanAddOrPromote bool `json:"can_add_or_promote"`
}
