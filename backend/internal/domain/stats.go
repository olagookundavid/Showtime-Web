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
	PassingTDs          int       `json:"passing_tds"`
	RushingTDs          int       `json:"rushing_tds"`
	InterceptionsThrown int       `json:"interceptions_thrown"`
	Receptions          int       `json:"receptions"`
	ReceivingTDs        int       `json:"receiving_tds"`
	ExtraPointsTDs      int       `json:"extra_points_tds"`
	Drops               int       `json:"drops"`
	FlagPulls           int       `json:"flag_pulls"`
	PassDeflections     int       `json:"pass_deflections"`
	Interceptions       int       `json:"interceptions"`
	DefensiveTDs        int       `json:"defensive_tds"`
	Safety              int       `json:"safety"`
	QBSacks             int       `json:"qb_sacks"`
	DefSacks            int       `json:"def_sacks"`
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

type AggregatedTeamStat struct {
	TeamID              string `json:"team_id"`
	TeamName            string `json:"team_name"`
	TeamShortName       string `json:"team_short_name"`
	TeamLogo            string `json:"team_logo"`
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

type StatsFilter struct {
	CompetitionID string
	EventDay      *time.Time
	PlayerID      string
	Page          int
	Limit         int
}
