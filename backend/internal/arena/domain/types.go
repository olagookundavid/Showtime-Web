// Package domain holds Clubs Arena's models and its pure rules (standings,
// fixtures, team sheets, contracts, the playoff bracket). It imports nothing from
// the rest of Showtime so the whole product can be lifted out later.
package domain

import "time"

// Season statuses.
const (
	SeasonSetup     = "setup"
	SeasonActive    = "active"
	SeasonPlayoffs  = "playoffs"
	SeasonCompleted = "completed"
)

// Match stages and statuses.
const (
	StageLeague = "league"
	StageSemi   = "semi"
	StageFinal  = "final"

	MatchScheduled = "scheduled"
	MatchCompleted = "completed"
	MatchForfeit   = "forfeit"
	MatchPostponed = "postponed"
)

// Contract statuses.
const (
	ContractAwaitingRelease = "awaiting_release"
	ContractAwaitingPlayer  = "awaiting_player"
	ContractSigned          = "signed"
	ContractRejected        = "rejected"
	ContractReleaseDeclined = "release_declined"
	ContractWithdrawn       = "withdrawn"
)

// Squad roles.
const (
	RoleFirstTeam = "first_team"
	RoleRotation  = "rotation"
	RoleReserve   = "reserve"
)

// Team sheet statuses.
const (
	SheetDraft     = "draft"
	SheetSubmitted = "submitted"
)

// Positions a player can be registered at.
var Positions = []string{"GK", "CB", "LB", "RB", "LWB", "RWB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST"}

// Platforms players compete on.
var Platforms = []string{"PS", "XBOX", "PC"}

func contains(list []string, v string) bool {
	for _, s := range list {
		if s == v {
			return true
		}
	}
	return false
}

func ValidPosition(p string) bool { return contains(Positions, p) }
func ValidPlatform(p string) bool { return contains(Platforms, p) }
func ValidSquadRole(r string) bool {
	return r == RoleFirstTeam || r == RoleRotation || r == RoleReserve
}

type Season struct {
	ID                 string     `json:"id"`
	Number             int        `json:"number"`
	Name               string     `json:"name"`
	StartsOn           *string    `json:"starts_on"`
	EndsOn             *string    `json:"ends_on"`
	Status             string     `json:"status"`
	TransferWindowOpen bool       `json:"transfer_window_open"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
	Divisions          []Division `json:"divisions,omitempty"`
}

type Division struct {
	ID           string   `json:"id"`
	SeasonID     string   `json:"season_id"`
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	SortOrder    int      `json:"sort_order"`
	PlayoffSpots int      `json:"playoff_spots"`
	KickoffDay   int      `json:"kickoff_day"`
	KickoffSlots []string `json:"kickoff_slots"`
	ClubIDs      []string `json:"club_ids"`
	ClubCount    int      `json:"club_count"`
	// Locked is true once any of the division's matches has a result, which is
	// when clubs stop being movable.
	Locked bool `json:"locked"`
}

type Club struct {
	ID            string    `json:"id"`
	Slug          string    `json:"slug"`
	Name          string    `json:"name"`
	Short         string    `json:"short"`
	Color         string    `json:"color"`
	CrestURL      string    `json:"crest_url"`
	FoundedYear   *int      `json:"founded_year"`
	ManagerUserID *string   `json:"manager_user_id"`
	ManagerName   string    `json:"manager_name,omitempty"`
	ManagerEmail  string    `json:"manager_email,omitempty"`
	Status        string    `json:"status"`
	DivisionID    *string   `json:"division_id,omitempty"`
	DivisionName  string    `json:"division_name,omitempty"`
	SquadSize     int       `json:"squad_size"`
	HasPlayed     bool      `json:"has_played"`
	CreatedAt     time.Time `json:"created_at"`
}

type Player struct {
	ID              string    `json:"id"`
	UserID          *string   `json:"user_id"`
	Gamertag        string    `json:"gamertag"`
	EAID            string    `json:"ea_id"`
	Platform        string    `json:"platform"`
	PrimaryPosition string    `json:"primary_position"`
	AvatarURL       string    `json:"avatar_url"`
	ClubID          *string   `json:"club_id"`
	ClubSlug        string    `json:"club_slug,omitempty"`
	ClubName        string    `json:"club_name,omitempty"`
	ClubShort       string    `json:"club_short,omitempty"`
	ClubColor       string    `json:"club_color,omitempty"`
	ShirtNumber     *int      `json:"shirt_number"`
	SquadRole       string    `json:"squad_role,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
}

// Registration is a player's membership of a club.
type Registration struct {
	ID          string     `json:"id"`
	PlayerID    string     `json:"player_id"`
	ClubID      string     `json:"club_id"`
	SeasonID    string     `json:"season_id"`
	ShirtNumber int        `json:"shirt_number"`
	SquadRole   string     `json:"squad_role"`
	ContractID  *string    `json:"contract_id"`
	StartedAt   time.Time  `json:"started_at"`
	EndedAt     *time.Time `json:"ended_at"`
}

