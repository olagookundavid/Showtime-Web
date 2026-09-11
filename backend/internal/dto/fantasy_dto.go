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

type ScheduledMatchDayDTO struct {
	Date            string `json:"date"`
	MatchCount      int    `json:"match_count"`
	EarliestKickoff string `json:"earliest_kickoff"`
	EventDayID      string `json:"event_day_id,omitempty"`
}

type CreateGameweekRequest struct {
	Number     int    `json:"number" binding:"required,min=1"`
	EventDayID string `json:"event_day_id" binding:"omitempty"`
	MatchDate  string `json:"match_date" binding:"omitempty"`
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
	SeasonID   string `json:"season_id" binding:"required,uuid"`
	GameweekID string `json:"gameweek_id" binding:"required,uuid"`
	TeamName   string `json:"team_name" binding:"required,min=3,max=40"`
	// Up to fourteen picks. It is deliberately not len=14: the squad builder
	// saves the sheet after every pick, so most requests carry a partial team.
	// Completeness is decided in the service, which can tell the manager what
	// is still missing — a binding rejection could only say "invalid input".
	//
	// Empty is allowed on purpose: benching the last remaining starter leaves a
	// sheet with no picks, and that has to save like any other edit.
	Picks []LineupSlotItem `json:"picks" binding:"max=14,dive"`
	// Publish is the manager pressing "Publish Lineup": the deliberate act that
	// puts a finished sheet into the scoring run. Saving without it keeps the
	// work safe but earns nothing, so completing a squad never starts scoring
	// by accident.
	Publish bool `json:"publish"`
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
	// Complete is true when the sheet is finished and passes every rule — that
	// is, it is ready to publish. It says nothing about whether it has been.
	Complete bool `json:"complete"`
	// Published is true when the lineup is in the scoring run. Only a published
	// lineup earns points, and publishing is always the manager's own action.
	Published bool `json:"published"`
	// BlockingReason says, in the manager's words, what stands between this
	// sheet and being publishable — "9 of 14 slots filled", or the rule it
	// misses. Empty once Complete is true.
	BlockingReason string                      `json:"blocking_reason,omitempty"`
	Picks          []FantasyLineupPickResponse `json:"picks"`
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
	TotalPoints float64 `json:"total_points"`

	// Ownership across the season's managers. OwnedBy counts squads holding the
	// player right now; TransfersIn and TransfersOut are how many times they
	// have been signed and sold all season. Together they show whether a player
	// is being loaded up on or dumped, which is the market signal managers
	// actually trade against.
	OwnedBy       int     `json:"owned_by"`
	SelectedByPct float64 `json:"selected_by_pct"`
	TransfersIn   int     `json:"transfers_in"`
	TransfersOut  int     `json:"transfers_out"`
}

// ─── League DTOs ──────────────────────────────────────────────────────────────

type CreateLeagueRequest struct {
	SeasonID   string `json:"season_id" binding:"required,uuid"`
	Name       string `json:"name" binding:"required,min=3,max=50"`
	Type       string `json:"type" binding:"required,oneof=PUBLIC PRIVATE"`
	EntryFee   int    `json:"entry_fee" binding:"min=0"`   // In kobo (₦ * 100)
	MaxMembers int    `json:"max_members" binding:"min=0"` // 0 = unlimited
	// How the prize pool is divided. Set by whoever creates the league — it is
	// their competition to shape. Omitted, it falls back to the default split,
	// and an admin can still adjust it later.
	PrizeStructure []PrizeTierInput `json:"prize_structure" binding:"omitempty,max=50,dive"`
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

// ─── Squad & trading ─────────────────────────────────────────────────────────

// SquadRules restates the season's constraints alongside the squad they govern,
// so the trading dashboard can show a manager what it is holding them to instead
// of keeping its own copy that drifts from the season's real settings.
type SquadRules struct {
	Budget           float64 `json:"budget"`
	MinFemaleOffense int     `json:"min_female_offense"`
	MinFemaleDefense int     `json:"min_female_defense"`
	MaxPerClub       int     `json:"max_per_club"`
}

// SquadResponse is the trading dashboard in one payload: who is owned, what the
// squad is worth today, what is left to spend, and why it is not ready if it
// isn't.
type SquadResponse struct {
	Players []domain.SquadPlayer `json:"players"`

	// Bank is unspent money; SquadValue is what the squad would fetch today, so
	// the two together show whether the manager is up or down on their trading.
	Bank       float64 `json:"bank"`
	SquadValue float64 `json:"squad_value"`

	// Female cover on each side of the ball, against the minimums in Rules. The
	// quotas are per unit, so these are counted separately.
	FemaleOffense int `json:"female_offense"`
	FemaleDefense int `json:"female_defense"`

	SquadSize  int `json:"squad_size"`
	SquadMin   int `json:"squad_min"`
	SquadMax   int `json:"squad_max"`
	StartingXI int `json:"starting_xi"`
	Starters   int `json:"starters"`
	Subs       int `json:"subs"`

	Rules SquadRules `json:"rules"`

	// MarketOpen says whether trading is allowed right now. The market shuts
	// while a gameweek is being played and reopens once its scores are final, so
	// the dashboard can disable Buy and Sell and say why rather than letting a
	// manager click into a rejection.
	MarketOpen         bool   `json:"market_open"`
	MarketClosedReason string `json:"market_closed_reason,omitempty"`

	// Readiness is the checklist the squad screen works down: what a legal
	// starting fourteen needs, what the squad has, and whether the match day
	// would be forfeited as things stand. Guidance, not enforcement — the
	// lineup selector is what actually holds the line.
	Readiness domain.SquadReadiness `json:"readiness"`
}

// ─── Admin Player Pricing DTOs ───────────────────────────────────────────────

type AdminPlayerPriceItem struct {
	PlayerID        string   `json:"player_id"`
	PlayerName      string   `json:"player_name"`
	PlayerImage     string   `json:"player_image"`
	Position        string   `json:"position"`
	Gender          string   `json:"gender"`
	TeamID          string   `json:"team_id"`
	TeamName        string   `json:"team_name"`
	TeamShortName   string   `json:"team_short_name"`
	TeamLogo        string   `json:"team_logo"`
	Price           float64  `json:"price"`
	CalculatedPrice *float64 `json:"calculated_price"`
	IsOverridden    bool     `json:"is_overridden"`
	Rating          float64  `json:"rating"`
}

// AdminOverridePriceRequest carries a manual price, or Reset to clear one.
// The bounds mirror domain.PriceFloor and domain.PriceCeiling; the service
// re-checks them against those constants, so this is only a fast rejection.
type AdminOverridePriceRequest struct {
	Price *float64 `json:"price" binding:"omitempty,min=3,max=12.5"`
	Reset bool     `json:"reset"`
}
