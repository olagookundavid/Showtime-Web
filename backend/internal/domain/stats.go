package domain

import "time"

type PlayerStat struct {
	ID                  string    `json:"id"`
	PlayerID            string    `json:"player_id"`
	TeamID              string    `json:"team_id"`
	MatchID             string    `json:"match_id"`
	CompetitionID       string    `json:"competition_id"`
	MatchDate           time.Time `json:"match_date"`
	PassingAttempts     int       `json:"passing_attempts"`
	RushingAttempts     int       `json:"rushing_attempts"`
	CompletedPasses     int       `json:"completed_passes"`
	IncompletePasses    int       `json:"incomplete_passes"`
	UncatchablePasses   int       `json:"uncatchable_passes"`
	ThrownAwayPasses    int       `json:"thrown_away_passes"`
	BattedDownPasses    int       `json:"batted_down_passes"`
	Targets             int       `json:"targets"`
	PassingYards        int       `json:"passing_yards"`
	RushingYards        int       `json:"rushing_yards"`
	ReceivingYards      int       `json:"receiving_yards"`
	PassingTDs          int       `json:"passing_tds"`
	RushingTDs          int       `json:"rushing_tds"`
	InterceptionsThrown int       `json:"interceptions_thrown"`
	Receptions          int       `json:"receptions"`
	ReceivingTDs        int       `json:"receiving_tds"`
	ExtraPointsTDs      int       `json:"extra_points_tds"`
	XPAttempts          int       `json:"xp_attempts"`
	XPGood              int       `json:"xp_good"`
	XPFail              int       `json:"xp_fail"`
	Drops               int       `json:"drops"`
	FlagPulls           int       `json:"flag_pulls"`
	PassDeflections     int       `json:"pass_deflections"`
	Interceptions       int       `json:"interceptions"`
	DefensiveTDs        int       `json:"defensive_tds"`
	Safety              int       `json:"safety"`
	SafetyConceded      int       `json:"safety_conceded"`
	QBSacks             int       `json:"qb_sacks"`
	DefSacks            int       `json:"def_sacks"`
	DefensiveXPTDs      int       `json:"defensive_xp_tds"`
	QBDrives            int       `json:"qb_drives"`
	QBTurnovers         int       `json:"qb_turnovers"`
	QBPunts             int       `json:"qb_punts"`
	Snaps               int       `json:"snaps"`
	BadSnaps            int       `json:"bad_snaps"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

type AggregatedPlayerStat struct {
	PlayerID            string `json:"player_id"`
	PlayerName          string `json:"player_name"`
	PlayerImage         string `json:"player_image"`
	PlayerJerseyNumber  int    `json:"player_jersey_number"`
	PlayerPosition      string `json:"player_position"`
	TeamID              string `json:"team_id"`
	TeamName            string `json:"team_name"`
	TeamShortName       string `json:"team_short_name"`
	TeamLogo            string `json:"team_logo"`
	Apps                int    `json:"apps"`
	PassingAttempts     int    `json:"passing_attempts"`
	RushingAttempts     int    `json:"rushing_attempts"`
	CompletedPasses     int    `json:"completed_passes"`
	IncompletePasses    int    `json:"incomplete_passes"`
	UncatchablePasses   int    `json:"uncatchable_passes"`
	ThrownAwayPasses    int    `json:"thrown_away_passes"`
	BattedDownPasses    int    `json:"batted_down_passes"`
	Targets             int    `json:"targets"`
	PassingYards        int    `json:"passing_yards"`
	RushingYards        int    `json:"rushing_yards"`
	ReceivingYards      int    `json:"receiving_yards"`
	PassingTDs          int    `json:"passing_tds"`
	RushingTDs          int    `json:"rushing_tds"`
	InterceptionsThrown int    `json:"interceptions_thrown"`
	Receptions          int    `json:"receptions"`
	ReceivingTDs        int    `json:"receiving_tds"`
	ExtraPointsTDs      int    `json:"extra_points_tds"`
	XPAttempts          int    `json:"xp_attempts"`
	XPGood              int    `json:"xp_good"`
	XPFail              int    `json:"xp_fail"`
	Drops               int    `json:"drops"`
	FlagPulls           int    `json:"flag_pulls"`
	PassDeflections     int    `json:"pass_deflections"`
	Interceptions       int    `json:"interceptions"`
	DefensiveTDs        int    `json:"defensive_tds"`
	Safety              int    `json:"safety"`
	SafetyConceded      int    `json:"safety_conceded"`
	QBSacks             int    `json:"qb_sacks"`
	DefSacks            int    `json:"def_sacks"`
	DefensiveXPTDs      int    `json:"defensive_xp_tds"`
	// Internal rating inputs — per player, NOT shown as box-score columns in the
	// UI. They exist so the QB rating's per-drive components (TD rate, turnover
	// rate, sack rate) are normalized by what *this* QB actually did, rather than
	// by the team's whole-match totals: otherwise a backup who plays one drive is
	// credited with the starter's entire game.
	//   QBDrives    — distinct drives this player led (was the passer/carrier on)
	//   QBTurnovers — interceptions thrown + turnovers on downs on his drives
	//   QBPunts     — punts that ended one of his drives
	QBDrives    int `json:"qb_drives"`
	QBTurnovers int `json:"qb_turnovers"`
	QBPunts     int `json:"qb_punts"`
	// Snaps / BadSnaps — same internal-only treatment: a snap happens before
	// every pass-flow play, and tracking who snapped it (and whether it was
	// clean) is a new tracking input, not a box-score column. Not read back by
	// GetPlayerStats and not in statsSortColumns, so it never surfaces on the
	// public/admin stats tables.
	Snaps    int `json:"snaps"`
	BadSnaps int `json:"bad_snaps"`
}

type AggregatedTeamStat struct {
	TeamID              string `json:"team_id"`
	TeamName            string `json:"team_name"`
	TeamShortName       string `json:"team_short_name"`
	TeamLogo            string `json:"team_logo"`
	PassingAttempts     int    `json:"passing_attempts"`
	RushingAttempts     int    `json:"rushing_attempts"`
	CompletedPasses     int    `json:"completed_passes"`
	IncompletePasses    int    `json:"incomplete_passes"`
	UncatchablePasses   int    `json:"uncatchable_passes"`
	ThrownAwayPasses    int    `json:"thrown_away_passes"`
	BattedDownPasses    int    `json:"batted_down_passes"`
	Targets             int    `json:"targets"`
	PassingYards        int    `json:"passing_yards"`
	RushingYards        int    `json:"rushing_yards"`
	ReceivingYards      int    `json:"receiving_yards"`
	PassingTDs          int    `json:"passing_tds"`
	RushingTDs          int    `json:"rushing_tds"`
	InterceptionsThrown int    `json:"interceptions_thrown"`
	Receptions          int    `json:"receptions"`
	ReceivingTDs        int    `json:"receiving_tds"`
	ExtraPointsTDs      int    `json:"extra_points_tds"`
	XPAttempts          int    `json:"xp_attempts"`
	XPGood              int    `json:"xp_good"`
	XPFail              int    `json:"xp_fail"`
	Drops               int    `json:"drops"`
	FlagPulls           int    `json:"flag_pulls"`
	PassDeflections     int    `json:"pass_deflections"`
	Interceptions       int    `json:"interceptions"`
	DefensiveTDs        int    `json:"defensive_tds"`
	Safety              int    `json:"safety"`
	SafetyConceded      int    `json:"safety_conceded"`
	QBSacks             int    `json:"qb_sacks"`
	DefSacks            int    `json:"def_sacks"`
	DefensiveXPTDs      int    `json:"defensive_xp_tds"`
	// Team-only stats (not derived from any player's line — from team_match_stats).
	Punts        int `json:"punts"`
	FirstDowns   int `json:"first_downs"`
	Turnovers    int `json:"turnovers"`
	Penalties    int `json:"penalties"`
	PenaltyYards int `json:"penalty_yards"`
	TotalPlays   int `json:"total_plays"`
	Drives       int `json:"drives"`
}

// TeamMatchStat is the team-only stat line for one team in one match.
type TeamMatchStat struct {
	TeamID        string
	MatchID       string
	CompetitionID string
	MatchDate     time.Time
	Punts         int
	FirstDowns    int
	Turnovers     int
	Penalties     int
	PenaltyYards  int
	TotalPlays    int
	Drives        int
}

type StatsFilter struct {
	CompetitionID string
	MatchID       string
	EventDay      *time.Time
	PlayerID      string
	SearchQuery   string
	SortBy        string // stat column key; empty = alphabetical by name
	Page          int
	Limit         int
}
