package domain

import (
	"fmt"
	"sort"
)

// MaxBench is how many substitutes a team sheet may name.
const MaxBench = 7

// Formation is a shape: the position each of the 11 slots must hold, and where
// the slot is drawn on the pitch board (x and y as a percentage). Slot 10 is
// always the goalkeeper.
type Formation struct {
	Name   string   `json:"name"`
	Slots  []string `json:"slots"`
	Coords [][2]int `json:"coords"`
}

// Formations is every shape a manager can choose, in display order.
var Formations = []Formation{
	{"4-2-3-1", []string{"ST", "LW", "CAM", "RW", "CDM", "CDM", "LB", "CB", "CB", "RB", "GK"},
		[][2]int{{50, 10}, {18, 28}, {50, 29}, {82, 28}, {32, 48}, {68, 48}, {14, 70}, {38, 73}, {62, 73}, {86, 70}, {50, 91}}},
	{"4-3-3", []string{"LW", "ST", "RW", "CM", "CDM", "CM", "LB", "CB", "CB", "RB", "GK"},
		[][2]int{{20, 17}, {50, 10}, {80, 17}, {23, 43}, {50, 52}, {77, 43}, {14, 70}, {38, 73}, {62, 73}, {86, 70}, {50, 91}}},
	{"4-4-2", []string{"ST", "ST", "LM", "CM", "CM", "RM", "LB", "CB", "CB", "RB", "GK"},
		[][2]int{{34, 12}, {66, 12}, {14, 42}, {38, 46}, {62, 46}, {86, 42}, {14, 70}, {38, 73}, {62, 73}, {86, 70}, {50, 91}}},
	{"3-5-2", []string{"ST", "ST", "LM", "CM", "CAM", "CM", "RM", "CB", "CB", "CB", "GK"},
		[][2]int{{34, 12}, {66, 12}, {12, 44}, {32, 49}, {50, 32}, {68, 49}, {88, 44}, {24, 73}, {50, 75}, {76, 73}, {50, 91}}},
	{"3-4-3", []string{"LW", "ST", "RW", "LM", "CM", "CM", "RM", "CB", "CB", "CB", "GK"},
		[][2]int{{20, 18}, {50, 10}, {80, 18}, {14, 46}, {38, 48}, {62, 48}, {86, 46}, {24, 73}, {50, 75}, {76, 73}, {50, 91}}},
	{"5-3-2", []string{"ST", "ST", "CM", "CDM", "CM", "LWB", "CB", "CB", "CB", "RWB", "GK"},
		[][2]int{{34, 12}, {66, 12}, {25, 42}, {50, 51}, {75, 42}, {10, 65}, {30, 74}, {50, 76}, {70, 74}, {90, 65}, {50, 91}}},
}

// DefaultFormation is used for a new sheet.
const DefaultFormation = "4-2-3-1"

// FormationByName finds a formation.
func FormationByName(name string) (Formation, bool) {
	for _, f := range Formations {
		if f.Name == name {
			return f, true
		}
	}
	return Formation{}, false
}

// SheetInput is a team sheet as a manager builds it.
type SheetInput struct {
	Formation string
	// Starters maps a slot index (0..10) to a player id.
	Starters map[int]string
	Bench    []string
	Captain  string
}

// RosterPlayer is what the rules need to know about a registered player.
type RosterPlayer struct {
	Position string
}

// ValidateSheet returns every reason the sheet can't be submitted; an empty
// result means it is ready. roster is the club's current squad.
func ValidateSheet(in SheetInput, roster map[string]RosterPlayer) []string {
	return validateSheet(in, roster, true)
}

// ValidateDraft checks only that what has been chosen so far is allowed (no
// repeats, only squad members, goalkeeper rules), so a half-finished sheet can be
// saved. Completeness is ValidateSheet's job.
func ValidateDraft(in SheetInput, roster map[string]RosterPlayer) []string {
	return validateSheet(in, roster, false)
}

