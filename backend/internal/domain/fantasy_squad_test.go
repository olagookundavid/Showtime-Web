package domain

import (
	"strings"
	"testing"
)

// legalSquad builds the smallest squad that can field a lineup: one male QB,
// one female QB, five receivers, a rusher and six defenders, with enough women
// on each unit to satisfy the default quotas.
func legalSquad() []SquadPlayer {
	mk := func(id, pos, gender, club string) SquadPlayer {
		return SquadPlayer{
			PlayerID: id, Name: id, Position: pos, Gender: gender,
			ClubID: club, PurchasePrice: 10, CurrentPrice: 10,
		}
	}
	return []SquadPlayer{
		mk("qbm", "QB", "M", "c1"),
		mk("qbf", "QB", "F", "c2"),
		mk("rec1", "Receiver", "F", "c1"),
		mk("rec2", "Receiver", "M", "c2"),
		mk("rec3", "Receiver", "M", "c3"),
		mk("rec4", "Receiver", "M", "c4"),
		mk("rec5", "Center", "M", "c5"),
		mk("rush", "Rusher", "M", "c1"),
		mk("def1", "Defender", "F", "c2"),
		mk("def2", "Defender", "M", "c3"),
		mk("def3", "Defender", "M", "c4"),
		mk("def4", "Defender", "M", "c5"),
		mk("def5", "Defender", "M", "c6"),
		mk("def6", "Defender", "M", "c6"),
	}
}

var squadRules = LineupRules{MinFemaleOffense: 1, MinFemaleDefense: 1, MaxPerClub: 4}

func withoutPlayer(squad []SquadPlayer, id string) []SquadPlayer {
	out := make([]SquadPlayer, 0, len(squad))
	for _, p := range squad {
		if p.PlayerID != id {
			out = append(out, p)
		}
	}
	return out
}

func TestCanFieldLineup(t *testing.T) {
	t.Run("a minimal legal squad can field a lineup", func(t *testing.T) {
		if err := CanFieldLineup(legalSquad(), squadRules); err != nil {
			t.Fatalf("expected a legal squad to be playable, got %v", err)
		}
	})

	// The whole point of the check: a squad can be the right size and still be
	// unplayable. Selling the only female QB has to be refused at the till, not
	// discovered at the deadline.
	t.Run("selling the only female QB is caught", func(t *testing.T) {
		squad := append(withoutPlayer(legalSquad(), "qbf"),
			SquadPlayer{PlayerID: "extra", Name: "extra", Position: "Defender", Gender: "M", ClubID: "c7"})
		err := CanFieldLineup(squad, squadRules)
		if err == nil {
			t.Fatal("expected a squad with no female QB to be rejected")
		}
		t.Logf("refusal reads: %v", err)
	})

	t.Run("dropping below the minimum is caught", func(t *testing.T) {
		if err := CanFieldLineup(withoutPlayer(legalSquad(), "def6"), squadRules); err == nil {
			t.Fatal("expected a 13-player squad to be rejected")
		}
	})

	t.Run("a squad short of receivers is rejected", func(t *testing.T) {
		squad := legalSquad()
		// Turning a receiver into a QB leaves only four players who can fill the
		// five receiver slots.
		for i := range squad {
			if squad[i].PlayerID == "rec1" {
				squad[i].Position = "QB"
			}
		}
		if err := CanFieldLineup(squad, squadRules); err == nil {
			t.Fatal("expected a squad short of receivers to be rejected")
		}
	})

	t.Run("gender quotas are enforced across the whole lineup", func(t *testing.T) {
		squad := legalSquad()
		// Replace the only female defender with a man: the defensive quota can
		// no longer be met even though every slot can be filled.
		for i := range squad {
			if squad[i].PlayerID == "def1" {
				squad[i].Gender = "M"
			}
		}
		if err := CanFieldLineup(squad, squadRules); err == nil {
			t.Fatal("expected the defensive female quota to be enforced")
		}
	})

	t.Run("a full squad with cover is playable", func(t *testing.T) {
		squad := legalSquad()
		for _, extra := range []SquadPlayer{
			{PlayerID: "s1", Position: "Receiver", Gender: "F", ClubID: "c7", CurrentPrice: 9},
			{PlayerID: "s2", Position: "Defender", Gender: "M", ClubID: "c7", CurrentPrice: 9},
			{PlayerID: "s3", Position: "QB", Gender: "M", ClubID: "c8", CurrentPrice: 9},
			{PlayerID: "s4", Position: "Rusher", Gender: "F", ClubID: "c8", CurrentPrice: 9},
			{PlayerID: "s5", Position: "Defender", Gender: "F", ClubID: "c8", CurrentPrice: 9},
		} {
			squad = append(squad, extra)
		}
		if len(squad) != SquadMax {
			t.Fatalf("expected a %d-player squad, built %d", SquadMax, len(squad))
		}
		if err := CanFieldLineup(squad, squadRules); err != nil {
			t.Fatalf("expected a full squad to be playable, got %v", err)
		}
	})
}

