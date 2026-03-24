package domain

import (
	"time"
)

type Competition struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Logo      string    `json:"logo"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Team struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	ShortName string    `json:"short_name"`
	Logo      string    `json:"logo"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type MatchStatus string

const (
	MatchStatusScheduled MatchStatus = "SCHEDULED"
	MatchStatusLive      MatchStatus = "LIVE"
	MatchStatusFinished  MatchStatus = "FINISHED"
	MatchStatusPostponed MatchStatus = "POSTPONED"
)

type Match struct {
	ID            string      `json:"id"`
	CompetitionID string      `json:"competition_id"`
	HomeTeamID    string      `json:"home_team_id"`
	AwayTeamID    string      `json:"away_team_id"`
	Date          time.Time   `json:"date"`       // Kept for querying by date
	StartTime     time.Time   `json:"start_time"` // Full timestamp
	Venue         string      `json:"venue"`
	Status        MatchStatus `json:"status"`
	HomeScore     *int        `json:"home_score"`
	AwayScore     *int        `json:"away_score"`
	HighlightsURL *string     `json:"highlights_url"`
	TicketURL     *string     `json:"ticket_url"`
	CreatedAt     time.Time   `json:"created_at"`
	UpdatedAt     time.Time   `json:"updated_at"`

	// Relations (Joined fields)
	Competition *Competition `json:"competition,omitempty"`
	HomeTeam    *Team        `json:"home_team,omitempty"`
	AwayTeam    *Team        `json:"away_team,omitempty"`
}

type Standing struct {
	ID            string    `json:"id"`
	CompetitionID string    `json:"competition_id"`
	TeamID        string    `json:"team_id"`
	Position      int       `json:"position"`
	Played        int       `json:"played"`
	Won           int       `json:"won"`
	Drawn         int       `json:"drawn"`
	Lost          int       `json:"lost"`
	GoalsFor      int       `json:"goals_for"`
	GoalsAgainst  int       `json:"goals_against"`
	GoalDiff      int       `json:"goal_diff"`
	PCT           float64   `json:"pct"`
	L5            string    `json:"l5"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`

	// Relations
	Team *Team `json:"team,omitempty"`
}
