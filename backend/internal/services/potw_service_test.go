package services

import (
	"testing"
	"time"

	"showtime-backend/internal/domain"
)

func TestPOTWMapPollHidesCountsFromFans(t *testing.T) {
	now := time.Date(2026, 10, 8, 12, 0, 0, 0, time.UTC)
	winner, source := "a", domain.POTWWinnerByVote
	poll := &domain.POTWPoll{
		ID:             "p",
		OpensAt:        now.Add(-48 * time.Hour),
		ClosesAt:       now.Add(-time.Hour),
		WinnerPlayerID: &winner,
		WinnerSource:   &source,
		TotalVotes:     4,
		Nominees: []domain.POTWNominee{
			{PlayerID: "a", Votes: 3},
			{PlayerID: "b", Votes: 1},
		},
		VotesByDay: []domain.POTWDayCount{{Day: now, Votes: 4}},
	}
	s := &POTWService{now: func() time.Time { return now }}

	// Fans after the deadline: shares and the winner, nothing countable.
	fan := s.mapPoll(poll, true, false)
	if fan.TotalVotes != 0 || fan.VotesByDay != nil {
		t.Errorf("fans got counts: total=%d byDay=%v", fan.TotalVotes, fan.VotesByDay)
	}
	for _, n := range fan.Nominees {
		if n.Votes != nil {
			t.Errorf("fans got a vote count for %s", n.PlayerID)
		}
		if n.Percent == nil {
			t.Errorf("fans got no share for %s", n.PlayerID)
		}
	}
	if *fan.Nominees[0].Percent != 75 || !fan.Nominees[0].IsWinner {
		t.Errorf("winner share/flag wrong: %+v", fan.Nominees[0])
	}

	// Admins: everything.
	admin := s.mapPoll(poll, true, true)
	if admin.TotalVotes != 4 || len(admin.VotesByDay) != 1 || admin.Nominees[0].Votes == nil || *admin.Nominees[0].Votes != 3 {
		t.Errorf("admin missing counts: %+v", admin)
	}

	// Fans while voting is open: no shares either.
	poll.ClosesAt = now.Add(time.Hour)
	open := s.mapPoll(poll, false, false)
	if open.Nominees[0].Percent != nil || open.TotalVotes != 0 {
		t.Errorf("open poll leaked results: %+v", open.Nominees[0])
	}
}
