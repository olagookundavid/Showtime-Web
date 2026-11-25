package domain

import "testing"

func ip(n int) *int       { return &n }
func sp(s string) *string { return &s }

func league(home, away string, hs, as int) Match {
	return Match{Stage: StageLeague, Status: MatchCompleted, HomeClubID: sp(home), AwayClubID: sp(away), HomeScore: ip(hs), AwayScore: ip(as)}
}

func TestComputeStandings(t *testing.T) {
	clubs := []ClubRef{{ID: "a", Name: "Alpha"}, {ID: "b", Name: "Bravo"}, {ID: "c", Name: "Charlie"}, {ID: "d", Name: "Delta"}}
	matches := []Match{
		league("a", "b", 3, 1),
		league("c", "d", 2, 2),
		league("a", "c", 0, 0),
		league("b", "d", 4, 0),
		// Not counted: unplayed, a playoff match, and a club outside the division.
		{Stage: StageLeague, Status: MatchScheduled, HomeClubID: sp("a"), AwayClubID: sp("d")},
		{Stage: StageSemi, Status: MatchCompleted, HomeClubID: sp("a"), AwayClubID: sp("b"), HomeScore: ip(5), AwayScore: ip(0)},
		league("a", "zz", 9, 0),
	}
	got := ComputeStandings(clubs, matches)

	want := []struct {
		id      string
		pts, gd int
		played  int
		form    string
		rank    int
	}{
		{"a", 4, 2, 2, "WD", 1},
		{"b", 3, 2, 2, "LW", 2}, // b: 3 pts, GD +2 (1-3, 4-0) ties a on GD but trails on points
		{"c", 2, 0, 2, "DD", 3},
		{"d", 1, -4, 2, "DL", 4},
	}
	if len(got) != len(want) {
		t.Fatalf("got %d rows, want %d", len(got), len(want))
	}
	for i, w := range want {
		r := got[i]
		if r.Club.ID != w.id || r.Points != w.pts || r.GD != w.gd || r.Played != w.played || r.Form != w.form || r.Rank != w.rank {
			t.Errorf("row %d = %+v, want %+v", i, r, w)
		}
	}
}

func TestComputeStandingsTiebreakers(t *testing.T) {
	// a, b and c all finish on 3 points, so goal difference separates them
	// (+2, +1, -1). d has none.
	clubs := []ClubRef{{ID: "a", Name: "Zulu"}, {ID: "b", Name: "Yankee"}, {ID: "c", Name: "X-ray"}, {ID: "d", Name: "Whiskey"}}
	matches := []Match{
		league("a", "c", 2, 0),
		league("b", "d", 1, 0),
		league("c", "d", 5, 4),
	}
	got := ComputeStandings(clubs, matches)
	order := []string{"a", "b", "c", "d"}
	for i, id := range order {
		if got[i].Club.ID != id {
			t.Fatalf("position %d = %s, want %s (table %+v)", i+1, got[i].Club.ID, id, got)
		}
	}

	// e and f are level on points (3) and goal difference (+1); e has scored more.
	clubs = []ClubRef{{ID: "f", Name: "Aardvark"}, {ID: "e", Name: "Zebra"}, {ID: "x", Name: "X"}, {ID: "y", Name: "Y"}}
	got = ComputeStandings(clubs, []Match{league("e", "x", 3, 2), league("f", "y", 1, 0)})
	if got[0].Club.ID != "e" || got[1].Club.ID != "f" {
		t.Fatalf("goals scored should break the tie, got %s then %s", got[0].Club.ID, got[1].Club.ID)
	}
}

func TestComputeStandingsNameTiebreakAndFormCap(t *testing.T) {
	clubs := []ClubRef{{ID: "a", Name: "Beta"}, {ID: "b", Name: "Alpha"}}
	got := ComputeStandings(clubs, nil)
	if got[0].Club.Name != "Alpha" || got[0].Rank != 1 || got[1].Rank != 2 {
		t.Fatalf("empty table should order by name: %+v", got)
	}

	var ms []Match
	for i := 0; i < 7; i++ {
		ms = append(ms, league("a", "b", 1, 0))
	}
	ms = append(ms, league("a", "b", 0, 1))
	g := ComputeStandings(clubs, ms)
	for _, r := range g {
		if r.Club.ID == "a" && r.Form != "WWWWL" {
			t.Errorf("form capped to last five, got %q", r.Form)
		}
	}
}
