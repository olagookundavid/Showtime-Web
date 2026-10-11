package domain

import (
	"fmt"
	"strings"
	"testing"
)

// fullLineup fills every slot of the format with distinct players p0, p1, ...
// and marks the first offWomen attackers and defWomen defenders as women.
func fullLineup(spec GameFormatSpec, offWomen, defWomen int) ([]LineupStarter, map[string]bool) {
	var starters []LineupStarter
	females := map[string]bool{}
	n := 0
	add := func(unit string, slots []string, women int) {
		for i, slot := range slots {
			id := fmt.Sprintf("p%d", n)
			n++
			starters = append(starters, LineupStarter{PlayerID: id, Unit: unit, Slot: slot})
			if i < women {
				females[id] = true
			}
		}
	}
	add(StarterUnitOffense, spec.OffenseSlots, offWomen)
	add(StarterUnitDefense, spec.DefenseSlots, defWomen)
	return starters, females
}

func TestGameFormatForCompetition(t *testing.T) {
	cases := map[string]GameFormat{
		"CUP":       GameFormat5v5,
		"cup":       GameFormat5v5,
		" Cup ":     GameFormat5v5,
		"SEASON":    GameFormat7v7,
		"PLAYOFFS":  GameFormat7v7,
		"PRESEASON": GameFormat7v7,
		"":          GameFormat7v7,
		"LEAGUE":    GameFormat7v7,
	}
	for in, want := range cases {
		if got := GameFormatForCompetition(in).ID; got != want {
			t.Errorf("format %q: got %s, want %s", in, got, want)
		}
	}
}

func TestGameFormatSizes(t *testing.T) {
	s7 := GameFormatForCompetition("SEASON")
	if s7.OffenseSize() != 7 || s7.DefenseSize() != 7 || s7.StartersTotal() != 14 || s7.MinFemalePerUnit != 3 {
		t.Errorf("7v7 spec wrong: %+v", s7)
	}
	s5 := GameFormatForCompetition("CUP")
	if s5.OffenseSize() != 5 || s5.DefenseSize() != 5 || s5.StartersTotal() != 10 || s5.MinFemalePerUnit != 2 {
		t.Errorf("5v5 spec wrong: %+v", s5)
	}
	if s5.ValidCoverage(4) || !s5.ValidCoverage(1) || !s5.ValidCoverage(3) {
		t.Errorf("5v5 coverages should be Cover 1-3, got %v", s5.Coverages)
	}
	if !s7.ValidCoverage(4) {
		t.Errorf("7v7 keeps Cover 4")
	}
	if !s5.ValidCoverage(s5.DefaultCoverage()) || !s7.ValidCoverage(s7.DefaultCoverage()) {
		t.Errorf("default coverage must be offered by its own format")
	}
	// Slot keys must be unique inside a unit, or a lineup could never fill them.
	for _, s := range []GameFormatSpec{s7, s5} {
		for _, slots := range [][]string{s.OffenseSlots, s.DefenseSlots} {
			seen := map[string]bool{}
			for _, k := range slots {
				if seen[k] {
					t.Errorf("%s repeats slot key %s", s.Label, k)
				}
				seen[k] = true
			}
		}
	}
}

