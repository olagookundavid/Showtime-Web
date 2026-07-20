package domain

import "time"

// GameRules is the per-competition scoring/format configuration the play-by-play
// engine reads. Values default to the design-doc placeholders until the
// commissioner confirms the league's real rules.
type GameRules struct {
	CompetitionID    string    `json:"competition_id"`
	TDPoints         int       `json:"td_points"`
	XPRunPoints      int       `json:"xp_run_points"`
	XPPassPoints     int       `json:"xp_pass_points"`
	SafetyPoints     int       `json:"safety_points"`
	DefReturnPoints  int       `json:"def_return_points"`
	DownsPerSeries   int       `json:"downs_per_series"`
	YardsToFirstDown int       `json:"yards_to_first_down"`
	FirstDownModel   string    `json:"first_down_model"` // "yardage" | "zone"
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// DefaultGameRules returns the placeholder ruleset for a competition that has no
// stored rules yet (matches the values in the commissioner PDF).
func DefaultGameRules(competitionID string) GameRules {
	return GameRules{
		CompetitionID:    competitionID,
		TDPoints:         6,
		XPRunPoints:      1,
		XPPassPoints:     2,
		SafetyPoints:     2,
		DefReturnPoints:  6,
		DownsPerSeries:   4,
		YardsToFirstDown: 10,
		FirstDownModel:   "yardage",
	}
}
