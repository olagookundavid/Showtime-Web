package domain

import (
	"strings"
	"testing"
)

func st(id string, pct float64, gd, gf, ga int) Standing {
	return Standing{TeamID: id, PCT: pct, GoalDiff: gd, GoalsFor: gf, GoalsAgainst: ga, Team: &Team{Name: id}}
}

func game(home, away string, hs, as int) StandingsResult {
	return StandingsResult{HomeTeamID: home, AwayTeamID: away, HomeScore: hs, AwayScore: as}
}

func order(s []Standing) string {
	ids := make([]string, len(s))
	for i, x := range s {
		if x.Position != i+1 {
			ids[i] = x.TeamID + "(bad position)"
			continue
		}
		ids[i] = x.TeamID
	}
	return strings.Join(ids, ",")
}

func TestRankStandingsRule1(t *testing.T) {
	s := []Standing{
		st("D", 50, 0, 10, 10),
		st("C", 50, 0, 10, 8),
		st("B", 50, 5, 20, 15),
		st("A", 80, -2, 5, 7),
		st("E", 50, 0, 10, 8),
	}
	RankStandings(s, TieBreakerRulePCT_PD_PF_PA_NAME, []StandingsResult{game("D", "A", 30, 0)})
	if got, want := order(s), "A,B,C,E,D"; got != want {
		t.Fatalf("got %s, want %s", got, want)
	}
}

func TestRankStandingsRule2WinPctBeatsHeadToHead(t *testing.T) {
	// B beat A, but A has the far better record: Win % must win.
	s := []Standing{st("B", 16.7, -20, 10, 30), st("A", 83.3, 20, 30, 10)}
	RankStandings(s, TieBreakerRuleH2H_PCT_PD_PF_PA_NAME, []StandingsResult{game("B", "A", 14, 7)})
	if got, want := order(s), "A,B"; got != want {
		t.Fatalf("got %s, want %s", got, want)
	}
}

func TestRankStandingsRule2TwoWayTie(t *testing.T) {
	// A has the better point diff, but B won the head-to-head.
	s := []Standing{st("A", 50, 10, 30, 20), st("B", 50, -5, 20, 25), st("C", 25, 0, 0, 0)}
	RankStandings(s, TieBreakerRuleH2H_PCT_PD_PF_PA_NAME, []StandingsResult{
		game("A", "B", 6, 12),
		game("A", "C", 20, 0),
	})
	if got, want := order(s), "B,A,C"; got != want {
		t.Fatalf("got %s, want %s", got, want)
	}
}

func TestRankStandingsRule2HeadToHeadSplitFallsThrough(t *testing.T) {
	// One win each: head-to-head is level, so point diff decides.
	s := []Standing{st("B", 50, -5, 20, 25), st("A", 50, 10, 30, 20)}
	RankStandings(s, TieBreakerRuleH2H_PCT_PD_PF_PA_NAME, []StandingsResult{
		game("A", "B", 6, 12),
		game("B", "A", 0, 7),
	})
	if got, want := order(s), "A,B"; got != want {
		t.Fatalf("got %s, want %s", got, want)
	}
}

func TestRankStandingsRule2ThreeWayMiniTable(t *testing.T) {
	// C beat both A and B; A beat B. Mini-table: C 2-0, A 1-1, B 0-2.
	s := []Standing{st("A", 50, 9, 0, 0), st("B", 50, 5, 0, 0), st("C", 50, 1, 0, 0)}
	RankStandings(s, TieBreakerRuleH2H_PCT_PD_PF_PA_NAME, []StandingsResult{
		game("C", "A", 7, 0),
		game("B", "C", 0, 7),
		game("A", "B", 7, 0),
	})
	if got, want := order(s), "C,A,B"; got != want {
		t.Fatalf("got %s, want %s", got, want)
	}
}

func TestRankStandingsRule2CycleFallsThrough(t *testing.T) {
	// A beat B, B beat C, C beat A: mini-table all 1-1, so point diff decides.
	s := []Standing{st("A", 50, 1, 0, 0), st("C", 50, 3, 0, 0), st("B", 50, 2, 0, 0)}
	RankStandings(s, TieBreakerRuleH2H_PCT_PD_PF_PA_NAME, []StandingsResult{
		game("A", "B", 7, 0),
		game("B", "C", 7, 0),
		game("C", "A", 7, 0),
	})
	if got, want := order(s), "C,B,A"; got != want {
		t.Fatalf("got %s, want %s", got, want)
	}
}

func TestRankStandingsRule2NotAllMetSkipsHeadToHead(t *testing.T) {
	// A beat B, but neither has played C: head-to-head is skipped for the
	// whole group and point diff decides.
	s := []Standing{st("A", 50, 1, 0, 0), st("B", 50, 5, 0, 0), st("C", 50, 3, 0, 0)}
	RankStandings(s, TieBreakerRuleH2H_PCT_PD_PF_PA_NAME, []StandingsResult{game("A", "B", 7, 0)})
	if got, want := order(s), "B,C,A"; got != want {
		t.Fatalf("got %s, want %s", got, want)
	}
}

func TestRankStandingsRule2ReappliesToStillLevelTeams(t *testing.T) {
	// Four-way mini-table: A and B are 2-1, C and D are 1-2. Re-applied to
	// each level pair, A beat B and C beat D, overriding point diff.
	s := []Standing{st("B", 50, 9, 0, 0), st("A", 50, 8, 0, 0), st("D", 50, 7, 0, 0), st("C", 50, 6, 0, 0)}
	RankStandings(s, TieBreakerRuleH2H_PCT_PD_PF_PA_NAME, []StandingsResult{
		game("A", "B", 7, 0),
		game("A", "C", 7, 0),
		game("D", "A", 7, 0),
		game("B", "C", 7, 0),
		game("B", "D", 7, 0),
		game("C", "D", 7, 0),
	})
	if got, want := order(s), "A,B,C,D"; got != want {
		t.Fatalf("got %s, want %s", got, want)
	}
}

func TestRankStandingsRule2DrawCountsHalf(t *testing.T) {
	// A and B drew; A beat C, B lost to C. Mini-table: A 1.5/2, C 1/2, B 0.5/2.
	s := []Standing{st("B", 50, 9, 0, 0), st("C", 50, 8, 0, 0), st("A", 50, 1, 0, 0)}
	RankStandings(s, TieBreakerRuleH2H_PCT_PD_PF_PA_NAME, []StandingsResult{
		game("A", "B", 7, 7),
		game("A", "C", 7, 0),
		game("C", "B", 7, 0),
	})
	if got, want := order(s), "A,C,B"; got != want {
		t.Fatalf("got %s, want %s", got, want)
	}
}

func TestIsH2HTieBreakerRule(t *testing.T) {
	for rule, want := range map[string]bool{
		TieBreakerRuleH2H_PCT_PD_PF_PA_NAME: true,
		"rule_2":                            true,
		" Rule 2 ":                          true,
		TieBreakerRulePCT_PD_PF_PA_NAME:     false,
		"":                                  false,
	} {
		if got := IsH2HTieBreakerRule(rule); got != want {
			t.Errorf("IsH2HTieBreakerRule(%q) = %v, want %v", rule, got, want)
		}
	}
}