type Match struct {
	ID           string     `json:"id"`
	SeasonID     string     `json:"season_id"`
	DivisionID   string     `json:"division_id"`
	DivisionName string     `json:"division_name,omitempty"`
	Stage        string     `json:"stage"`
	Matchweek    int        `json:"matchweek"`
	HomeClubID   *string    `json:"home_club_id"`
	AwayClubID   *string    `json:"away_club_id"`
	Home         *ClubRef   `json:"home"`
	Away         *ClubRef   `json:"away"`
	KickoffAt    *time.Time `json:"kickoff_at"`
	Status       string     `json:"status"`
	HomeScore    *int       `json:"home_score"`
	AwayScore    *int       `json:"away_score"`
	// PenaltyWinner is "home" or "away" when a knockout finished level.
	PenaltyWinner *string `json:"penalty_winner"`
	FeedsMatchID  *string `json:"feeds_match_id"`
	FeedsSlot     *string `json:"feeds_slot"`
}

// ClubRef is the small club summary shown next to a match or a table row.
type ClubRef struct {
	ID       string `json:"id"`
	Slug     string `json:"slug"`
	Name     string `json:"name"`
	Short    string `json:"short"`
	Color    string `json:"color"`
	CrestURL string `json:"crest_url"`
}

// Played reports whether the match has a result that counts.
func (m *Match) Played() bool {
	return (m.Status == MatchCompleted || m.Status == MatchForfeit) && m.HomeScore != nil && m.AwayScore != nil
}

type PlayerStat struct {
	MatchID  string   `json:"match_id"`
	PlayerID string   `json:"player_id"`
	ClubID   string   `json:"club_id"`
	Gamertag string   `json:"gamertag,omitempty"`
	Started  bool     `json:"started"`
	Goals    int      `json:"goals"`
	Assists  int      `json:"assists"`
	Rating   *float64 `json:"rating"`
	MOTM     bool     `json:"motm"`
}

// PlayerSeasonStats is one player's totals, grouped by the club they played for.
type PlayerSeasonStats struct {
	PlayerID    string   `json:"player_id"`
	Gamertag    string   `json:"gamertag"`
	Position    string   `json:"position"`
	ClubID      string   `json:"club_id"`
	ClubName    string   `json:"club_name"`
	ClubShort   string   `json:"club_short"`
	ClubColor   string   `json:"club_color"`
	ShirtNumber *int     `json:"shirt_number"`
	AvatarURL   string   `json:"avatar_url"`
	Apps        int      `json:"apps"`
	Goals       int      `json:"goals"`
	Assists     int      `json:"assists"`
	AvgRating   *float64 `json:"avg_rating"`
	MOTMs       int      `json:"motms"`
}

type Contract struct {
	ID           string          `json:"id"`
	SeasonID     string          `json:"season_id"`
	PlayerID     string          `json:"player_id"`
	PlayerName   string          `json:"player_name"`
	ClubID       string          `json:"club_id"`
	ClubName     string          `json:"club_name"`
	ClubShort    string          `json:"club_short"`
	ClubColor    string          `json:"club_color"`
	FromClubID   *string         `json:"from_club_id"`
	FromClubName string          `json:"from_club_name,omitempty"`
	SquadRole    string          `json:"squad_role"`
	EndDate      string          `json:"end_date"`
	FeeNGN       int64           `json:"fee_ngn"`
	Terms        string          `json:"terms"`
	Status       string          `json:"status"`
	Signature    string          `json:"signature"`
	SignedAt     *time.Time      `json:"signed_at"`
	Reason       string          `json:"reason"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
	Events       []ContractEvent `json:"events,omitempty"`
}

type ContractEvent struct {
	Label string    `json:"label"`
	At    time.Time `json:"at"`
}

type TeamSheet struct {
	ID              string      `json:"id"`
	MatchID         string      `json:"match_id"`
	ClubID          string      `json:"club_id"`
	Formation       string      `json:"formation"`
	CaptainPlayerID *string     `json:"captain_player_id"`
	Status          string      `json:"status"`
	Revision        int         `json:"revision"`
	SubmittedAt     *time.Time  `json:"submitted_at"`
	ReviewReason    string      `json:"review_reason"`
	Starters        []SheetSlot `json:"starters"`
	Bench           []string    `json:"bench"`
	Errors          []string    `json:"errors,omitempty"`
}

// SheetSlot is one starting position: Index is the slot in the formation's order.
type SheetSlot struct {
	Index    int    `json:"index"`
	Position string `json:"position"`
	PlayerID string `json:"player_id"`
}
