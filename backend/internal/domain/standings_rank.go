package domain

import (
	"sort"
	"strings"
)

// StandingsResult is one scored regular-season match, the input to the
// head-to-head tie-breaker.
type StandingsResult struct {
	HomeTeamID string
	AwayTeamID string
	HomeScore  int
	AwayScore  int
}

// IsH2HTieBreakerRule reports whether rule selects Rule 2. Older rows may hold
// free-text values such as "RULE_2", so the match is deliberately loose.
func IsH2HTieBreakerRule(rule string) bool {
	r := strings.ToUpper(strings.TrimSpace(rule))
	return strings.Contains(r, "H2H") || strings.Contains(r, "RULE_2") || strings.Contains(r, "RULE 2")
}

// RankStandings orders standings in place and sets each Position.
//
// Rule 1: Win % -> Point Diff -> Points For -> Points Against -> Name.
//
// Rule 2: Win % always comes first. Only teams level on Win % are then split by
// head-to-head: each tied team's win % in games against the other tied teams
// (regular season only). Head-to-head applies only when every tied team has
// played every other; otherwise the group falls through to Point Diff -> Points
// For -> Points Against -> Name. When head-to-head separates part of a group,
// it is re-applied to the teams still level.
func RankStandings(standings []Standing, rule string, results []StandingsResult) {
	sort.SliceStable(standings, func(i, j int) bool {
		return lessByRecord(standings[i], standings[j])
	})

	if IsH2HTieBreakerRule(rule) {
		for _, group := range levelRuns(standings, func(a, b Standing) bool { return a.PCT == b.PCT }) {
			rankByHeadToHead(group, results)
		}
	}

	for i := range standings {
		standings[i].Position = i + 1
	}
}

// lessByRecord is Rule 1's full ordering, and the fall-through for Rule 2.
func lessByRecord(a, b Standing) bool {
	if a.PCT != b.PCT {
		return a.PCT > b.PCT
	}
	if a.GoalDiff != b.GoalDiff {
		return a.GoalDiff > b.GoalDiff
	}
	if a.GoalsFor != b.GoalsFor {
		return a.GoalsFor > b.GoalsFor
	}
	if a.GoalsAgainst != b.GoalsAgainst {
		return a.GoalsAgainst < b.GoalsAgainst
	}
	keyA, keyB := teamSortKey(a.Team), teamSortKey(b.Team)
	if keyA != keyB {
		return keyA < keyB
	}
	return a.TeamID < b.TeamID
}

func teamSortKey(t *Team) string {
	if t == nil {
		return ""
	}
	name := strings.TrimSpace(t.Name)
	if name == "" {
		name = strings.TrimSpace(t.ShortName)
	}
	return strings.ToLower(name)
}

// h2hRecord counts a team's games against the rest of a tied group. Win % is
// kept as halfPoints/(2*played) — a win is 2, a draw 1 — so it compares exactly.
type h2hRecord struct {
	played     int
	halfPoints int
}

// rankByHeadToHead reorders a group of teams level on Win %, which arrives
// already in record order. A stable sort keeps that order for teams still
// level on head-to-head.
func rankByHeadToHead(group []Standing, results []StandingsResult) {
	if len(group) < 2 {
		return
	}

	inGroup := make(map[string]bool, len(group))
	for _, s := range group {
		inGroup[s.TeamID] = true
	}

	records := make(map[string]*h2hRecord, len(group))
	for _, s := range group {
		records[s.TeamID] = &h2hRecord{}
	}
	met := make(map[[2]string]bool)
	for _, r := range results {
		if r.HomeTeamID == r.AwayTeamID || !inGroup[r.HomeTeamID] || !inGroup[r.AwayTeamID] {
			continue
		}
		met[pairKey(r.HomeTeamID, r.AwayTeamID)] = true
		home, away := records[r.HomeTeamID], records[r.AwayTeamID]
		home.played++
		away.played++
		switch {
		case r.HomeScore > r.AwayScore:
			home.halfPoints += 2
		case r.AwayScore > r.HomeScore:
			away.halfPoints += 2
		default:
			home.halfPoints++
			away.halfPoints++
		}
	}

	for i := range group {
		for j := i + 1; j < len(group); j++ {
			if !met[pairKey(group[i].TeamID, group[j].TeamID)] {
				return
			}
		}
	}

	// compare returns >0 when a has the better head-to-head win %.
	compare := func(a, b Standing) int {
		ra, rb := records[a.TeamID], records[b.TeamID]
		return ra.halfPoints*rb.played - rb.halfPoints*ra.played
	}
	sort.SliceStable(group, func(i, j int) bool {
		return compare(group[i], group[j]) > 0
	})

	for _, sub := range levelRuns(group, func(a, b Standing) bool { return compare(a, b) == 0 }) {
		if len(sub) < len(group) {
			rankByHeadToHead(sub, results)
		}
	}
}

func pairKey(a, b string) [2]string {
	if a > b {
		a, b = b, a
	}
	return [2]string{a, b}
}

// levelRuns returns each run of two or more adjacent standings that level
// reports as tied. The runs share s's backing array, so sorting one reorders s.
func levelRuns(s []Standing, level func(a, b Standing) bool) [][]Standing {
	var runs [][]Standing
	start := 0
	for i := 1; i <= len(s); i++ {
		if i == len(s) || !level(s[start], s[i]) {
			if i-start > 1 {
				runs = append(runs, s[start:i])
			}
			start = i
		}
	}
	return runs
}
