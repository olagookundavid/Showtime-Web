package domain

import (
	"fmt"
	"strings"
)

// GameFormat is how many players a side puts on the field per unit. Cup
// competitions are played 5v5; every other competition is 7v7.
//
// The frontend mirrors this table in src/utils/gameFormat.ts (layout and labels
// as well as the rules). Keep the two in step; this one is authoritative.
type GameFormat string

const (
	GameFormat7v7 GameFormat = "7V7"
	GameFormat5v5 GameFormat = "5V5"
)

// Starter units as stored in match_team_sheets.starter_unit.
const (
	StarterUnitOffense = "OFFENSE"
	StarterUnitDefense = "DEFENSE"
)

// GameFormatSpec holds everything that differs between the formats.
type GameFormatSpec struct {
	ID    GameFormat
	Label string // "7v7"

	// Slot keys a team sheet may use per unit. Their count is also the number of
	// starters the unit needs: a full lineup fills every slot exactly once.
	OffenseSlots []string
	DefenseSlots []string

	// MinFemalePerUnit is the least number of women each unit must start, so a
	// lineup needs it in the attack and again in the defence.
	MinFemalePerUnit int

	// Coverages are the defensive schemes (Cover N) a team may pick.
	Coverages []int

	// SquadCap is the most players a match squad (starters + bench) may hold.
	SquadCap int
}

var gameFormats = map[GameFormat]GameFormatSpec{
	GameFormat7v7: {
		ID:    GameFormat7v7,
		Label: "7v7",
		OffenseSlots: []string{
			"WR_1", "WR_2", "CENTER", "WR_3", "WR_4", "MALE_QB", "FEMALE_QB",
		},
		DefenseSlots: []string{
			"RUSHER", "DEF_1", "DEF_2", "DEF_3", "DEF_4", "DEF_5", "DEF_6",
		},
		MinFemalePerUnit: 3,
		Coverages:        []int{1, 2, 3, 4},
		SquadCap:         25,
	},
	GameFormat5v5: {
		ID:    GameFormat5v5,
		Label: "5v5",
		OffenseSlots: []string{
			"QB", "CENTER", "WR_1", "WR_2", "WR_3",
		},
		DefenseSlots: []string{
			"RUSHER", "DEF_1", "DEF_2", "DEF_3", "DEF_4",
		},
		MinFemalePerUnit: 2,
		// Cover 4 (four deep) would leave nobody underneath with only four defenders.
		Coverages: []int{1, 2, 3},
		SquadCap:  25,
	},
}

// GameFormatForCompetition is the format played in a competition of the given
// format (competitions.format): CUP is 5v5, everything else 7v7. An unknown or
// empty value is 7v7, the long-standing default.
func GameFormatForCompetition(competitionFormat string) GameFormatSpec {
	if strings.EqualFold(strings.TrimSpace(competitionFormat), string(CompetitionFormatCup)) {
		return gameFormats[GameFormat5v5]
	}
	return gameFormats[GameFormat7v7]
}

// OffenseSize is how many players start in attack.
func (s GameFormatSpec) OffenseSize() int { return len(s.OffenseSlots) }

// DefenseSize is how many players start in defence.
func (s GameFormatSpec) DefenseSize() int { return len(s.DefenseSlots) }

// StartersTotal is the full lineup: attack plus defence.
func (s GameFormatSpec) StartersTotal() int { return s.OffenseSize() + s.DefenseSize() }

// DefaultCoverage is the scheme a team starts on.
func (s GameFormatSpec) DefaultCoverage() int { return 2 }

// ValidCoverage reports whether n is a scheme this format offers.
func (s GameFormatSpec) ValidCoverage(n int) bool {
	for _, c := range s.Coverages {
		if c == n {
			return true
		}
	}
	return false
}

// LineupStarter is one named starter on a team sheet.
type LineupStarter struct {
	PlayerID string
	Unit     string // StarterUnitOffense | StarterUnitDefense
	Slot     string // a key from OffenseSlots / DefenseSlots
}

