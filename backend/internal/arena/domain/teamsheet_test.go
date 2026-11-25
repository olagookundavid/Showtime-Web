package domain

import (
	"fmt"
	"strings"
	"testing"
)

// squad builds 16 players: a GK, two CBs and so on, enough for an XI and a bench.
func testSquad() ([]string, map[string]RosterPlayer) {
	positions := []string{"ST", "LW", "RW", "CAM", "CM", "CDM", "LB", "CB", "CB", "RB", "GK", "ST", "CM", "CB", "GK", "LM", "RM", "CDM", "LB"}
	var ids []string
	roster := map[string]RosterPlayer{}
	for i, p := range positions {
		id := fmt.Sprintf("p%02d", i)
		ids = append(ids, id)
		roster[id] = RosterPlayer{Position: p}
	}
	return ids, roster
}

func hasError(errs []string, sub string) bool {
	for _, e := range errs {
		if strings.Contains(e, sub) {
			return true
		}
	}
	return false
}

func TestFormationsAreWellFormed(t *testing.T) {
	for _, f := range Formations {
		if len(f.Slots) != 11 || len(f.Coords) != 11 {
			t.Errorf("%s: %d slots, %d coords", f.Name, len(f.Slots), len(f.Coords))
		}
		if f.Slots[10] != "GK" {
			t.Errorf("%s: slot 10 must be the goalkeeper", f.Name)
		}
		for i, s := range f.Slots[:10] {
			if s == "GK" {
				t.Errorf("%s: GK in outfield slot %d", f.Name, i)
			}
		}
	}
}

func TestAutoPickProducesAValidSheet(t *testing.T) {
	squad, roster := testSquad()
	for _, f := range Formations {
		in := AutoPick(f.Name, squad, roster)
		if errs := ValidateSheet(in, roster); len(errs) != 0 {
			t.Errorf("%s: auto-pick should be valid, got %v", f.Name, errs)
		}
		if len(in.Bench) != MaxBench {
			t.Errorf("%s: bench has %d, want %d", f.Name, len(in.Bench), MaxBench)
		}
	}
}

func TestValidateSheetCatchesProblems(t *testing.T) {
	squad, roster := testSquad()
	good := AutoPick("4-2-3-1", squad, roster)

	t.Run("unknown formation", func(t *testing.T) {
		in := good
		in.Formation = "9-9-9"
		if !hasError(ValidateSheet(in, roster), "formation") {
			t.Error("expected formation error")
		}
	})
	t.Run("missing starter", func(t *testing.T) {
		in := clone(good)
		delete(in.Starters, 3)
		if !hasError(ValidateSheet(in, roster), "all 11") {
			t.Error("expected missing starter error")
		}
	})
	t.Run("duplicate starter", func(t *testing.T) {
		in := clone(good)
		in.Starters[1] = in.Starters[0]
		if !hasError(ValidateSheet(in, roster), "only once") {
			t.Error("expected duplicate error")
		}
	})
	t.Run("player not in squad", func(t *testing.T) {
		in := clone(good)
		in.Starters[0] = "stranger"
		if !hasError(ValidateSheet(in, roster), "no longer registered") {
			t.Error("expected not-registered error")
		}
	})
	t.Run("outfield player in goal", func(t *testing.T) {
		in := clone(good)
		in.Starters[10] = in.Starters[0]
		if !hasError(ValidateSheet(in, roster), "goalkeeper for the GK") {
			t.Error("expected GK error")
		}
	})
	t.Run("goalkeeper in the outfield", func(t *testing.T) {
		in := clone(good)
		in.Starters[0] = "p14" // the second GK
		if !hasError(ValidateSheet(in, roster), "cannot fill an outfield") {
			t.Error("expected outfield GK error")
		}
	})
	t.Run("too many subs", func(t *testing.T) {
		in := clone(good)
		in.Bench = append(in.Bench, "p15", "p16")
		if !hasError(ValidateSheet(in, roster), "no more than 7") {
			t.Error("expected bench size error")
		}
	})
	t.Run("sub also starting", func(t *testing.T) {
		in := clone(good)
		in.Bench = []string{in.Starters[0]}
		if !hasError(ValidateSheet(in, roster), "Substitutes must be unique") {
			t.Error("expected bench overlap error")
		}
	})
	t.Run("duplicate sub", func(t *testing.T) {
		in := clone(good)
		in.Bench = []string{"p15", "p15"}
		if !hasError(ValidateSheet(in, roster), "Substitutes must be unique") {
			t.Error("expected duplicate sub error")
		}
	})
	t.Run("captain on the bench", func(t *testing.T) {
		in := clone(good)
		in.Captain = in.Bench[0]
		if !hasError(ValidateSheet(in, roster), "captain") {
			t.Error("expected captain error")
		}
	})
	t.Run("slot out of range", func(t *testing.T) {
		in := clone(good)
		in.Starters[11] = "p15"
		if !hasError(ValidateSheet(in, roster), "doesn't exist") {
			t.Error("expected slot range error")
		}
	})
}

func clone(in SheetInput) SheetInput {
	out := SheetInput{Formation: in.Formation, Captain: in.Captain, Bench: append([]string(nil), in.Bench...), Starters: map[int]string{}}
	for k, v := range in.Starters {
		out.Starters[k] = v
	}
	return out
}

func TestValidateDraftAllowsUnfinishedSheets(t *testing.T) {
	squad, roster := testSquad()

	empty := SheetInput{Formation: "4-4-2", Starters: map[int]string{}}
	if errs := ValidateDraft(empty, roster); len(errs) != 0 {
		t.Errorf("an empty draft is fine, got %v", errs)
	}
	if errs := ValidateSheet(empty, roster); len(errs) == 0 {
		t.Error("an empty sheet can't be submitted")
	}

	partial := SheetInput{Formation: "4-4-2", Starters: map[int]string{0: squad[0], 10: "p10"}, Bench: []string{squad[15]}}
	if errs := ValidateDraft(partial, roster); len(errs) != 0 {
		t.Errorf("a partial draft is fine, got %v", errs)
	}

	// Integrity rules still apply to a draft.
	dup := SheetInput{Formation: "4-4-2", Starters: map[int]string{0: squad[0], 1: squad[0]}}
	if !hasError(ValidateDraft(dup, roster), "only once") {
		t.Error("drafts can't repeat a player")
	}
	badCaptain := SheetInput{Formation: "4-4-2", Starters: map[int]string{0: squad[0]}, Captain: squad[1]}
	if !hasError(ValidateDraft(badCaptain, roster), "captain") {
		t.Error("a draft's captain must be in the starting XI")
	}
	stranger := SheetInput{Formation: "4-4-2", Starters: map[int]string{0: "nobody"}}
	if !hasError(ValidateDraft(stranger, roster), "no longer registered") {
		t.Error("drafts can only name squad members")
	}
}
