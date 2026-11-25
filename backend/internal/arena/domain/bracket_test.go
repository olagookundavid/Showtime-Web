package domain

import "testing"

func TestPlanBracket(t *testing.T) {
	ranked := []string{"a", "b", "c", "d", "e"}

	semis, err := PlanBracket(4, ranked)
	if err != nil {
		t.Fatal(err)
	}
	if len(semis) != 3 {
		t.Fatalf("4 spots should plan 3 matches, got %d", len(semis))
	}
	if semis[0].HomeClubID != "a" || semis[0].AwayClubID != "d" || semis[1].HomeClubID != "b" || semis[1].AwayClubID != "c" {
		t.Errorf("semis should be 1v4 and 2v3, got %+v", semis[:2])
	}
	if semis[0].FeedsKey != "final" || semis[0].FeedsSlot != "home" || semis[1].FeedsSlot != "away" {
		t.Errorf("semi winners should feed the final's home and away: %+v", semis[:2])
	}
	if semis[2].Stage != StageFinal || semis[2].HomeClubID != "" || semis[2].AwayClubID != "" {
		t.Errorf("the final starts empty: %+v", semis[2])
	}

	final, err := PlanBracket(2, ranked)
	if err != nil || len(final) != 1 || final[0].HomeClubID != "a" || final[0].AwayClubID != "b" {
		t.Errorf("2 spots is a straight 1v2 final, got %+v, %v", final, err)
	}

	if _, err := PlanBracket(0, ranked); err == nil {
		t.Error("0 spots should refuse")
	}
	if _, err := PlanBracket(4, ranked[:3]); err == nil {
		t.Error("4 spots with 3 clubs should refuse")
	}
	if _, err := PlanBracket(2, ranked[:1]); err == nil {
		t.Error("a final with 1 club should refuse")
	}
	if _, err := PlanBracket(8, ranked); err == nil {
		t.Error("unsupported spot counts should refuse")
	}
}

func TestKnockoutWinner(t *testing.T) {
	m := func(hs, as int, pen string) Match {
		x := Match{Status: MatchCompleted, HomeClubID: sp("h"), AwayClubID: sp("a"), HomeScore: ip(hs), AwayScore: ip(as)}
		if pen != "" {
			x.PenaltyWinner = sp(pen)
		}
		return x
	}
	cases := []struct {
		name string
		m    Match
		want string
		err  bool
	}{
		{"home wins", m(2, 1, ""), "h", false},
		{"away wins", m(0, 3, ""), "a", false},
		{"level, home on pens", m(1, 1, "home"), "h", false},
		{"level, away on pens", m(1, 1, "away"), "a", false},
		{"level, no pens", m(1, 1, ""), "", true},
		{"pens ignored when decisive", m(2, 0, "away"), "h", false},
		{"not played", Match{Status: MatchScheduled, HomeClubID: sp("h"), AwayClubID: sp("a")}, "", true},
	}
	for _, c := range cases {
		got, err := KnockoutWinner(c.m)
		if (err != nil) != c.err || got != c.want {
			t.Errorf("%s: got %q, %v; want %q (err=%v)", c.name, got, err, c.want, c.err)
		}
	}
}
