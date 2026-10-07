package services

import (
	"fmt"
	"showtime-backend/internal/domain"
	"testing"
	"time"
)

func TestGenerateRound1Pairings(t *testing.T) {
	teams := make([]string, 10)
	for i := 0; i < 10; i++ {
		teams[i] = fmt.Sprintf("team_%d", i+1)
	}

	pairings, err := GenerateRound1Pairings(teams)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(pairings) != 5 {
		t.Fatalf("expected 5 pairings, got %d", len(pairings))
	}

	seen := make(map[string]bool)
	for _, p := range pairings {
		if p.HomeTeamID == p.AwayTeamID {
			t.Errorf("team cannot play itself: %s", p.HomeTeamID)
		}
		if seen[p.HomeTeamID] {
			t.Errorf("duplicate team in pairing: %s", p.HomeTeamID)
		}
		if seen[p.AwayTeamID] {
			t.Errorf("duplicate team in pairing: %s", p.AwayTeamID)
		}
		seen[p.HomeTeamID] = true
		seen[p.AwayTeamID] = true
	}
	if len(seen) != 10 {
		t.Errorf("expected 10 unique teams, got %d", len(seen))
	}

	// Negative test: not 10 teams
	_, err = GenerateRound1Pairings([]string{"t1", "t2"})
	if err == nil {
		t.Errorf("expected error with fewer than 10 teams")
	}
}

func TestGenerateSwissRoundPairings_NoPreviousMatchups(t *testing.T) {
	standings := make([]domain.Standing, 10)
	for i := 0; i < 10; i++ {
		standings[i] = domain.Standing{
			TeamID:   fmt.Sprintf("team_%d", i+1),
			Position: i + 1,
		}
	}

	pastMatchups := make(map[string]map[string]bool)
	pairings, err := GenerateSwissRoundPairings(standings, pastMatchups)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Without previous matchups, pairings must be strictly adjacent:
	// 1v2, 3v4, 5v6, 7v8, 9v10
	expected := [][2]string{
		{"team_1", "team_2"},
		{"team_3", "team_4"},
		{"team_5", "team_6"},
		{"team_7", "team_8"},
		{"team_9", "team_10"},
	}

	for i, exp := range expected {
		if pairings[i].HomeTeamID != exp[0] || pairings[i].AwayTeamID != exp[1] {
			t.Errorf("pairing %d mismatch: got %s v %s, want %s v %s",
				i, pairings[i].HomeTeamID, pairings[i].AwayTeamID, exp[0], exp[1])
		}
	}
}

func TestGenerateSwissRoundPairings_AvoidRematch(t *testing.T) {
	standings := make([]domain.Standing, 10)
	for i := 0; i < 10; i++ {
		standings[i] = domain.Standing{
			TeamID:   fmt.Sprintf("team_%d", i+1),
			Position: i + 1,
		}
	}

	// Team 1 and Team 2 already played in Round 1
	pastMatchups := map[string]map[string]bool{
		"team_1": {"team_2": true},
		"team_2": {"team_1": true},
	}

	pairings, err := GenerateSwissRoundPairings(standings, pastMatchups)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify that team_1 does NOT play team_2
	for _, p := range pairings {
		if (p.HomeTeamID == "team_1" && p.AwayTeamID == "team_2") ||
			(p.HomeTeamID == "team_2" && p.AwayTeamID == "team_1") {
			t.Errorf("rematch occurred between team_1 and team_2!")
		}
	}

	// Cheapest swap is 1v3 + 2v4 (cost 8; 1v4 + 2v3 costs 10). The rest stay adjacent.
	expected := [][2]string{
		{"team_1", "team_3"},
		{"team_2", "team_4"},
		{"team_5", "team_6"},
		{"team_7", "team_8"},
		{"team_9", "team_10"},
	}
	if len(pairings) != len(expected) {
		t.Fatalf("expected %d pairings, got %d", len(expected), len(pairings))
	}
	for i, exp := range expected {
		if pairings[i].HomeTeamID != exp[0] || pairings[i].AwayTeamID != exp[1] {
			t.Errorf("pairing %d mismatch: got %s v %s, want %s v %s",
				i, pairings[i].HomeTeamID, pairings[i].AwayTeamID, exp[0], exp[1])
		}
	}
}

