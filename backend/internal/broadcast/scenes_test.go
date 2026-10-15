package broadcast

import (
	"context"
	"testing"
)

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
