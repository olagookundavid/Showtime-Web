package dto

// FantasyTeamLineupDetailResponse is returned when inspecting a manager's team for a gameweek.
type FantasyTeamLineupDetailResponse struct {
	TeamID         string                      `json:"team_id"`
	TeamName       string                      `json:"team_name"`
	ManagerName    string                      `json:"manager_name"`
	SeasonID       string                      `json:"season_id"`
	GameweekID     string                      `json:"gameweek_id"`
	GameweekNumber int                         `json:"gameweek_number"`
	GameweekStatus string                      `json:"gameweek_status"`
	DeadlinePassed bool                        `json:"deadline_passed"`
	IsPrivate      bool                        `json:"is_private"`
	PrivateReason  string                      `json:"private_reason,omitempty"`
	Points         float64                     `json:"points"`
	TotalSpent     float64                     `json:"total_spent"`
	IsRollover     bool                        `json:"is_rollover"`
	Picks          []FantasyLineupPickResponse `json:"picks"`
}

// GameweekSummaryStats contains high-level benchmark KPIs for a gameweek.
type GameweekSummaryStats struct {
	AveragePoints      float64 `json:"average_points"`
	HighestPoints      float64 `json:"highest_points"`
	HighestScoringTeam string  `json:"highest_scoring_team"`
	LowestPoints       float64 `json:"lowest_points"`
	TotalManagers      int     `json:"total_managers"`
}

// MostOwnedPlayerItem represents a player ranked by squad selection frequency.
type MostOwnedPlayerItem struct {
	PlayerID            string  `json:"player_id"`
	PlayerName          string  `json:"player_name"`
	PlayerImage         string  `json:"player_image"`
	Position            string  `json:"position"`
	Gender              string  `json:"gender"`
	TeamID              string  `json:"team_id"`
	TeamName            string  `json:"team_name"`
	TeamShortName       string  `json:"team_short_name"`
	TeamLogo            string  `json:"team_logo"`
	CurrentPrice        float64 `json:"current_price"`
	OwnershipCount      int     `json:"ownership_count"`
	OwnershipPercentage float64 `json:"ownership_percentage"`
	Points              float64 `json:"points"`
}

// TopScoringPlayerItem represents an individual player's performance in a gameweek.
type TopScoringPlayerItem struct {
	PlayerID            string  `json:"player_id"`
	PlayerName          string  `json:"player_name"`
	PlayerImage         string  `json:"player_image"`
	Position            string  `json:"position"`
	Gender              string  `json:"gender"`
	TeamID              string  `json:"team_id"`
	TeamName            string  `json:"team_name"`
	TeamShortName       string  `json:"team_short_name"`
	TeamLogo            string  `json:"team_logo"`
	Price               float64 `json:"price"`
	Points              float64 `json:"points"`
	OwnershipPercentage float64 `json:"ownership_percentage"`
}

// ClubPointsItem aggregates fantasy points scored by all players from an actual SFFL club.
type ClubPointsItem struct {
	ClubID                 string  `json:"club_id"`
	ClubName               string  `json:"club_name"`
	ClubShortName          string  `json:"club_short_name"`
	ClubLogo               string  `json:"club_logo"`
	TotalPoints            float64 `json:"total_points"`
	ActivePlayerCount      int     `json:"active_player_count"`
	AveragePointsPerPlayer float64 `json:"average_points_per_player"`
	TopScorerName          string  `json:"top_scorer_name"`
	TopScorerPoints        float64 `json:"top_scorer_points"`
}

// GameweekReportResponse contains the full week-by-week analytical report for a gameweek.
type GameweekReportResponse struct {
	SeasonID             string                      `json:"season_id"`
	GameweekID           string                      `json:"gameweek_id"`
	GameweekNumber       int                         `json:"gameweek_number"`
	GameweekStatus       string                      `json:"gameweek_status"`
	Summary              GameweekSummaryStats        `json:"summary"`
	MostOwned            []MostOwnedPlayerItem       `json:"most_owned"`
	TopScorers           []TopScoringPlayerItem      `json:"top_scorers"`
	ClubPoints           []ClubPointsItem            `json:"club_points"`
	DreamTeam            []FantasyLineupPickResponse `json:"dream_team"`
	DreamTeamTotalPoints float64                     `json:"dream_team_total_points"`
	Differentials        []TopScoringPlayerItem      `json:"differentials"`
}