func TestGenerateSwissRoundPairings_Round3Simulation(t *testing.T) {
	standings := make([]domain.Standing, 10)
	for i := 0; i < 10; i++ {
		standings[i] = domain.Standing{
			TeamID:   fmt.Sprintf("team_%d", i+1),
			Position: i + 1,
		}
	}

	// R1 played: 1v2, 3v4, 5v6, 7v8, 9v10
	// R2 played: 1v3, 2v4, 5v7, 6v9, 8v10
	pastMatchups := make(map[string]map[string]bool)
	markPast := func(a, b string) {
		if pastMatchups[a] == nil {
			pastMatchups[a] = make(map[string]bool)
		}
		if pastMatchups[b] == nil {
			pastMatchups[b] = make(map[string]bool)
		}
		pastMatchups[a][b] = true
		pastMatchups[b][a] = true
	}

	markPast("team_1", "team_2")
	markPast("team_3", "team_4")
	markPast("team_5", "team_6")
	markPast("team_7", "team_8")
	markPast("team_9", "team_10")

	markPast("team_1", "team_3")
	markPast("team_2", "team_4")
	markPast("team_5", "team_7")
	markPast("team_6", "team_9")
	markPast("team_8", "team_10")

	pairings, err := GenerateSwissRoundPairings(standings, pastMatchups)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(pairings) != 5 {
		t.Fatalf("expected 5 pairings, got %d", len(pairings))
	}

	seen := make(map[string]bool)
	for _, p := range pairings {
		if pastMatchups[p.HomeTeamID][p.AwayTeamID] {
			t.Errorf("rematch detected in R3: %s vs %s", p.HomeTeamID, p.AwayTeamID)
		}
		seen[p.HomeTeamID] = true
		seen[p.AwayTeamID] = true
	}
	if len(seen) != 10 {
		t.Errorf("expected 10 unique teams in R3 pairings, got %d", len(seen))
	}
}

func TestGenerateQuarterfinalPairings(t *testing.T) {
	standings := make([]domain.Standing, 10)
	for i := 0; i < 10; i++ {
		standings[i] = domain.Standing{
			TeamID:   fmt.Sprintf("team_%d", i+1),
			Position: i + 1,
		}
	}

	qf, err := GenerateQuarterfinalPairings(standings)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(qf) != 4 {
		t.Fatalf("expected 4 QF matches, got %d", len(qf))
	}

	// QF1: 1 vs 5
	// QF2: 2 vs 6
	// QF3: 3 vs 7
	// QF4: 4 vs 8
	expected := [][2]string{
		{"team_1", "team_5"},
		{"team_2", "team_6"},
		{"team_3", "team_7"},
		{"team_4", "team_8"},
	}

	for i, exp := range expected {
		if qf[i].HomeTeamID != exp[0] || qf[i].AwayTeamID != exp[1] {
			t.Errorf("QF %d mismatch: got %s v %s, want %s v %s",
				i+1, qf[i].HomeTeamID, qf[i].AwayTeamID, exp[0], exp[1])
		}
	}
}

func TestCupKnockoutMatches(t *testing.T) {
	qf := []MatchupPair{
		{HomeTeamID: "s1", AwayTeamID: "s5"},
		{HomeTeamID: "s2", AwayTeamID: "s6"},
		{HomeTeamID: "s3", AwayTeamID: "s7"},
		{HomeTeamID: "s4", AwayTeamID: "s8"},
	}
	day := time.Date(2026, 10, 10, 0, 0, 0, 0, time.UTC)
	matches := cupKnockoutMatches("comp", qf, day, day, "Venue")
	if len(matches) != 7 {
		t.Fatalf("expected 7 knockout matches, got %d", len(matches))
	}

	// Give each match the ID the repo would, in insert order, then check the
	// feed pointers resolve to the right parent.
	for i, m := range matches {
		m.ID = fmt.Sprintf("m%d", i)
	}
	byRound := map[string][]*domain.Match{}
	for _, m := range matches {
		byRound[m.Round] = append(byRound[m.Round], m)
	}
	final, sfs, qfs := byRound[domain.CupRoundFinal], byRound[domain.CupRoundSF], byRound[domain.CupRoundQF]
	if len(final) != 1 || len(sfs) != 2 || len(qfs) != 4 {
		t.Fatalf("got %d finals, %d semis, %d quarters", len(final), len(sfs), len(qfs))
	}
	if final[0].FeedsMatchID != nil {
		t.Errorf("the Final must not feed another match")
	}
	for _, sf := range sfs {
		if sf.FeedsMatchID == nil || *sf.FeedsMatchID != final[0].ID {
			t.Errorf("SF %d does not feed the Final", *sf.BracketPos)
		}
	}

	// Top to bottom: 1v5 and 4v8 into SF1, 2v6 and 3v7 into SF2.
	want := []struct {
		home, away, sf, slot string
	}{
		{"s1", "s5", sfs[0].ID, "HOME"},
		{"s4", "s8", sfs[0].ID, "AWAY"},
		{"s2", "s6", sfs[1].ID, "HOME"},
		{"s3", "s7", sfs[1].ID, "AWAY"},
	}
	for i, w := range want {
		m := qfs[i]
		if *m.BracketPos != i+1 {
			t.Errorf("QF %d has bracket_pos %d", i+1, *m.BracketPos)
		}
		if m.HomeTeamID != w.home || m.AwayTeamID != w.away {
			t.Errorf("QF %d: got %s v %s, want %s v %s", i+1, m.HomeTeamID, m.AwayTeamID, w.home, w.away)
		}
		if m.FeedsMatchID == nil || *m.FeedsMatchID != w.sf || m.FeedsSlot != w.slot {
			t.Errorf("QF %d feeds the wrong semifinal slot", i+1)
		}
	}
	if !qfs[0].Date.Equal(day) || !sfs[0].Date.Equal(day.AddDate(0, 0, 7)) || !final[0].Date.Equal(day.AddDate(0, 0, 14)) {
		t.Errorf("knockout dates should be the QF day, +7 and +14 days")
	}
}
