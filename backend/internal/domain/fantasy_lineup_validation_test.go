package domain

import "testing"

// The squad builder saves a team sheet after every pick, so the validator is
// now asked about sheets that are legitimately half-finished. These tests pin
// down the line between "not finished yet" (savable, but does not score) and
// "actually broken" (refused outright), because that line is what decides
// whether a manager's work is kept or thrown away.

var testRules = LineupRules{MinFemaleOffense: 3, MinFemaleDefense: 3, MaxPerClub: 3}

// fullValidLineup builds a complete, legal fourteen: the female QB plus three
// women in each unit, and no more than three players from any one club.
func fullValidLineup() []LineupCandidate {
	// Genders are chosen so offence has 3 women (female QB + 2 receivers) and
	// defence has 3 (three defenders).
	spec := []struct {
		slot     FantasySlot
		position string
		gender   string
	}{
		{SlotQBMale, "QB", "M"},
		{SlotQBFemale, "QB", "F"},
		{SlotRec1, "Receiver", "F"},
		{SlotRec2, "Receiver", "F"},
		{SlotRec3, "Receiver", "M"},
		{SlotRec4, "Receiver", "M"},
		{SlotRec5, "Center", "M"},
		{SlotRusher, "Rusher", "M"},
		{SlotDef1, "Defender", "F"},
		{SlotDef2, "Defender", "F"},
		{SlotDef3, "Defender", "F"},
		{SlotDef4, "Defender", "M"},
		{SlotDef5, "Defender", "M"},
		{SlotDef6, "Defender", "M"},
	}
	picks := make([]LineupCandidate, 0, len(spec))
	for i, s := range spec {
		picks = append(picks, LineupCandidate{
			PlayerID: string(rune('a'+i)) + "-player",
			Name:     string(rune('a'+i)) + "-player",
			Position: s.position,
			Gender:   s.gender,
			// One club per two players keeps every sheet under MaxPerClub.
			TeamID: string(rune('a' + i/2)),
			Slot:   s.slot,
			Price:  5.0,
		})
	}
	return picks
}

func TestFullValidLineupFixtureIsActuallyValid(t *testing.T) {
	if _, err := ValidateLineup(fullValidLineup(), testRules); err != nil {
		t.Fatalf("the fixture every other test builds on is not valid: %v", err)
	}
}