func TestValidateSquad(t *testing.T) {
	t.Run("rejects a squad over the maximum", func(t *testing.T) {
		squad := make([]SquadPlayer, SquadMax+1)
		if err := ValidateSquad(squad, 0, squadRules); err == nil {
			t.Errorf("expected more than %d players to be rejected", SquadMax)
		}
	})

	t.Run("rejects an overspend", func(t *testing.T) {
		if err := ValidateSquad(legalSquad(), -5, squadRules); err == nil {
			t.Error("expected a negative bank to be rejected")
		}
	})

	// Float drift on summed NUMERIC(10,2) prices must not read as an overspend.
	t.Run("tolerates float dust in the bank", func(t *testing.T) {
		if err := ValidateSquad(legalSquad(), -0.0000001, squadRules); err != nil {
			t.Errorf("expected rounding dust to be tolerated, got %v", err)
		}
	})
}

func TestSellQuote(t *testing.T) {
	t.Run("sells at the current market price, not what was paid", func(t *testing.T) {
		got := SellQuote(SquadPlayer{PurchasePrice: 10, CurrentPrice: 12.5})
		if got != 12.5 {
			t.Errorf("expected the market price 12.50, got %.2f", got)
		}
	})

	t.Run("a missing price falls back to what was paid", func(t *testing.T) {
		got := SellQuote(SquadPlayer{PurchasePrice: 10, CurrentPrice: 0})
		if got != 10 {
			t.Errorf("expected the purchase price when no market price is on file, got %.2f", got)
		}
	})
}

func requirement(r SquadReadiness, key string) (SquadRequirement, bool) {
	for _, req := range r.Requirements {
		if req.Key == key {
			return req, true
		}
	}
	return SquadRequirement{}, false
}

func TestReadiness(t *testing.T) {
	t.Run("a legal squad passes every line", func(t *testing.T) {
		r := Readiness(legalSquad(), squadRules)
		if !r.Ready {
			t.Fatalf("expected a legal squad to be ready, blocker: %s", r.Blocker)
		}
		if r.Forfeits {
			t.Error("a full squad must not be forfeiting")
		}
		for _, req := range r.Requirements {
			if !req.Met {
				t.Errorf("expected %q to be met, have %d need %d", req.Label, req.Have, req.Need)
			}
		}
	})

	// The point of the redesign: an unplayable squad is allowed to exist, and
	// the checklist is what tells the manager about it.
	t.Run("an unplayable squad is reported, not rejected", func(t *testing.T) {
		squad := withoutPlayer(legalSquad(), "qbf")
		r := Readiness(squad, squadRules)
		if r.Ready {
			t.Fatal("a squad with no female QB cannot field a lineup")
		}
		req, ok := requirement(r, "qb_f")
		if !ok {
			t.Fatal("expected a female QB line on the checklist")
		}
		if req.Met || req.Have != 0 || req.Need != 1 {
			t.Errorf("expected the female QB line to be unmet at 0/1, got %d/%d met=%v", req.Have, req.Need, req.Met)
		}
	})

	// Falling below fourteen is legal, and costs the match day.
	t.Run("a short squad forfeits the match day", func(t *testing.T) {
		r := Readiness(legalSquad()[:10], squadRules)
		if !r.Forfeits {
			t.Error("a squad of 10 must be flagged as forfeiting")
		}
		size, _ := requirement(r, "squad_size")
		if size.Have != 10 || size.Need != SquadMin {
			t.Errorf("expected the size line to read 10/%d, got %d/%d", SquadMin, size.Have, size.Need)
		}
	})

	t.Run("the two gender quotas are reported separately", func(t *testing.T) {
		squad := legalSquad()
		for i := range squad {
			if squad[i].PlayerID == "def1" {
				squad[i].Gender = "M" // the only woman on defense becomes a man
			}
		}
		r := Readiness(squad, squadRules)
		off, _ := requirement(r, "female_offense")
		def, _ := requirement(r, "female_defense")
		if !off.Met {
			t.Error("offense still has its women and should stay met")
		}
		if def.Met {
			t.Error("defense lost its only woman and must read unmet")
		}
	})

	// Squad size is deliberately the first thing reported when it is short: no
	// other gap matters until there are fourteen bodies. So this keeps the count
	// at fourteen and removes only the rusher.
	t.Run("the blocker names the missing role once the count is right", func(t *testing.T) {
		squad := append(withoutPlayer(legalSquad(), "rush"),
			SquadPlayer{PlayerID: "filler", Name: "filler", Position: "Defender", Gender: "M", ClubID: "c9"})
		r := Readiness(squad, squadRules)
		if len(squad) != SquadMin {
			t.Fatalf("test setup: expected %d players, built %d", SquadMin, len(squad))
		}
		if r.Blocker == "" {
			t.Fatal("expected a blocker on an unplayable squad")
		}
		if !strings.Contains(r.Blocker, "Pass rusher") {
			t.Errorf("expected the blocker to name the missing rusher, got %q", r.Blocker)
		}
	})

	t.Run("size is the headline while the squad is short", func(t *testing.T) {
		r := Readiness(withoutPlayer(legalSquad(), "rush"), squadRules)
		if !strings.Contains(r.Blocker, "Players in your squad") {
			t.Errorf("a short squad should lead with its size, got %q", r.Blocker)
		}
	})
}
