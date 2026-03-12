package dto

type UpsertPlayerStatRequest struct {
	PlayerID            string `json:"player_id" binding:"required"`
	TeamID              string `json:"team_id" binding:"required"`
	MatchID             string `json:"match_id"`
	CompetitionID       string `json:"competition_id" binding:"required"`
	MatchDate           string `json:"match_date" binding:"required"` // YYYY-MM-DD
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
