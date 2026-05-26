package dto

// ImportMatchPlayerRow is one parsed CSV row: a single player's appearance and
// stats for the match being imported. `Side` is "home" or "away".
type ImportMatchPlayerRow struct {
	Side                string `json:"side" binding:"required"`
	PlayerName          string `json:"player_name" binding:"required"`
	JerseyNumber        int    `json:"jersey_number"`
	Position            string `json:"position"`
	PassingAttempts     int    `json:"passing_attempts"`
	RushingAttempts     int    `json:"rushing_attempts"`
	CompletedPasses     int    `json:"completed_passes"`
	PassingTDs          int    `json:"passing_tds"`
	RushingTDs          int    `json:"rushing_tds"`
	InterceptionsThrown int    `json:"interceptions_thrown"`
	Receptions          int    `json:"receptions"`
	ReceivingTDs        int    `json:"receiving_tds"`
	ExtraPointsTDs      int    `json:"extra_points_tds"`
	Drops               int    `json:"drops"`
	FlagPulls           int    `json:"flag_pulls"`
	PassDeflections     int    `json:"pass_deflections"`
	Interceptions       int    `json:"interceptions"`
	DefensiveTDs        int    `json:"defensive_tds"`
	Safety              int    `json:"safety"`
	QBSacks             int    `json:"qb_sacks"`
	DefSacks            int    `json:"def_sacks"`
}

type ImportMatchRequest struct {
	Rows []ImportMatchPlayerRow `json:"rows" binding:"required"`
}
