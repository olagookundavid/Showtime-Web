package domain

import (
	"time"
)

type CompetitionFormat string

const (
	CompetitionFormatLeague   CompetitionFormat = "LEAGUE"
	CompetitionFormatKnockout CompetitionFormat = "KNOCKOUT"
)

const (
	TieBreakerRulePCT_PD_PF_PA_NAME = "PCT_PD_PF_PA_NAME"     // Rule 1: Win % -> Point Diff -> Points For -> Points Against -> Name
	TieBreakerRuleH2H_PCT_PD_PF_PA_NAME = "H2H_PCT_PD_PF_PA_NAME" // Rule 2: Head-to-Head -> Win % -> Point Diff -> Points For -> Points Against -> Name
)

type Competition struct {
	ID                   string    `json:"id"`
	Name                 string    `json:"name"`
	Logo                 string    `json:"logo"`
	Status               string    `json:"status"`
	Format               string    `json:"format"` // LEAGUE | KNOCKOUT
	PlayoffCompetitionID *string   `json:"playoff_competition_id,omitempty"`
	TieBreakerRule       string    `json:"tie_breaker_rule"`
	TeamIDs              []string  `json:"team_ids,omitempty"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
}

type Team struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	ShortName string    `json:"short_name"`
	Logo      string    `json:"logo"`
	Status    string    `json:"status"` // active | inactive
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type CompetitionTeam struct {
	ID            string    `json:"id"`
	CompetitionID string    `json:"competition_id"`
	TeamID        string    `json:"team_id"`
	CreatedAt     time.Time `json:"created_at"`
	Team          *Team     `json:"team,omitempty"`
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
	PBPLocked     bool        `json:"pbp_locked"` // play-by-play editing locked until an admin unlocks
	CreatedAt     time.Time   `json:"created_at"`
	UpdatedAt     time.Time   `json:"updated_at"`

	// Bracket fields (knockout competitions only). The winner of this match
	// is written into FeedsMatchID's home/away slot when it finishes.
	Round            string  `json:"round,omitempty"`
	BracketPos       *int    `json:"bracket_pos,omitempty"`
	FeedsMatchID     *string `json:"feeds_match_id,omitempty"`
	FeedsSlot        string  `json:"feeds_slot,omitempty"` // HOME | AWAY
	SecondLegMatchID *string `json:"second_leg_match_id,omitempty"`

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

type MatchTeamSheetEntry struct {
	ID       string `json:"id" db:"id"`
	MatchID  string `json:"match_id" db:"match_id"`
	TeamID   string `json:"team_id" db:"team_id"`
	PlayerID string `json:"player_id" db:"player_id"`
}

// Enriched version returned to the public API
type TeamSheetPlayer struct {
	PlayerID     string `json:"player_id" db:"player_id"`
	Name         string `json:"name" db:"name"`
	JerseyNumber int    `json:"jersey_number" db:"jersey_number"`
	Position     string `json:"position" db:"position"`
	Gender       string `json:"gender,omitempty" db:"gender"`
	Image        string `json:"image" db:"image"`
	// Rating is this player's per-match rating (Receiver/Defender/Rusher only).
	// nil when the position isn't rateable (QB or undetermined "-") or the player
	// has no qualifying activity (UNRATED); the client renders those cases itself.
	Rating       *float64 `json:"rating,omitempty"`
	RatingStatus string   `json:"rating_status,omitempty"`
}

type MatchTeamSheet struct {
	HomeTeam []TeamSheetPlayer `json:"home_team"`
	AwayTeam []TeamSheetPlayer `json:"away_team"`
}

type MatchDetail struct {
	Match     Match          `json:"match"`
	TeamSheet MatchTeamSheet `json:"team_sheet"`
}
