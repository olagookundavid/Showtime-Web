package domain

import "strings"

// StatLine is one labelled number on a player card, e.g. {"Rec Yds", "84"}.
type StatLine struct {
	Label string
	Value string
}

// statLabelKeys maps a Team of the Week stat label to its key in a player's day
// stats (see ports.playerDayStats). Mirrors STAT_LABEL_KEYS in the admin
// Team of the Week editor (frontend/src/pages/admin/AdminTOTW.tsx).
var statLabelKeys = map[string]string{
	"pass td":     "pass_td",
	"pass yds":    "pass_yards",
	"cmp %":       "cmp_pct",
	"completions": "pass_completions",
	"rush yds":    "rush_yards",
	"rush td":     "rush_td",
	"catches":     "catches",
	"rec yds":     "rec_yards",
	"rec td":      "rec_td",
	"drops":       "drops",
	"sacks":       "sacks",
	"flag pulls":  "flag_pulls",
	"tackles":     "flag_pulls",
	"pass def":    "pass_defended",
	"int":         "interceptions",

	// The labels the editor's stat dropdown writes: the short labels of the
	// stats table (frontend/src/constants/stats.ts), keyed by the stats-table key.
	"pass att":        "passing_attempts",
	"comp. passes":    "completed_passes",
	"inc. passes":     "incomplete_passes",
	"passing tds":     "passing_tds",
	"int thrown":      "interceptions_thrown",
	"uncatchable":     "uncatchable_passes",
	"thrown away":     "thrown_away_passes",
	"batted down":     "batted_down_passes",
	"qb sacks":        "qb_sacks",
	"rush att":        "rushing_attempts",
	"rushing tds":     "rushing_tds",
	"targets":         "targets",
	"receptions":      "receptions",
	"receiving tds":   "receiving_tds",
	"xp att":          "xp_attempts",
	"xp good":         "xp_good",
	"xp fail":         "xp_fail",
	"xp tds":          "extra_points_tds",
	"snaps":           "snaps",
	"bad snaps":       "bad_snaps",
	"pass deflect":    "pass_deflections",
	"int caught":      "interceptions",
	"def sacks":       "def_sacks",
	"def tds":         "defensive_tds",
	"def xp tds":      "defensive_xp_tds",
	"safety":          "safety",
	"safety conceded": "safety_conceded",
}

// LiveStatLines fills a card's stat lines from the player's recorded stats for
// the week, so a card never shows a number someone forgot to type in.
//
//   - No recorded stats: the lines are returned as they are.
//   - A line whose label matches a recorded stat takes the recorded value.
//   - No label matches (or none was set): the suggested lines for what the player
//     actually did (passing, defence, receiving or rushing) replace them.
func LiveStatLines(lines [3]StatLine, dayStats map[string]string) [3]StatLine {
	if len(dayStats) == 0 {
		return lines
	}
	matched := 0
	for i, line := range lines {
		key := statLabelKeys[strings.ToLower(strings.TrimSpace(line.Label))]
		if v, ok := dayStats[key]; key != "" && ok {
			lines[i].Value = v
			matched++
		}
	}
	if matched > 0 || dayStats["stat1_lbl"] == "" {
		return lines
	}
	for i := range lines {
		n := string(rune('1' + i))
		lines[i] = StatLine{Label: dayStats["stat"+n+"_lbl"], Value: dayStats["stat"+n+"_val"]}
	}
	return lines
}
