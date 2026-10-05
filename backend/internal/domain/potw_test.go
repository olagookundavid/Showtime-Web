package domain

import (
	"testing"
	"time"
)

func TestPickPOTWWinner(t *testing.T) {
	cases := []struct {
		name     string
		nominees []POTWNominee
		want     string
	}{
		{"no nominees", nil, ""},
		{"nobody voted", []POTWNominee{{PlayerID: "a"}, {PlayerID: "b"}}, ""},
		{"most votes wins", []POTWNominee{
			{PlayerID: "a", Votes: 3, Rating: 9.9},
			{PlayerID: "b", Votes: 5, Rating: 7.0},
		}, "b"},
		{"tie goes to higher rating", []POTWNominee{
			{PlayerID: "a", Votes: 4, Rating: 8.1, DisplayOrder: 0},
			{PlayerID: "b", Votes: 4, Rating: 9.2, DisplayOrder: 1},
		}, "b"},
		{"tie on votes and rating goes to admin order", []POTWNominee{
			{PlayerID: "a", Votes: 4, Rating: 9.0, DisplayOrder: 2},
			{PlayerID: "b", Votes: 4, Rating: 9.0, DisplayOrder: 1},
		}, "b"},
		{"a zero-vote nominee never wins on rating", []POTWNominee{
			{PlayerID: "a", Votes: 0, Rating: 9.9},
			{PlayerID: "b", Votes: 1, Rating: 6.0},
		}, "b"},
	}
	for _, tc := range cases {
		if got := PickPOTWWinner(tc.nominees); got != tc.want {
			t.Errorf("%s: got %q, want %q", tc.name, got, tc.want)
		}
	}
}

func TestPOTWPollStatus(t *testing.T) {
	now := time.Date(2026, 10, 5, 12, 0, 0, 0, time.UTC)
	p := POTWPoll{OpensAt: now.Add(-time.Hour), ClosesAt: now.Add(time.Hour)}
	if got := p.Status(now.Add(-2 * time.Hour)); got != POTWPollScheduled {
		t.Errorf("before opening: got %s", got)
	}
	if got := p.Status(now); got != POTWPollOpen {
		t.Errorf("while open: got %s", got)
	}
	if got := p.Status(now.Add(time.Hour)); got != POTWPollClosed {
		t.Errorf("at the deadline: got %s", got)
	}
}
