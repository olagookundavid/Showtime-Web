package domain

import (
	"errors"
	"time"
)

// ErrPlayerOnReserveTeam is returned when a team sheet save includes a player
// who is on the team's reserve list; only main 25-man squad players may be
// added to a match team sheet.
var ErrPlayerOnReserveTeam = errors.New("player is on the reserve team; only main 25-man squad players can be added to the team sheet")

type CompetitionFormat string

const (
	CompetitionFormatPreseason CompetitionFormat = "PRESEASON"
	CompetitionFormatSeason    CompetitionFormat = "SEASON"
	CompetitionFormatPlayoffs CompetitionFormat = "PLAYOFFS"
	CompetitionFormatCup       CompetitionFormat = "CUP"
)

// ValidCompetitionFormats is the full set of formats a competition may carry.
// Preseason and Cup are plain match lists (no standings, no bracket) today;
// Cup is expected to grow bracket support later.
var ValidCompetitionFormats = []string{
	string(CompetitionFormatPreseason),
	string(CompetitionFormatSeason),
	string(CompetitionFormatPlayoffs),
	string(CompetitionFormatCup),
}

const (
	TieBreakerRulePCT_PD_PF_PA_NAME = "PCT_PD_PF_PA_NAME"     // Rule 1: Win % -> Point Diff -> Points For -> Points Against -> Name
	TieBreakerRuleH2H_PCT_PD_PF_PA_NAME = "H2H_PCT_PD_PF_PA_NAME" // Rule 2: Head-to-Head -> Win % -> Point Diff -> Points For -> Points Against -> Name
)

type Competition struct {
	ID                   string    `json:"id"`
	Name                 string    `json:"name"`
	Logo                 string    `json:"logo"`
	Status               string    `json:"status"`
	Format               string    `json:"format"` // PRESEASON | SEASON | PLAYOFFS | CUP
	SeasonID             *string   `json:"season_id,omitempty"`
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
	MVPPlayerID      *string `json:"mvp_player_id,omitempty"`
	HomeCoverage     int     `json:"home_coverage,omitempty"`
	AwayCoverage     int     `json:"away_coverage,omitempty"`

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
	ID           string `json:"id" db:"id"`
	MatchID      string `json:"match_id" db:"match_id"`
	TeamID       string `json:"team_id" db:"team_id"`
	PlayerID     string `json:"player_id" db:"player_id"`
	IsStarter    bool   `json:"is_starter" db:"is_starter"`
	StarterUnit  string `json:"starter_unit,omitempty" db:"starter_unit"`
	PositionSlot string `json:"position_slot,omitempty" db:"position_slot"`
	OrderIndex   int    `json:"order_index,omitempty" db:"order_index"`
}

// Enriched version returned to the public API
type TeamSheetPlayer struct {
	PlayerID     string `json:"player_id" db:"player_id"`
	Name         string `json:"name" db:"name"`
	JerseyNumber int    `json:"jersey_number" db:"jersey_number"`
	Position     string `json:"position" db:"position"`
	// SecondaryPosition carries the player's second role onto the team sheet so
	// stat entry can offer both roles' fields. Nil for most players.
	SecondaryPosition *string `json:"secondary_position,omitempty" db:"secondary_position"`
	Gender            string  `json:"gender,omitempty" db:"gender"`
	Image             string  `json:"image" db:"image"`
	// Rating is this player's per-match rating (Receiver/Defender/Rusher only).
	// nil when the position isn't rateable (QB or undetermined "-") or the player
	// has no qualifying activity (UNRATED); the client renders those cases itself.
	Rating       *float64 `json:"rating,omitempty"`
	RatingStatus string   `json:"rating_status,omitempty"`
	// Status is "active" or "inactive". A player deleted after this sheet was
	// named stays on it -- the appearance happened. Stat entry must still be
	// possible for them, so this only marks them visually.
	Status       string `json:"status,omitempty"`
	IsStarter    bool   `json:"is_starter"`
	StarterUnit  string `json:"starter_unit,omitempty"` // "OFFENSE" | "DEFENSE"
	PositionSlot string `json:"position_slot,omitempty"` // "QB_M", "QB_F", "C", "WR1", "WR2", "WR3", "WR4", "RUSH", "DEF1", ...
	OrderIndex   int    `json:"order_index,omitempty"`
}

type MatchTeamSheet struct {
	HomeTeam     []TeamSheetPlayer `json:"home_team"`
	AwayTeam     []TeamSheetPlayer `json:"away_team"`
	HomeCoverage int               `json:"home_coverage,omitempty"`
	AwayCoverage int               `json:"away_coverage,omitempty"`
}

type MatchDetail struct {
	Match     Match          `json:"match"`
	TeamSheet MatchTeamSheet `json:"team_sheet"`
}
