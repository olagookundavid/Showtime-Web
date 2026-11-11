package services

import (
	"context"
	"strings"
	"testing"

	"showtime-backend/internal/domain"
)

// Unlike the slot, gender and squad-size rules, the club cap cannot be fixed
// later: a fourth player from an over-subscribed club can never start no
// matter how the rest of the squad changes. So it is the one rule BuyPlayer
// enforces itself, rather than leaving it to the readiness checklist.
func TestBuyPlayerEnforcesClubCap(t *testing.T) {
	newSvc := func(owned []domain.LineupCandidate) (*fakeSquadRepo, IFantasySquadService) {
		repo := newFakeRepo()
		repo.season = &domain.FantasySeason{
			ID: "season-1", Budget: 100, MinFemaleOffense: 3, MinFemaleDefense: 3, MaxPerClub: 3,
		}
		repo.enteredTeam = &domain.FantasyTeam{ID: "team-1", UserID: "user-1", SeasonID: "season-1"}
		squad := &fakeSquadRepo{owned: owned, marketPrice: 5, marketClub: "club-a"}
		return squad, NewFantasySquadService(squad, repo)
	}

	clubAPlayers := func(n int) []domain.LineupCandidate {
		out := make([]domain.LineupCandidate, 0, n)
		for i := 0; i < n; i++ {
			out = append(out, domain.LineupCandidate{PlayerID: "p" + string(rune('1'+i)), TeamID: "club-a", Price: 5})
		}
		return out
	}

	t.Run("a fourth player from the same club is refused", func(t *testing.T) {
		squad, svc := newSvc(clubAPlayers(3))
		_, err := svc.BuyPlayer(context.Background(), "user-1", "season-1", "p-new")
		if err == nil {
			t.Fatal("expected the buy to be refused")
		}
		if !strings.Contains(err.Error(), "3 players from this club") {
			t.Errorf("the refusal should name the cap, got %q", err)
		}
		if squad.bought != 0 {
			t.Errorf("the buy reached the database anyway (%d)", squad.bought)
		}
	})

	t.Run("a third player from the club is allowed", func(t *testing.T) {
		squad, svc := newSvc(clubAPlayers(2))
		if _, err := svc.BuyPlayer(context.Background(), "user-1", "season-1", "p-new"); err != nil {
			t.Fatalf("expected the buy to go through: %v", err)
		}
		if squad.bought != 1 {
			t.Errorf("expected the buy to go through, bought=%d", squad.bought)
		}
	})

	t.Run("the cap does not count other clubs", func(t *testing.T) {
		squad, svc := newSvc([]domain.LineupCandidate{
			{PlayerID: "b1", TeamID: "club-b", Price: 5},
			{PlayerID: "b2", TeamID: "club-b", Price: 5},
			{PlayerID: "b3", TeamID: "club-b", Price: 5},
		})
		if _, err := svc.BuyPlayer(context.Background(), "user-1", "season-1", "p-new"); err != nil {
			t.Fatalf("a different club should not count against the cap: %v", err)
		}
		if squad.bought != 1 {
			t.Errorf("expected the buy to go through, bought=%d", squad.bought)
		}
	})
}