func TestValidatePartialLineup(t *testing.T) {
	full := fullValidLineup()

	t.Run("accepts a single pick", func(t *testing.T) {
		if _, err := ValidatePartialLineup(full[:1], testRules); err != nil {
			t.Errorf("a manager's first pick must be savable, got: %v", err)
		}
	})

	t.Run("accepts any prefix of a valid sheet", func(t *testing.T) {
		for n := 0; n <= len(full); n++ {
			if _, err := ValidatePartialLineup(full[:n], testRules); err != nil {
				t.Errorf("%d of 14 picked should be savable, got: %v", n, err)
			}
		}
	})

	// The quotas are floors. A sheet on its way to satisfying them is not
	// breaking them, so enforcing them mid-build would refuse the first pick.
	t.Run("does not enforce the female minimums while unfinished", func(t *testing.T) {
		menOnly := []LineupCandidate{
			{PlayerID: "p1", Position: "QB", Gender: "M", TeamID: "c1", Slot: SlotQBMale, Price: 5},
			{PlayerID: "p2", Position: "Receiver", Gender: "M", TeamID: "c2", Slot: SlotRec1, Price: 5},
		}
		if _, err := ValidatePartialLineup(menOnly, testRules); err != nil {
			t.Errorf("expected an all-male partial sheet to save, got: %v", err)
		}
		if _, err := ValidateLineup(menOnly, testRules); err == nil {
			t.Error("the same sheet must still be refused as a complete lineup")
		}
	})

	// Everything below is broken rather than unfinished: no amount of further
	// picking makes it legal, so it is refused at save time.
	t.Run("still refuses a player in a slot they cannot fill", func(t *testing.T) {
		bad := []LineupCandidate{
			{PlayerID: "p1", Position: "Defender", Gender: "M", TeamID: "c1", Slot: SlotQBMale, Price: 5},
		}
		if _, err := ValidatePartialLineup(bad, testRules); err == nil {
			t.Error("expected a defender in the QB slot to be refused")
		}
	})

	t.Run("still refuses a female-only slot filled by a man", func(t *testing.T) {
		bad := []LineupCandidate{
			{PlayerID: "p1", Position: "QB", Gender: "M", TeamID: "c1", Slot: SlotQBFemale, Price: 5},
		}
		if _, err := ValidatePartialLineup(bad, testRules); err == nil {
			t.Error("expected a man in the female QB slot to be refused")
		}
	})

	t.Run("still refuses the same player in two slots", func(t *testing.T) {
		bad := []LineupCandidate{
			{PlayerID: "same", Position: "Receiver", Gender: "M", TeamID: "c1", Slot: SlotRec1, Price: 5},
			{PlayerID: "same", Position: "Receiver", Gender: "M", TeamID: "c1", Slot: SlotRec2, Price: 5},
		}
		if _, err := ValidatePartialLineup(bad, testRules); err == nil {
			t.Error("expected one player in two slots to be refused")
		}
	})

	t.Run("still refuses one slot filled twice", func(t *testing.T) {
		bad := []LineupCandidate{
			{PlayerID: "p1", Position: "Receiver", Gender: "M", TeamID: "c1", Slot: SlotRec1, Price: 5},
			{PlayerID: "p2", Position: "Receiver", Gender: "M", TeamID: "c2", Slot: SlotRec1, Price: 5},
		}
		if _, err := ValidatePartialLineup(bad, testRules); err == nil {
			t.Error("expected a duplicated slot to be refused")
		}
	})

	// A club ceiling can be genuinely breached before the sheet is finished:
	// a fourth player from one club is over the limit at four picks, not just
	// at fourteen.
	t.Run("still refuses too many players from one club", func(t *testing.T) {
		bad := []LineupCandidate{
			{PlayerID: "p1", Position: "Receiver", Gender: "M", TeamID: "same", Slot: SlotRec1, Price: 5},
			{PlayerID: "p2", Position: "Receiver", Gender: "M", TeamID: "same", Slot: SlotRec2, Price: 5},
			{PlayerID: "p3", Position: "Receiver", Gender: "M", TeamID: "same", Slot: SlotRec3, Price: 5},
			{PlayerID: "p4", Position: "Receiver", Gender: "M", TeamID: "same", Slot: SlotRec4, Price: 5},
		}
		if _, err := ValidatePartialLineup(bad, testRules); err == nil {
			t.Error("expected a fourth player from one club to be refused at 4 picks")
		}
	})

	t.Run("refuses more picks than there are slots", func(t *testing.T) {
		tooMany := append(fullValidLineup(), LineupCandidate{
			PlayerID: "extra", Position: "Defender", Gender: "M", TeamID: "z", Slot: SlotDef6, Price: 5,
		})
		if _, err := ValidatePartialLineup(tooMany, testRules); err == nil {
			t.Error("expected a fifteenth pick to be refused")
		}
	})
}

func TestIsLineupComplete(t *testing.T) {
	full := fullValidLineup()
	if IsLineupComplete(full[:13]) {
		t.Error("13 of 14 must not read as complete")
	}
	if !IsLineupComplete(full) {
		t.Error("14 of 14 must read as complete")
	}
}

// The two entry points must not have drifted apart: anything ValidateLineup
// accepts, ValidatePartialLineup must accept too, or a finished sheet could be
// refused on the way to being saved.
func TestCompleteLineupAlsoPassesThePartialCheck(t *testing.T) {
	if _, err := ValidatePartialLineup(fullValidLineup(), testRules); err != nil {
		t.Errorf("a complete valid lineup must also pass the partial check, got: %v", err)
	}
}
