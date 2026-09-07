package services

import (
	"context"
	"strings"
	"testing"

	"showtime-backend/internal/domain"
)

// The transfer market is open before a match day and after it, never during.
//
// This is what keeps points honest. Without it a manager can watch a player have
// a bad game and sell them before the gameweek is scored, so the damage never
// lands — or watch one score and cash out at a price that has not caught up. The
// team sheet is submitted at the deadline, and the team sheet is what plays.
func TestTradingWindow(t *testing.T) {
	newSvc := func(status domain.GameweekStatus) (*fakeSquadRepo, IFantasySquadService) {
		repo := newFakeRepo()
		repo.season = &domain.FantasySeason{
			ID: "season-1", Budget: 100, MinFemaleOffense: 3, MinFemaleDefense: 3, MaxPerClub: 4,
		}
		repo.enteredTeam = &domain.FantasyTeam{ID: "team-1", UserID: "user-1", SeasonID: "season-1"}
		if status != "" {
			repo.currentGW = &domain.FantasyGameweek{ID: "gw-3", SeasonID: "season-1", Number: 3, Status: status}
		}
		squad := &fakeSquadRepo{owned: []domain.LineupCandidate{
			{PlayerID: "p1", Name: "Ada Musa", Position: "Rusher", Gender: "FEMALE", Price: 5},
		}}
		return squad, NewFantasySquadService(squad, repo)
	}

	t.Run("a match day in progress closes the market", func(t *testing.T) {
		for _, status := range []domain.GameweekStatus{domain.GameweekLocked, domain.GameweekLive} {
			squad, svc := newSvc(status)

			_, err := svc.SellPlayer(context.Background(), "user-1", "season-1", "p1")
			if err == nil {
				t.Fatalf("%s: expected the sale to be refused", status)
			}
			if !strings.Contains(err.Error(), "gameweek 3") {
				t.Errorf("%s: the refusal should name the gameweek, got %q", status, err)
			}
			if squad.sold != 0 {
				t.Errorf("%s: the sale reached the database anyway (%d)", status, squad.sold)
			}

			if _, err = svc.BuyPlayer(context.Background(), "user-1", "season-1", "p9"); err == nil {
				t.Fatalf("%s: expected the purchase to be refused", status)
			}
			if squad.bought != 0 {
				t.Errorf("%s: the purchase reached the database anyway (%d)", status, squad.bought)
			}
		}
	})

	t.Run("trading reopens once the scores are final", func(t *testing.T) {
		squad, svc := newSvc(domain.GameweekFinalized)
		if _, err := svc.SellPlayer(context.Background(), "user-1", "season-1", "p1"); err != nil {
			t.Fatalf("selling after the whistle should be allowed: %v", err)
		}
		if squad.sold != 1 {
			t.Errorf("expected the sale to go through, sold=%d", squad.sold)
		}
	})

	t.Run("trading is open before the deadline", func(t *testing.T) {
		squad, svc := newSvc(domain.GameweekScheduled)
		if _, err := svc.SellPlayer(context.Background(), "user-1", "season-1", "p1"); err != nil {
			t.Fatalf("selling before the deadline should be allowed: %v", err)
		}
		if squad.sold != 1 {
			t.Errorf("expected the sale to go through, sold=%d", squad.sold)
		}
	})

	// The dashboard greys out Buy and Sell from this, so it has to agree with the
	// guard rather than being worked out separately in the UI.
	t.Run("the squad response reports the window", func(t *testing.T) {
		_, svc := newSvc(domain.GameweekLocked)
		res, err := svc.GetSquad(context.Background(), "user-1", "season-1")
		if err != nil {
			t.Fatal(err)
		}
		if res.MarketOpen {
			t.Error("market_open should be false while a gameweek is being played")
		}
		if !strings.Contains(res.MarketClosedReason, "gameweek 3") {
			t.Errorf("the reason should name the gameweek, got %q", res.MarketClosedReason)
		}

		_, open := newSvc(domain.GameweekScheduled)
		res, err = open.GetSquad(context.Background(), "user-1", "season-1")
		if err != nil {
			t.Fatal(err)
		}
		if !res.MarketOpen || res.MarketClosedReason != "" {
			t.Errorf("market should be open before the deadline, got open=%v reason=%q",
				res.MarketOpen, res.MarketClosedReason)
		}
	})

	// A season with no gameweeks yet must not be treated as mid-match-day, or
	// nobody could build a squad before the fixtures are published.
	t.Run("no gameweek yet leaves the market open", func(t *testing.T) {
		squad, svc := newSvc("")
		if _, err := svc.SellPlayer(context.Background(), "user-1", "season-1", "p1"); err != nil {
			t.Fatalf("expected trading before any gameweek exists: %v", err)
		}
		if squad.sold != 1 {
			t.Errorf("expected the sale to go through, sold=%d", squad.sold)
		}
	})
}