func TestValidateLineup(t *testing.T) {
	s7 := GameFormatForCompetition("SEASON")
	s5 := GameFormatForCompetition("CUP")

	type tc struct {
		name    string
		spec    GameFormatSpec
		build   func() ([]LineupStarter, map[string]bool)
		wantErr string // substring; "" means valid
	}
	cases := []tc{
		{"7v7 full lineup, exactly 3+3 women", s7, func() ([]LineupStarter, map[string]bool) { return fullLineup(s7, 3, 3) }, ""},
		{"5v5 full lineup, exactly 2+2 women", s5, func() ([]LineupStarter, map[string]bool) { return fullLineup(s5, 2, 2) }, ""},
		{"empty lineup is allowed (squad only)", s5, func() ([]LineupStarter, map[string]bool) { return nil, nil }, ""},
		{"7v7 with only 2 women in attack", s7, func() ([]LineupStarter, map[string]bool) { return fullLineup(s7, 2, 3) }, "attack needs at least 3 women"},
		{"7v7 with only 2 women in defence", s7, func() ([]LineupStarter, map[string]bool) { return fullLineup(s7, 3, 2) }, "defence needs at least 3 women"},
		{"5v5 with 1 woman in attack", s5, func() ([]LineupStarter, map[string]bool) { return fullLineup(s5, 1, 2) }, "attack needs at least 2 women"},
		{"5v5 with 1 woman in defence", s5, func() ([]LineupStarter, map[string]bool) { return fullLineup(s5, 2, 1) }, "defence needs at least 2 women"},
		{"women in one unit don't cover the other", s5, func() ([]LineupStarter, map[string]bool) { return fullLineup(s5, 5, 0) }, "defence needs at least 2 women"},
		{"5v5 rejects a 7v7 lineup", s5, func() ([]LineupStarter, map[string]bool) { return fullLineup(s7, 3, 3) }, "exactly 10 starters"},
		{"7v7 rejects a 5v5 lineup", s7, func() ([]LineupStarter, map[string]bool) { return fullLineup(s5, 2, 2) }, "exactly 14 starters"},
		{"5v5 with 4 attackers and 6 defenders", s5, func() ([]LineupStarter, map[string]bool) {
			st, f := fullLineup(s5, 2, 2)
			st[4].Unit = StarterUnitDefense // move one attacker to defence
			return st, f
		}, "5 in attack and 5 in defence"},
		{"duplicate player", s5, func() ([]LineupStarter, map[string]bool) {
			st, f := fullLineup(s5, 2, 2)
			st[9].PlayerID = st[0].PlayerID
			return st, f
		}, "duplicate starter"},
		{"unknown slot key", s5, func() ([]LineupStarter, map[string]bool) {
			st, f := fullLineup(s5, 2, 2)
			st[1].Slot = "FEMALE_QB" // a 7v7 position
			return st, f
		}, "not a 5v5 attack position"},
		{"two players in one slot", s5, func() ([]LineupStarter, map[string]bool) {
			st, f := fullLineup(s5, 2, 2)
			st[2].Slot = st[3].Slot
			return st, f
		}, "same attack position"},
		{"missing unit", s5, func() ([]LineupStarter, map[string]bool) {
			st, f := fullLineup(s5, 2, 2)
			st[0].Unit = ""
			return st, f
		}, "needs a unit"},
	}

	for _, c := range cases {
		starters, females := c.build()
		err := c.spec.ValidateLineup(starters, females)
		switch {
		case c.wantErr == "" && err != nil:
			t.Errorf("%s: unexpected error: %v", c.name, err)
		case c.wantErr != "" && err == nil:
			t.Errorf("%s: expected an error containing %q, got none", c.name, c.wantErr)
		case c.wantErr != "" && !strings.Contains(err.Error(), c.wantErr):
			t.Errorf("%s: error %q should contain %q", c.name, err.Error(), c.wantErr)
		}
	}
}

func TestCheckTOTWPublishable(t *testing.T) {
	s7 := GameFormatForCompetition("SEASON")
	s5 := GameFormatForCompetition("CUP")

	cases := []struct {
		name                 string
		spec                 GameFormatSpec
		off, def, offW, defW int
		wantErr              string
	}{
		{"7v7 ok", s7, 7, 7, 3, 3, ""},
		{"5v5 ok", s5, 5, 5, 2, 2, ""},
		{"5v5 edition built as 14", s5, 7, 7, 3, 3, "needs exactly 5 offence and 5 defence players (found 7 and 7)"},
		{"7v7 edition with only 10", s7, 5, 5, 3, 3, "needs exactly 7 offence and 7 defence players (found 5 and 5)"},
		{"5v5 one woman short in offence", s5, 5, 5, 1, 2, "offence requires at least 2 female players (found 1 of 2)"},
		{"7v7 two women is not enough", s7, 7, 7, 2, 3, "offence requires at least 3 female players (found 2 of 3)"},
		{"5v5 defence short", s5, 5, 5, 2, 1, "defence requires at least 2 female players (found 1 of 2)"},
	}
	for _, c := range cases {
		err := c.spec.CheckTOTWPublishable(c.off, c.def, c.offW, c.defW)
		switch {
		case c.wantErr == "" && err != nil:
			t.Errorf("%s: unexpected error: %v", c.name, err)
		case c.wantErr != "" && (err == nil || !strings.Contains(err.Error(), c.wantErr)):
			t.Errorf("%s: got %v, want error containing %q", c.name, err, c.wantErr)
		}
	}
}
