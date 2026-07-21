package dto

// PlayRequest is the body for creating or editing a play-by-play row. Used for
// both POST and PUT — the admin form submits the full set of fields, so an
// update overwrites every column. match_id comes from the URL, not the body.
// Optional fields are pointers so a game-event / penalty-only row can omit them.
type PlayRequest struct {
	DriveNo *int    `json:"drive_no"`
	Quarter *int    `json:"quarter"`
	Clock   *string `json:"clock"`

	OffenseTeamID *string `json:"offense_team_id"`
	Down          *int    `json:"down"`
	ToGo          *int    `json:"to_go"`
	BallOn        *string `json:"ball_on"`

	PlayType      *string `json:"play_type"`
	OffQBID       *string `json:"off_qb_id"`
	TargetID      *string `json:"target_id"`
	Yards         *int    `json:"yards"`
	Result        *string `json:"result"`
	DefenderID    *string `json:"defender_id"`
	RusherID      *string `json:"rusher_id"`
	Dropped       *bool   `json:"dropped"`
	ReturnedForTD *bool   `json:"returned_for_td"`

	Penalty         *string `json:"penalty"`
	PenaltyTeamID   *string `json:"penalty_team_id"`
	PenaltyPlayerID *string `json:"penalty_player_id"`
	PenaltyYards    *int    `json:"penalty_yards"`

	HomeScoreAfter *int `json:"home_score_after"`
	AwayScoreAfter *int `json:"away_score_after"`

	Notes *string `json:"notes"`

	// Optional explicit ordering; when nil the server appends after the last play.
	Seq *int `json:"seq"`
}

// GameRulesRequest updates the per-competition scoring/format rules (Step 3).
type GameRulesRequest struct {
	TDPoints         int    `json:"td_points"`
	XPRunPoints      int    `json:"xp_run_points"`
	XPPassPoints     int    `json:"xp_pass_points"`
	SafetyPoints     int    `json:"safety_points"`
	DefReturnPoints  int    `json:"def_return_points"`
	DownsPerSeries   int    `json:"downs_per_series"`
	YardsToFirstDown int    `json:"yards_to_first_down"`
	FirstDownModel   string `json:"first_down_model"`
}
