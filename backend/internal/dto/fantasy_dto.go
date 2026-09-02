package dto

import "showtime-backend/internal/domain"

// ─── Season DTOs ──────────────────────────────────────────────────────────────

// CreateFantasySeasonRequest carries the season's tunable squad rules. The
// numeric fields are pointers so an omitted field ("use the default") is
// distinguishable from a deliberate zero — `binding:"required"` treats 0 as
// missing, which would otherwise make a 0 quota impossible to express.
type CreateFantasySeasonRequest struct {
	CompetitionID    string   `json:"competition_id" binding:"required,uuid"`
	Name             string   `json:"name" binding:"required"`
	SquadSize        *int     `json:"squad_size" binding:"omitempty,min=14,max=14"`
	Budget           *float64 `json:"budget" binding:"omitempty,min=1"`
	MinFemaleOffense *int     `json:"min_female_offense" binding:"omitempty,min=0,max=7"`
	MinFemaleDefense *int     `json:"min_female_defense" binding:"omitempty,min=0,max=7"`
	MaxPerClub       *int     `json:"max_per_club" binding:"omitempty,min=1,max=14"`
	LockMinsBefore   *int     `json:"lock_mins_before" binding:"omitempty,min=0,max=1440"`
}

type FantasySeasonResponse struct {
	ID               string  `json:"id"`
	CompetitionID    string  `json:"competition_id"`
	Name             string  `json:"name"`
	SquadSize        int     `json:"squad_size"`
	Budget           float64 `json:"budget"`
	MinFemaleOffense int     `json:"min_female_offense"`
	MinFemaleDefense int     `json:"min_female_defense"`
	MaxPerClub       int     `json:"max_per_club"`
	LockMinsBefore   int     `json:"lock_mins_before"`
	Status           string  `json:"status"`
	CreatedAt        string  `json:"created_at"`
}

// ─── Gameweek DTOs ────────────────────────────────────────────────────────────

type CreateGameweekRequest struct {
	Number     int    `json:"number" binding:"required,min=1"`
	EventDayID string `json:"event_day_id" binding:"required,uuid"`
	// Deadline is an optional RFC3339 override. Left empty, the server derives
	// it from the event day's first kickoff minus the season's lock_mins_before.
	Deadline string `json:"deadline" binding:"omitempty"`
}

type UpdateGameweekDeadlineRequest struct {
	Deadline string `json:"deadline" binding:"required"`
}

type GameweekResponse struct {
	ID         string `json:"id"`
	SeasonID   string `json:"season_id"`
	Number     int    `json:"number"`
	EventDayID string `json:"event_day_id"`
	Deadline   string `json:"deadline"`
	Status     string `json:"status"`
	// FirstKickoff is the event day's earliest kickoff, so an admin can see what
	// the deadline was derived from. Empty when the day has no fixtures yet.
	FirstKickoff string `json:"first_kickoff,omitempty"`
}

// ─── Season entry ─────────────────────────────────────────────────────────────

type EnterSeasonRequest struct {
	TeamName string `json:"team_name" binding:"required,min=3,max=40"`
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

// DashboardTeam is the manager's own standing in the season.
type DashboardTeam struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	TotalPoints    float64 `json:"total_points"`
	GameweekPoints float64 `json:"gameweek_points"`
	OverallRank    int     `json:"overall_rank"`
	TotalManagers  int     `json:"total_managers"`
}

// DashboardLeagueRow is one of the manager's mini-leagues and where they sit.
type DashboardLeagueRow struct {
	LeagueID     string `json:"league_id"`
	Name         string `json:"name"`
	Type         string `json:"type"`
	MemberCount  int    `json:"member_count"`
	MyRank       int    `json:"my_rank"`
	EntryFeeKobo int64  `json:"entry_fee_kobo"`
}

// FantasyDashboardResponse is everything the manager's weekly landing page
// needs, in one round trip.
type FantasyDashboardResponse struct {
	Season  FantasySeasonResponse `json:"season"`
	Entered bool                  `json:"entered"`

	Team   *DashboardTeam         `json:"team,omitempty"`
	Lineup *FantasyLineupResponse `json:"lineup,omitempty"`

	// CurrentGameweek is the one open for entry, or the most recent otherwise.
	CurrentGameweek *GameweekResponse `json:"current_gameweek,omitempty"`
	// DeadlinePassed distinguishes "still time to edit" from "locked in".
	DeadlinePassed bool `json:"deadline_passed"`

	Leagues     []DashboardLeagueRow `json:"leagues"`
	TopManagers []LeaderboardEntry   `json:"top_managers"`
}

// ─── Lineup Submission / Save DTOs ────────────────────────────────────────────

type LineupSlotItem struct {
	PlayerID string             `json:"player_id" binding:"required,uuid"`
	Slot     domain.FantasySlot `json:"slot" binding:"required,oneof=QB_M QB_F REC_1 REC_2 REC_3 REC_4 REC_5 RUSHER DEF_1 DEF_2 DEF_3 DEF_4 DEF_5 DEF_6"`
}