func validateSheet(in SheetInput, roster map[string]RosterPlayer, complete bool) []string {
	f, ok := FormationByName(in.Formation)
	if !ok {
		return []string{"Choose one of the available formations."}
	}
	var errs []string

	chosen := make(map[string]bool, 11)
	missing, dup, gone, gkWrong, outfieldGK := false, false, false, false, false
	for i, pos := range f.Slots {
		id, set := in.Starters[i]
		if !set || id == "" {
			missing = true
			continue
		}
		if chosen[id] {
			dup = true
		}
		chosen[id] = true
		p, inRoster := roster[id]
		if !inRoster {
			gone = true
			continue
		}
		if pos == "GK" && p.Position != "GK" {
			gkWrong = true
		}
		if pos != "GK" && p.Position == "GK" {
			outfieldGK = true
		}
	}
	for i := range in.Starters {
		if i < 0 || i >= len(f.Slots) {
			errs = append(errs, "A starter is in a slot that doesn't exist in this formation.")
			break
		}
	}
	if missing && complete {
		errs = append(errs, "Select all 11 starting players.")
	}
	if dup {
		errs = append(errs, "Each player can appear only once in the starting XI.")
	}
	if gone {
		errs = append(errs, "A selected player is no longer registered to this club.")
	}
	if gkWrong {
		errs = append(errs, "Choose a goalkeeper for the GK position.")
	}
	if outfieldGK {
		errs = append(errs, "A goalkeeper cannot fill an outfield slot.")
	}

	if len(in.Bench) > MaxBench {
		errs = append(errs, fmt.Sprintf("Select no more than %d substitutes.", MaxBench))
	}
	benchSeen := make(map[string]bool, len(in.Bench))
	benchBad := false
	for _, id := range in.Bench {
		if _, ok := roster[id]; !ok || chosen[id] || benchSeen[id] {
			benchBad = true
		}
		benchSeen[id] = true
	}
	if benchBad {
		errs = append(errs, "Substitutes must be unique registered players outside the starting XI.")
	}

	if (complete && in.Captain == "") || (in.Captain != "" && !chosen[in.Captain]) {
		errs = append(errs, "Select a captain from the starting XI.")
	}
	return errs
}

// AutoPick fills the formation from the squad: each slot takes the first unused
// player whose position matches exactly, then any unused player who fits the
// slot's goalkeeper-or-outfield rule. Squad order (e.g. shirt number) decides who
// comes first. The bench is the next MaxBench unused players, and the captain is
// the first starter.
func AutoPick(formation string, squad []string, roster map[string]RosterPlayer) SheetInput {
	f, ok := FormationByName(formation)
	if !ok {
		f, _ = FormationByName(DefaultFormation)
	}
	in := SheetInput{Formation: f.Name, Starters: map[int]string{}}
	used := map[string]bool{}

	take := func(match func(RosterPlayer) bool) string {
		for _, id := range squad {
			if !used[id] && match(roster[id]) {
				used[id] = true
				return id
			}
		}
		return ""
	}
	// Exact positions first, so a CB isn't spent on a CDM slot a CDM could fill.
	for i, pos := range f.Slots {
		if id := take(func(p RosterPlayer) bool { return p.Position == pos }); id != "" {
			in.Starters[i] = id
		}
	}
	for i, pos := range f.Slots {
		if _, done := in.Starters[i]; done {
			continue
		}
		wantGK := pos == "GK"
		if id := take(func(p RosterPlayer) bool { return (p.Position == "GK") == wantGK }); id != "" {
			in.Starters[i] = id
		}
	}
	for _, id := range squad {
		if len(in.Bench) >= MaxBench {
			break
		}
		if !used[id] {
			in.Bench = append(in.Bench, id)
			used[id] = true
		}
	}
	idx := make([]int, 0, len(in.Starters))
	for i := range in.Starters {
		idx = append(idx, i)
	}
	sort.Ints(idx)
	if len(idx) > 0 {
		in.Captain = in.Starters[idx[0]]
	}
	return in
}
