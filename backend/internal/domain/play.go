package domain

import "time"

// GamePlay is one row of the play-by-play log — a single play, mirroring the
// official Showtime stat sheet. Optional fields are pointers because a row may
// be a game event (injury / end of quarter) or a penalty-only stoppage with no
// offensive players or yardage. Player/team relations are hydrated on read.
type GamePlay struct {
	ID      string `json:"id"`
	MatchID string `json:"match_id"`

	Seq     int `json:"seq"`
	DriveNo int `json:"drive_no"`

	// Pre-play context.
	Quarter       int     `json:"quarter"`
	Clock         *string `json:"clock,omitempty"`
	OffenseTeamID *string `json:"offense_team_id,omitempty"`
	Down          *int    `json:"down,omitempty"`
	ToGo          *int    `json:"to_go,omitempty"`
	BallOn        *string `json:"ball_on,omitempty"`

	// What happened.
	PlayType      *string `json:"play_type,omitempty"`
	OffQBID       *string `json:"off_qb_id,omitempty"`
	TargetID      *string `json:"target_id,omitempty"`
	Yards         *int    `json:"yards,omitempty"`
	Result        *string `json:"result,omitempty"`
	DefenderID    *string `json:"defender_id,omitempty"`
	RusherID      *string `json:"rusher_id,omitempty"`
	Dropped       bool    `json:"dropped"`
	BattedDown    bool    `json:"batted_down"`
	Uncatchable   bool    `json:"uncatchable"`
	ReturnedForTD bool    `json:"returned_for_td"`

	// Penalty.
	Penalty         *string `json:"penalty,omitempty"`
	PenaltyTeamID   *string `json:"penalty_team_id,omitempty"`
	PenaltyPlayerID *string `json:"penalty_player_id,omitempty"`
	PenaltyYards    *int    `json:"penalty_yards,omitempty"`

	// Running score after the play.
	HomeScoreAfter *int `json:"home_score_after,omitempty"`
	AwayScoreAfter *int `json:"away_score_after,omitempty"`

	Notes     *string   `json:"notes,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// Hydrated relations (names/jerseys for display).
	OffenseTeam   *Team   `json:"offense_team,omitempty"`
	OffQB         *Player `json:"off_qb,omitempty"`
	Target        *Player `json:"target,omitempty"`
	Defender      *Player `json:"defender,omitempty"`
	Rusher        *Player `json:"rusher,omitempty"`
	PenaltyPlayer *Player `json:"penalty_player,omitempty"`
}

// MatchPlayCount identifies a match that has a play log, with enough label to
// show the admin what a bulk stats recompute is about to touch.
type MatchPlayCount struct {
	MatchID string `json:"match_id"`
	Label   string `json:"label"`
	Date    string `json:"date"`
	Plays   int    `json:"plays"`
}

// Official code sets from the stat sheet. Kept here (not the DB) so the play
// service can validate incoming codes without a rules migration. FG = Flag Pull
// (not field goal); KO = Throw-Off.
var (
	PlayTypeCodes = map[string]bool{
		"CP": true, "INC": true, "TDP": true, "INT": true, "SACK": true,
		"SCR": true, "HM": true, "TA": true, "XP-P": true, "RUN": true,
		"QBR": true, "SWP": true, "REV": true, "PAT-R": true, "PUNT": true,
		"KO": true, "SAF": true,
	}
	// The official sheet's Result Codes list (13 codes) has no dedicated code
	// for "incomplete" or "safety" as an outcome, so play entry and the
	// derivation/scoring engines (services/play_stats.go, services/play_engine.go)
	// use "INC" and "SAF" as practical extensions — accepted here alongside the
	// 13 official codes so those flows validate correctly.
	ResultCodes = map[string]bool{
		"1D": true, "1DG": true, "TD": true, "XP": true, "XPF": true,
		"TO": true, "INT": true, "OB": true, "FG": true, "DB": true,
		"IH": true, "EH": true, "EG": true, "OMW": true,
		"INC": true, "SAF": true,
	}
	PenaltyCodes = map[string]bool{
		"FS": true, "OFF": true, "ENC": true, "DOG": true, "OPI": true,
		"DPI": true, "FGD": true, "HLD": true, "RPC": true, "IMP": true,
		"SUB": true, "IF": true, "MOT": true, "FAV": true, "UF": true,
	}
)