type SaveLineupRequest struct {
	SeasonID   string           `json:"season_id" binding:"required,uuid"`
	GameweekID string           `json:"gameweek_id" binding:"required,uuid"`
	TeamName   string           `json:"team_name" binding:"required,min=3,max=40"`
	Picks      []LineupSlotItem `json:"picks" binding:"required,len=14,dive"`
}

type FantasyLineupPickResponse struct {
	Slot          string  `json:"slot"`
	PlayerID      string  `json:"player_id"`
	PlayerName    string  `json:"player_name"`
	PlayerImage   string  `json:"player_image"`
	Position      string  `json:"position"`
	Gender        string  `json:"gender"`
	TeamID        string  `json:"team_id"`
	TeamName      string  `json:"team_name"`
	TeamShortName string  `json:"team_short_name"`
	TeamLogo      string  `json:"team_logo"`
	PurchasePrice float64 `json:"purchase_price"`
	CurrentPrice  float64 `json:"current_price"`
	Points        float64 `json:"points"`
}

type FantasyLineupResponse struct {
	ID         string                      `json:"id"`
	TeamID     string                      `json:"team_id"`
	TeamName   string                      `json:"team_name"`
	GameweekID string                      `json:"gameweek_id"`
	TotalSpent float64                     `json:"total_spent"`
	Remaining  float64                     `json:"remaining_budget"`
	Points     float64                     `json:"points"`
	Status     string                      `json:"status"`
	IsRollover bool                        `json:"is_rollover"` // true if carried forward from previous GW
	Picks      []FantasyLineupPickResponse `json:"picks"`
}

// ─── Player Market DTO ────────────────────────────────────────────────────────

type FantasyPlayerListItem struct {
	PlayerID      string  `json:"player_id"`
	PlayerName    string  `json:"player_name"`
	PlayerImage   string  `json:"player_image"`
	Position      string  `json:"position"`
	Gender        string  `json:"gender"`
	TeamID        string  `json:"team_id"`
	TeamName      string  `json:"team_name"`
	TeamShortName string  `json:"team_short_name"`
	TeamLogo      string  `json:"team_logo"`
	Price         float64 `json:"price"`
	Rating        float64 `json:"rating"`
	TotalPoints   float64 `json:"total_points"`
	SelectedByPct float64 `json:"selected_by_pct"`
}

// ─── League DTOs ──────────────────────────────────────────────────────────────

type CreateLeagueRequest struct {
	SeasonID   string `json:"season_id" binding:"required,uuid"`
	Name       string `json:"name" binding:"required,min=3,max=50"`
	Type       string `json:"type" binding:"required,oneof=PUBLIC PRIVATE"`
	EntryFee   int    `json:"entry_fee" binding:"min=0"`   // In kobo (₦ * 100)
	MaxMembers int    `json:"max_members" binding:"min=0"` // 0 = unlimited
}

type LeagueResponse struct {
	ID              string `json:"id"`
	SeasonID        string `json:"season_id"`
	Name            string `json:"name"`
	Type            string `json:"type"`
	InviteCode      string `json:"invite_code,omitempty"`
	CreatedByUserID string `json:"created_by_user_id"`
	EntryFee        int    `json:"entry_fee"`
	MaxMembers      int    `json:"max_members"`
	MemberCount     int    `json:"member_count"`
	CreatedAt       string `json:"created_at"`
}

// JoinLeagueRequest identifies the league either way round: a PUBLIC league can
// be joined straight from the browse list by id, while a PRIVATE one still
// needs its invite code. Exactly one of the two is required.
type JoinLeagueRequest struct {
	InviteCode string `json:"invite_code" binding:"omitempty"`
	LeagueID   string `json:"league_id" binding:"omitempty,uuid"`
}

type JoinLeagueResponse struct {
	LeagueID           string `json:"league_id"`
	LeagueName         string `json:"league_name"`
	PaystackURL        string `json:"paystack_url,omitempty"`
	PaystackRef        string `json:"paystack_ref,omitempty"`
	PaystackAccessCode string `json:"paystack_access_code,omitempty"`
}

type LeaderboardEntry struct {
	Rank        int     `json:"rank"`
	UserID      string  `json:"user_id"`
	UserName    string  `json:"user_name"`
	TeamName    string  `json:"team_name"`
	TeamID      string  `json:"team_id"`
	GWPoints    float64 `json:"gw_points"`
	TotalPoints float64 `json:"total_points"`
}

// ─── Points Breakdown DTO ─────────────────────────────────────────────────────

type PlayerGWBreakdownResponse struct {
	PlayerID   string                        `json:"player_id"`
	PlayerName string                        `json:"player_name"`
	MatchID    string                        `json:"match_id"`
	MatchLabel string                        `json:"match_label"`
	Points     float64                       `json:"points"`
	Breakdown  domain.FantasyPointsBreakdown `json:"breakdown"`
}
