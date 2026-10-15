package broadcast

import (
	"context"
	"testing"

	"showtime-backend/internal/domain"
)

func factByLabel(facts []SceneFact, label string) SceneFact {
	for _, f := range facts {
		if f.Label == label {
			return f
		}
	}
	return SceneFact{}
}

func TestSceneFacts(t *testing.T) {
	players := []domain.AggregatedPlayerStat{
		// Home QB throws 2 TDs on 4 of 5; the receivers score them.
		{PlayerID: "qb", TeamID: "home", PassingAttempts: 5, CompletedPasses: 4, PassingTDs: 2},
		{PlayerID: "wr-m", TeamID: "home", ReceivingTDs: 1},
		{PlayerID: "wr-f", TeamID: "home", ReceivingTDs: 1, RushingTDs: 1},
		{PlayerID: "def", TeamID: "home", FlagPulls: 3, PassDeflections: 2, Interceptions: 1},
		// Away: a defensive TD and no passing.
		{PlayerID: "away-def", TeamID: "away", DefensiveTDs: 1, FlagPulls: 5},
		// A player from neither side is ignored.
		{PlayerID: "stray", TeamID: "other", ReceivingTDs: 9},
	}
	teams := []domain.TeamMatchStat{
		{TeamID: "home", TotalPlays: 20, Penalties: 2},
		{TeamID: "away", TotalPlays: 18, Penalties: 4},
	}
	facts := sceneFacts("home", "away", players, teams, map[string]bool{"wr-f": true})

	cases := []struct {
		label      string
		home, away float64
	}{
		{"Total Plays", 20, 18},
		{"Touchdowns", 3, 1}, // passing TDs are not counted again
		{"Female Touchdowns", 2, 0},
		{"Completion Rate", 80, 0}, // no attempts = 0, not NaN
		{"Flag Pulls", 3, 5},
		{"Interceptions", 1, 0},
		{"Bat Downs", 2, 0},
		{"Infractions", 2, 4},
	}
	if len(facts) != len(cases) {
		t.Fatalf("expected %d facts, got %d", len(cases), len(facts))
	}
	for _, c := range cases {
		f := factByLabel(facts, c.label)
		if f.Home != c.home || f.Away != c.away {
			t.Errorf("%s: got %v–%v, want %v–%v", c.label, f.Home, f.Away, c.home, c.away)
		}
	}
	if factByLabel(facts, "Completion Rate").Unit != "%" {
		t.Errorf("completion rate should be marked as a percentage")
	}
}

func TestStageLabel(t *testing.T) {
	cases := map[[2]string]string{
		{"SEASON", ""}:        "Regular Season",
		{"PLAYOFFS", ""}:      "Playoffs",
		{"CUP", ""}:           "Cup",
		{"PRESEASON", ""}:     "Preseason",
		{"PLAYOFFS", "Final"}: "Final",
	}
	for in, want := range cases {
		if got := stageLabel(in[0], in[1]); got != want {
			t.Errorf("stageLabel(%q, %q) = %q, want %q", in[0], in[1], got, want)
		}
	}
}

func TestSetDayOnAirClearsScene(t *testing.T) {
	hub := NewHub(nil)
	defer closeHub(t, hub)
	hub.SetState(&BroadcastState{MatchID: "m1", Scene: "lineup", LineupIntro: &LineupIntro{Cursor: 3}})
	if err := hub.SetDayOnAir(context.Background(), "2026-10-18", "m1"); err != nil {
		t.Fatal(err)
	}
	got, _ := hub.GetState("m1")
	if got.Scene != "" || got.LineupIntro != nil {
		t.Errorf("expected the scene cleared on switching, got scene %q intro %+v", got.Scene, got.LineupIntro)
	}
}
