package dto

// --- Competitions ---
type CreateCompetitionRequest struct {
	Name   string `json:"name" binding:"required"`
	Logo   string `json:"logo"`
	Status string `json:"status"` // e.g. active, inactive, archived
	Format string `json:"format"` // LEAGUE | KNOCKOUT
}

type UpdateCompetitionRequest struct {
	Name   *string `json:"name"`
	Logo   *string `json:"logo"`
	Status *string `json:"status"`
	Format *string `json:"format"`
}

type CompetitionResponse struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Logo   string `json:"logo"`
	Status string `json:"status"`
	Format string `json:"format"`
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
	HomeTeamID    string `json:"home_team_id"` // optional: empty = TBD slot (knockout only)
	AwayTeamID    string `json:"away_team_id"` // optional: empty = TBD slot (knockout only)
	Date          string `json:"date" binding:"required"`       // YYYY-MM-DD
	StartTime     string `json:"start_time"`                    // RFC3339 or HH:MM, optional
	Venue         string `json:"venue"`
	Status        string `json:"status"`
	HomeScore     *int   `json:"home_score"`
	AwayScore     *int   `json:"away_score"`
	HighlightsURL *string `json:"highlights_url"`
	TicketURL     *string `json:"ticket_url"`
	Round         string  `json:"round"`          // bracket round label, knockout only
	BracketPos    *int    `json:"bracket_pos"`    // top-to-bottom order within a round
	FeedsMatchID  *string `json:"feeds_match_id"` // winner advances into this match...
	FeedsSlot     string  `json:"feeds_slot"`     // ...as HOME or AWAY
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
	HighlightsURL *string `json:"highlights_url"`
	TicketURL     *string `json:"ticket_url"`
	Round         string  `json:"round"`
	BracketPos    *int    `json:"bracket_pos"`
	FeedsMatchID  *string `json:"feeds_match_id"`
	FeedsSlot     string  `json:"feeds_slot"`
}

type MatchResponse struct {
	ID            string               `json:"id"`
	Competition   *CompetitionResponse `json:"competition,omitempty"`
	HomeTeam      *TeamResponse        `json:"home_team,omitempty"`
	AwayTeam      *TeamResponse        `json:"away_team,omitempty"`
	Date          string               `json:"date"`
	StartTime     string               `json:"start_time"`
	Venue         string               `json:"venue"`
	Status        string               `json:"status"`
	HomeScore     *int                 `json:"home_score"`
	AwayScore     *int                 `json:"away_score"`
	HighlightsURL string               `json:"highlights_url"`
	TicketURL     string               `json:"ticket_url"`
	Round         string               `json:"round,omitempty"`
	BracketPos    *int                 `json:"bracket_pos,omitempty"`
	FeedsMatchID  *string              `json:"feeds_match_id,omitempty"`
	FeedsSlot     string               `json:"feeds_slot,omitempty"`
}

// --- Brackets ---
// One first-round slot of a knockout bracket: either a matchup of two teams
// or a bye (the team advances straight to the next round). Adjacent slots
// pair up — winners of slots 1 & 2 meet, 3 & 4 meet, and so on.
type BracketEntryRequest struct {
	Bye        bool   `json:"bye"`
	TeamID     string `json:"team_id"`      // bye entries
	HomeTeamID string `json:"home_team_id"` // matchup entries
	AwayTeamID string `json:"away_team_id"`
}

type GenerateBracketRequest struct {
	Entries []BracketEntryRequest `json:"entries" binding:"required"`
	Date    string                `json:"date" binding:"required"` // first-round date, YYYY-MM-DD
	Time    string                `json:"time"`                    // HH:MM, optional
	Venue   string                `json:"venue"`
}

// --- Team Sheets ---
type SaveTeamSheetRequest struct {
	TeamID    string   `json:"team_id" binding:"required"`
	PlayerIDs []string `json:"player_ids" binding:"required"`
}

// --- Standings ---
type CreateStandingRequest struct {
	CompetitionID string `json:"competition_id" binding:"required"`
	TeamID        string `json:"team_id" binding:"required"`
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