// ValidateLineup checks a team sheet's starters against the format. No starters
// at all is fine (a squad named before the lineup is). Otherwise the lineup must
// be complete and well formed:
//   - every starter is a different player;
//   - the attack and the defence each have exactly their size;
//   - every starter sits in a real position for the format, one player per position;
//   - each unit starts at least MinFemalePerUnit women.
//
// females holds the IDs of the women among the starters.
func (s GameFormatSpec) ValidateLineup(starters []LineupStarter, females map[string]bool) error {
	if len(starters) == 0 {
		return nil
	}

	seen := make(map[string]bool, len(starters))
	var off, def []LineupStarter
	for _, st := range starters {
		if seen[st.PlayerID] {
			return fmt.Errorf("duplicate starter in lineup; all starters must be unique individuals")
		}
		seen[st.PlayerID] = true
		switch st.Unit {
		case StarterUnitOffense:
			off = append(off, st)
		case StarterUnitDefense:
			def = append(def, st)
		default:
			return fmt.Errorf("every starter needs a unit (attack or defence)")
		}
	}

	if len(off) != s.OffenseSize() || len(def) != s.DefenseSize() {
		return fmt.Errorf("a %s lineup must have exactly %d starters (%d in attack and %d in defence)",
			s.Label, s.StartersTotal(), s.OffenseSize(), s.DefenseSize())
	}

	if err := checkSlots(s.Label, "attack", s.OffenseSlots, off); err != nil {
		return err
	}
	if err := checkSlots(s.Label, "defence", s.DefenseSlots, def); err != nil {
		return err
	}

	for _, unit := range []struct {
		name     string
		starters []LineupStarter
	}{{"attack", off}, {"defence", def}} {
		women := 0
		for _, st := range unit.starters {
			if females[st.PlayerID] {
				women++
			}
		}
		if women < s.MinFemalePerUnit {
			return fmt.Errorf("a %s %s needs at least %d women (this one has %d)",
				s.Label, unit.name, s.MinFemalePerUnit, women)
		}
	}
	return nil
}

// checkSlots makes sure the unit's starters fill the allowed positions with no gaps or repeats.
func checkSlots(label, unitName string, allowed []string, starters []LineupStarter) error {
	valid := make(map[string]bool, len(allowed))
	for _, a := range allowed {
		valid[a] = true
	}
	taken := make(map[string]bool, len(starters))
	for _, st := range starters {
		if !valid[st.Slot] {
			return fmt.Errorf("%q is not a %s %s position", st.Slot, label, unitName)
		}
		if taken[st.Slot] {
			return fmt.Errorf("two starters are placed in the same %s position (%s)", unitName, st.Slot)
		}
		taken[st.Slot] = true
	}
	return nil
}

// CheckTOTWPublishable applies the format to a Team of the Week about to be
// published: the right number of players in each unit, and the women's quota in
// each. Counts are of players on the edition, per unit.
func (s GameFormatSpec) CheckTOTWPublishable(offence, defence, offenceWomen, defenceWomen int) error {
	if offence != s.OffenseSize() || defence != s.DefenseSize() {
		return fmt.Errorf("cannot publish: a %s Team of the Week needs exactly %d offence and %d defence players (found %d and %d)",
			s.Label, s.OffenseSize(), s.DefenseSize(), offence, defence)
	}
	if offenceWomen < s.MinFemalePerUnit {
		return fmt.Errorf("cannot publish: offence requires at least %d female players (found %d of %d)",
			s.MinFemalePerUnit, offenceWomen, s.MinFemalePerUnit)
	}
	if defenceWomen < s.MinFemalePerUnit {
		return fmt.Errorf("cannot publish: defence requires at least %d female players (found %d of %d)",
			s.MinFemalePerUnit, defenceWomen, s.MinFemalePerUnit)
	}
	return nil
}
