package broadcast

import (
	"context"
	"showtime-backend/internal/ports"
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

func TestSceneMeetingsOrientsToThisMatch(t *testing.T) {
	meetings := []ports.BroadcastMeeting{
		// Played the same way round as this match.
		{Date: "2026-09-01", HomeTeamID: "h", AwayTeamID: "a", HomeScore: 21, AwayScore: 14},
		// Played the other way round: scores swap so they read home–away for this match.
		{Date: "2026-05-01", HomeTeamID: "a", AwayTeamID: "h", HomeScore: 28, AwayScore: 7},
	}
	got := sceneMeetings("h", meetings)
	if got[0].HomeScore != 21 || got[0].AwayScore != 14 || !got[0].HostedByHome {
		t.Errorf("same-way meeting: got %+v", got[0])
	}
	if got[1].HomeScore != 7 || got[1].AwayScore != 28 || got[1].HostedByHome {
		t.Errorf("reversed meeting should swap scores: got %+v", got[1])
	}
}
