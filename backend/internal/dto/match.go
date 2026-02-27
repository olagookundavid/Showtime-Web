package dto

import "time"

// --- Competitions ---
type CreateCompetitionRequest struct {
	Name string `json:"name" binding:"required"`
	Logo string `json:"logo"`
}

type CompetitionResponse struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Logo string `json:"logo"`
}

// --- Teams ---
type CreateTeamRequest struct {
	Name      string `json:"name" binding:"required"`
	ShortName string `json:"short_name"`
	Logo      string `json:"logo"`
}

type TeamResponse struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	ShortName string `json:"short_name"`
	Logo      string `json:"logo"`
}

// --- Matches ---
type CreateMatchRequest struct {
	CompetitionID string `json:"competition_id" binding:"required"`
	HomeTeamID    string `json:"home_team_id" binding:"required"`
	AwayTeamID    string `json:"away_team_id" binding:"required"`
	Date          string `json:"date" binding:"required"`       // YYYY-MM-DD
	StartTime     string `json:"start_time" binding:"required"` // RFC3339
	Venue         string `json:"venue"`
	Status        string `json:"status"`
	HomeScore     *int   `json:"home_score"`
	AwayScore     *int   `json:"away_score"`
	HighlightsURL string `json:"highlights_url"`
	TicketURL     string `json:"ticket_url"`
}

type UpdateMatchRequest struct {
	CompetitionID string `json:"competition_id"`
	HomeTeamID    string `json:"home_team_id"`
	AwayTeamID    string `json:"away_team_id"`
	Date          string `json:"date"`
	StartTime     string `json:"start_time"`
	Venue         string `json:"venue"`
	Status        string `json:"status"`
	HomeScore     *int   `json:"home_score"`
	AwayScore     *int   `json:"away_score"`
	HighlightsURL string `json:"highlights_url"`
	TicketURL     string `json:"ticket_url"`
}

type MatchResponse struct {
	ID            string               `json:"id"`
	Competition   *CompetitionResponse `json:"competition,omitempty"`
	HomeTeam      *TeamResponse        `json:"home_team,omitempty"`
	AwayTeam      *TeamResponse        `json:"away_team,omitempty"`
	Date          string               `json:"date"`
	StartTime     time.Time            `json:"start_time"`
	Venue         string               `json:"venue"`
	Status        string               `json:"status"`
	HomeScore     *int                 `json:"home_score"`
	AwayScore     *int                 `json:"away_score"`
	HighlightsURL string               `json:"highlights_url"`
	TicketURL     string               `json:"ticket_url"`
}

// --- Standings ---
type CreateStandingRequest struct {
	CompetitionID string `json:"competition_id" binding:"required"`
	TeamID        string `json:"team_id" binding:"required"`
	Position      int    `json:"position" binding:"required"`
	Won           int    `json:"won"`
	Drawn         int    `json:"drawn"`
	Lost          int    `json:"lost"`
	GoalsFor      int    `json:"goals_for"`
	GoalsAgainst  int    `json:"goals_against"`
	L5            string `json:"l5"`
}

type UpdateStandingRequest struct {
	CompetitionID string `json:"competition_id"`
	TeamID        string `json:"team_id"`
	Position      int    `json:"position"`
	Won           int    `json:"won"`
	Drawn         int    `json:"drawn"`
	Lost          int    `json:"lost"`
	GoalsFor      int    `json:"goals_for"`
	GoalsAgainst  int    `json:"goals_against"`
	L5            string `json:"l5"`
}

type StandingResponse struct {
	ID           string        `json:"id"`
	Team         *TeamResponse `json:"team"`
	Position     int           `json:"position"`
	Played       int           `json:"played"`
	Won          int           `json:"won"`
	Drawn        int           `json:"drawn"`
	Lost         int           `json:"lost"`
	GoalsFor     int           `json:"goals_for"`
	GoalsAgainst int           `json:"goals_against"`
	GoalDiff     int           `json:"goal_diff"`
	PCT          float64       `json:"pct"`
	L5           string        `json:"l5"`
}
