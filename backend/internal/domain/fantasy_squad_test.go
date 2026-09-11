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
		// No women on offence at all: neither a female QB nor a female receiver,
		// so nothing can fill the women's starting slot.
		squad := withoutPlayer(withoutPlayer(legalSquad(), "qbf"), "rec1")
		squad = append(squad,
			SquadPlayer{PlayerID: "recM", Name: "recM", Position: "Receiver", Gender: "M", ClubID: "c7"},
			SquadPlayer{PlayerID: "recM2", Name: "recM2", Position: "Receiver", Gender: "M", ClubID: "c7"},
		)
		r := Readiness(squad, squadRules)
		if r.Ready {
			t.Fatal("a squad with no woman for the starting slot cannot field a lineup")
		}
		req, ok := requirement(r, "female_starter")
		if !ok {
			t.Fatal("expected a women's starting-slot line on the checklist")
		}
		if req.Met || req.Have != 0 || req.Need != 1 {
			t.Errorf("expected the women's starting-slot line to be unmet at 0/1, got %d/%d met=%v", req.Have, req.Need, req.Met)
		}
	})

	// The women's slot family overlaps with the receivers, so one player can be
	// cover for both and start in only one. The checklist must not count her
	// twice: a squad of five receivers where one is needed for the women's slot
	// has four for REC_1–5, and has to say so rather than ticking both lines and
	// leaving Ready to contradict them.
	t.Run("a player who covers two families is only counted once", func(t *testing.T) {
		squad := withoutPlayer(legalSquad(), "qbf")
		squad = append(squad,
			SquadPlayer{PlayerID: "extra", Name: "extra", Position: "Defender", Gender: "M", ClubID: "c7"})

		r := Readiness(squad, squadRules)
		if r.Ready {
			t.Fatal("the squad cannot field a fourteen: she cannot be in two slots")
		}

		starter, _ := requirement(r, "female_starter")
		if !starter.Met {
			t.Error("the female receiver can start in the women's slot, so that line is met")
		}

		rec, ok := requirement(r, "rec")
		if !ok {
			t.Fatal("expected a receiver line")
		}
		if rec.Met {
			t.Error("only four receivers are left once she takes the women's slot")
		}
		if rec.Have != 4 || rec.Need != 5 {
			t.Errorf("expected the receiver line to read 4/5, got %d/%d", rec.Have, rec.Need)
		}
	})

	// Every line agreeing with Ready is the property that matters: a checklist
	// where each line is ticked must never sit next to "you cannot field a
	// lineup", because that leaves the manager nothing to act on.
	t.Run("all lines met implies the squad can field a lineup", func(t *testing.T) {
		for name, squad := range map[string][]SquadPlayer{
			"legal": legalSquad(),
			"one short of a receiver": withoutPlayer(legalSquad(), "qbf"),
			"no women on offence": append(
				withoutPlayer(withoutPlayer(legalSquad(), "qbf"), "rec1"),
				SquadPlayer{PlayerID: "recM", Position: "Receiver", Gender: "M", ClubID: "c7"},
				SquadPlayer{PlayerID: "recM2", Position: "Receiver", Gender: "M", ClubID: "c7"},
			),
		} {
			r := Readiness(squad, squadRules)
			allMet := true
			for _, req := range r.Requirements {
				if !req.Met {
					allMet = false
					break
				}
			}
			if allMet && !r.Ready {
				t.Errorf("%s: every checklist line is met but the squad is not ready (%s)", name, r.Blocker)
			}
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

// The women's starting slot takes a QB or a receiver. A squad with no woman at
// quarterback is playable as long as it has a woman who can catch — that is the
// whole point of the rule, and the squad below has no female QB at all.
func TestFemaleStarterSlotAcceptsAReceiver(t *testing.T) {
	mk := func(id, pos, gender, club string) SquadPlayer {
		return SquadPlayer{
			PlayerID: id, Name: id, Position: pos, Gender: gender,
			ClubID: club, PurchasePrice: 10, CurrentPrice: 10,
		}
	}
	squad := []SquadPlayer{
		mk("qbm", "QB", "M", "c1"),
		// Six receivers, two of them women: one covers the women's starting
		// slot and five fill REC_1–5.
		mk("recF1", "Receiver", "F", "c2"),
		mk("recF2", "Receiver", "F", "c3"),
		mk("rec3", "Receiver", "M", "c3"),
		mk("rec4", "Receiver", "M", "c4"),
		mk("rec5", "Center", "M", "c5"),
		mk("rec6", "Receiver", "M", "c6"),
		mk("rush", "Rusher", "M", "c1"),
		mk("def1", "Defender", "F", "c2"),
		mk("def2", "Defender", "M", "c3"),
		mk("def3", "Defender", "M", "c4"),
		mk("def4", "Defender", "M", "c5"),
		mk("def5", "Defender", "M", "c6"),
		mk("def6", "Defender", "M", "c7"),
	}

	if err := CanFieldLineup(squad, squadRules); err != nil {
		t.Fatalf("a squad with a female receiver but no female QB must be playable: %v", err)
	}

	assignment, err := assignSlots(squad)
	if err != nil {
		t.Fatalf("assignSlots: %v", err)
	}
	starter, ok := assignment[SlotQBFemale]
	if !ok {
		t.Fatal("the women's starting slot was left empty")
	}
	if NormalizeGender(starter.Gender) != "F" {
		t.Errorf("the women's starting slot must hold a woman, got %s", starter.Gender)
	}
	if starter.Position == "QB" {
		t.Error("this squad has no female QB, so the slot must have been filled by a receiver")
	}
}

// The slot spec drives every check — validation, the picker, the assignment —
// so what it accepts is worth pinning directly.
func TestFemaleStarterSlotSpec(t *testing.T) {
	spec, ok := SlotSpecFor(SlotQBFemale)
	if !ok {
		t.Fatal("the women's starting slot has no spec")
	}

	for _, tc := range []struct {
		position string
		gender   string
		want     bool
	}{
		{"QB", "F", true},
		{"Receiver", "F", true},
		{"Center", "F", true},
		{"QB", "M", false},
		{"Receiver", "M", false},
		{"Center", "M", false},
		{"Defender", "F", false},
		{"Rusher", "F", false},
	} {
		if got := spec.Accepts(tc.position, tc.gender); got != tc.want {
			t.Errorf("Accepts(%q, %q) = %v, want %v", tc.position, tc.gender, got, tc.want)
		}
	}

	// A male receiver rejected here must still be fine in a receiver slot —
	// widening the women's slot must not have widened anything else.
	rec, _ := SlotSpecFor(SlotRec1)
	if !rec.Accepts("Receiver", "M") {
		t.Error("REC_1 must still accept a male receiver")
	}
	if rec.Accepts("QB", "M") {
		t.Error("REC_1 must not have started accepting quarterbacks")
	}
}

// A greedy fill would spend the female receiver on the women's slot and then
// run out of receivers, rejecting a squad that can field a legal fourteen by
// starting the female QB instead. The assignment has to be able to back out of
// that choice.
func TestAssignSlotsBacksOutOfADeadEnd(t *testing.T) {
	mk := func(id, pos, gender, club string) SquadPlayer {
		return SquadPlayer{PlayerID: id, Name: id, Position: pos, Gender: gender, ClubID: club}
	}
	squad := []SquadPlayer{
		// The female receiver is first, so a naive pass takes her for QB_F.
		mk("recF", "Receiver", "F", "c1"),
		mk("qbF", "QB", "F", "c2"),
		mk("qbM", "QB", "M", "c3"),
		mk("rec2", "Receiver", "F", "c4"),
		mk("rec3", "Receiver", "F", "c5"),
		mk("rec4", "Receiver", "M", "c6"),
		mk("rec5", "Center", "M", "c7"),
		mk("rush", "Rusher", "M", "c8"),
		mk("d1", "Defender", "F", "c9"),
		mk("d2", "Defender", "F", "c10"),
		mk("d3", "Defender", "F", "c11"),
		mk("d4", "Defender", "M", "c12"),
		mk("d5", "Defender", "M", "c13"),
		mk("d6", "Defender", "M", "c14"),
	}

	assignment, err := assignSlots(squad)
	if err != nil {
		t.Fatalf("a squad that can field a fourteen was rejected: %v", err)
	}
	if len(assignment) != len(AllValidSlots) {
		t.Fatalf("expected all %d slots filled, got %d", len(AllValidSlots), len(assignment))
	}

	// Every slot holds someone it actually accepts, and nobody is in two slots.
	seen := map[string]FantasySlot{}
	for slot, p := range assignment {
		spec, _ := SlotSpecFor(slot)
		if !spec.Accepts(p.Position, p.Gender) {
			t.Errorf("%s holds %s (%s %s), which it does not accept", slot, p.PlayerID, p.Gender, p.Position)
		}
		if other, dup := seen[p.PlayerID]; dup {
			t.Errorf("%s is in both %s and %s", p.PlayerID, other, slot)
		}
		seen[p.PlayerID] = slot
	}
}
