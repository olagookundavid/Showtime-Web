package services

import (
	"testing"
	"time"

	"showtime-backend/internal/ports"
)

func TestCanIssuePlayerTicketsUntilTheMatchDayEndsInLagos(t *testing.T) {
	day := time.Date(2026, 11, 7, 0, 0, 0, 0, time.UTC)
	cases := []struct {
		name   string
		status string
		now    time.Time
		want   bool
	}{
		{"day before", "SCHEDULED", time.Date(2026, 11, 6, 12, 0, 0, 0, time.UTC), true},
		{"on the day", "SCHEDULED", time.Date(2026, 11, 7, 20, 0, 0, 0, time.UTC), true},
		// 23:30 UTC on the 7th is already the 8th in Lagos.
		{"after midnight in Lagos", "SCHEDULED", time.Date(2026, 11, 7, 23, 30, 0, 0, time.UTC), false},
		{"finished", "FINISHED", time.Date(2026, 11, 6, 12, 0, 0, 0, time.UTC), false},
		{"cancelled", "CANCELLED", time.Date(2026, 11, 6, 12, 0, 0, 0, time.UTC), false},
		{"postponed still takes tickets", "POSTPONED", time.Date(2026, 11, 6, 12, 0, 0, 0, time.UTC), true},
	}
	for _, c := range cases {
		m := &ports.PlayerTicketMatch{Date: day, Status: c.status}
		if got := canIssuePlayerTickets(m, c.now); got != c.want {
			t.Errorf("%s: got %v, want %v", c.name, got, c.want)
		}
	}
}

func TestTeamSideNamesTheOpponent(t *testing.T) {
	m := &ports.PlayerTicketMatch{HomeTeamID: "h", HomeTeam: "Lions", AwayTeamID: "a", AwayTeam: "Eagles"}
	if team, opp, ok := teamSide(m, "a"); !ok || team != "Eagles" || opp != "Lions" {
		t.Errorf("away side = %q %q %v", team, opp, ok)
	}
	if _, _, ok := teamSide(m, "x"); ok {
		t.Error("a team not in the match should not have a side")
	}
	if _, _, ok := teamSide(&ports.PlayerTicketMatch{}, ""); ok {
		t.Error("an empty team id matched a match with no teams")
	}
}
