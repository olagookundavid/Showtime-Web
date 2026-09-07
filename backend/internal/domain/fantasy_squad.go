package domain

import (
	"fmt"
	"sort"
)

// A manager owns a squad and fields a lineup from it.
//
// The squad is what the budget buys: between SquadMin and SquadMax players,
// each one purchased. The lineup is the 14 of them that score on a given match
// day; everyone else is a substitute and scores nothing until they are brought
// in. Money lives with the squad, never with the lineup.

const (
	// SquadMin is the number a manager needs before they can field a lineup at
	// all. It is not enforced on the squad — you may hold fewer — but a squad
	// below it cannot put out a team sheet, and a manager who takes the field
	// short scores nothing that match day.
	SquadMin = 14
	// SquadMax caps how much cover a manager may carry: the fourteen who play
	// plus five optional substitutes, of any position.
	SquadMax = 19
	// SquadSubs is the optional cover above the starting fourteen.
	SquadSubs = SquadMax - SquadMin
)

// The squad itself carries no positional, gender or club restrictions. A
// manager may own any nineteen players they can afford. Every rule — the slots,
// the female minimums, the club cap — is enforced where it decides the outcome:
// on the fourteen who take the field. The squad screen shows those rules as a
// checklist so nobody assembles nineteen players and only then discovers they
// cannot field a legal team.

// SquadRequirement is one line of that checklist.
type SquadRequirement struct {
	Key   string `json:"key"`
	Label string `json:"label"`
	Have  int    `json:"have"`
	Need  int    `json:"need"`
	Met   bool   `json:"met"`
	// Hint explains why the requirement exists, for the ones that surprise
	// people — the two gender quotas being separate, most of all.
	Hint string `json:"hint,omitempty"`
}

// SquadReadiness is the whole checklist plus the two conclusions that matter:
// whether a legal fourteen can be drawn, and whether the match day would be
// forfeited as things stand.
type SquadReadiness struct {
	Requirements []SquadRequirement `json:"requirements"`
	// Ready is true when a legal starting fourteen can be drawn from the squad.
	Ready bool `json:"ready"`
	// Forfeits is true when the squad is too small to field a lineup at all, in
	// which case the manager scores nothing that match day.
	Forfeits bool `json:"forfeits"`
	// Blocker is the first thing standing in the way, in plain words.
	Blocker string `json:"blocker,omitempty"`
}

// SquadPlayer is one owned player.
type SquadPlayer struct {
	ID            string  `json:"id"`
	TeamID        string  `json:"team_id"`
	PlayerID      string  `json:"player_id"`
	PurchasePrice float64 `json:"purchase_price"`
	// CurrentPrice is today's market price, for the sell quote. It moves with
	// form, so it is not the price that was paid.
	CurrentPrice float64 `json:"current_price"`

	Name     string `json:"name"`
	Position string `json:"position"`
	Gender   string `json:"gender"`
	ClubID   string `json:"club_id"`

	// Starting marks the ones in the current gameweek's lineup.
	Starting bool `json:"starting"`

	// SellPrice is what this player would fetch right now.
	SellPrice float64 `json:"sell_price"`
	// CanSell is always true: the squad carries no restrictions. It is kept so
	// the client has one field to read rather than assuming.
	CanSell bool `json:"can_sell"`
	// BreaksLineup marks a player whose sale would leave a squad that cannot
	// field a legal fourteen. The sale still goes through — this is what the
	// confirmation warns about, not what refuses it.
	BreaksLineup bool `json:"breaks_lineup"`
	// QuotaCritical marks a woman whose sale the quotas can only just absorb —
	// the squad would still be legal, but with no margin left on her unit. The
	// dashboard warns before taking the money.
	QuotaCritical bool `json:"quota_critical"`
}

// UnitForPosition places a player on the side of the ball their gender quota is
// counted against. The quotas are per unit, so a female receiver and a female
// defender are not interchangeable cover.
func UnitForPosition(position string) FantasyUnit {
	for _, spec := range SlotSpecs {
		for _, p := range spec.AllowedPositions {
			if p == position {
				return spec.Unit
			}
		}
	}
	return UnitOffense
}

// FemaleCount returns how many women a squad holds on each side of the ball.
func FemaleCount(squad []SquadPlayer) (offense, defense int) {
	for _, p := range squad {
		if NormalizeGender(p.Gender) != "F" {
			continue
		}
		if UnitForPosition(p.Position) == UnitOffense {
			offense++
		} else {
			defense++
		}
	}
	return offense, defense
}

// asCandidate lets a squad member be tested against a slot without the caller
// having to rebuild it.
func (s SquadPlayer) asCandidate(slot FantasySlot) LineupCandidate {
	return LineupCandidate{
		Slot:     slot,
		PlayerID: s.PlayerID,
		Name:     s.Name,
		Position: s.Position,
		Gender:   s.Gender,
		TeamID:   s.ClubID,
		Price:    s.CurrentPrice,
	}
}

// ValidateSquad enforces the only two rules ownership has: how many players may
// be held, and that the money adds up.
//
// The slot, gender and club rules are deliberately absent. They govern the
// fourteen who take the field and are enforced by ValidateLineup. A squad may be
// as lopsided as its owner likes — nineteen defenders is a legal squad and a
// useless one, and the checklist says so rather than the sale being refused.
func ValidateSquad(squad []SquadPlayer, bank float64, rules LineupRules) error {
	if len(squad) > SquadMax {
		return fmt.Errorf("a squad may hold at most %d players, this one has %d", SquadMax, len(squad))
	}
	if bank < -budgetEpsilon {
		return fmt.Errorf("this would overspend the budget by %.2f SC", -bank)
	}
	return nil
}

// CanFieldLineup reports whether a legal starting lineup can still be drawn
// from the given squad.
//
// This is the check that makes selling safe. A squad can satisfy every counting
// rule and still be unplayable — sell your only female QB and there is no legal
// team sheet, which a manager would otherwise discover at the deadline with no
// way to fix it. So a sale is refused at the point of sale instead.
//
// It returns the reason it cannot be done, so the refusal can say which slot is
// the problem rather than "invalid squad".
func CanFieldLineup(squad []SquadPlayer, rules LineupRules) error {
	if len(squad) < SquadMin {
		return fmt.Errorf("a squad needs at least %d players to field a lineup, this one would have %d",
			SquadMin, len(squad))
	}

	assignment, err := assignSlots(squad)
	if err != nil {
		return err
	}

	// A legal assignment exists; now confirm it can also satisfy the quotas.
	// The slot fill is greedy, so a first pass may satisfy the slots while
	// missing the gender minimums when a different, equally legal assignment
	// would have met both.
	picks := make([]LineupCandidate, 0, len(AllValidSlots))
	for slot, member := range assignment {
		picks = append(picks, member.asCandidate(slot))
	}
	if _, err := ValidateLineup(picks, LineupRules{
		// Budget is not a lineup concern any more: the squad was paid for when
		// it was bought.
		MinFemaleOffense: rules.MinFemaleOffense,
		MinFemaleDefense: rules.MinFemaleDefense,
		MaxPerClub:       rules.MaxPerClub,
	}); err != nil {
		return fmt.Errorf("the remaining squad could not field a legal lineup: %w", err)
	}
	return nil
}

// assignSlots fills every slot from the squad, scarcest slot first.
//
// As the slots stand today no player can fill two of them — the positions are
// disjoint (QB / Receiver+Center / Rusher / Defender) and gender only splits the
// QB pair — so a greedy pass in any order is correct and the ordering changes
// nothing. It is here for the day that stops being true: let a rusher also cover
// defender, and filling in declaration order would spend the versatile player on
// an easy slot and then fail on the one only they could have taken. Sorting by
// scarcity costs nothing and removes that trap in advance.
func assignSlots(squad []SquadPlayer) (map[FantasySlot]SquadPlayer, error) {
	eligible := make(map[FantasySlot][]int, len(AllValidSlots))
	for _, slot := range AllValidSlots {
		spec, ok := SlotSpecFor(slot)
		if !ok {
			continue
		}
		for i, member := range squad {
			if spec.Accepts(member.Position, member.Gender) {
				eligible[slot] = append(eligible[slot], i)
			}
		}
	}

	order := append([]FantasySlot(nil), AllValidSlots...)
	sort.SliceStable(order, func(a, b int) bool {
		return len(eligible[order[a]]) < len(eligible[order[b]])
	})

	used := make(map[int]bool, len(squad))
	assignment := make(map[FantasySlot]SquadPlayer, len(AllValidSlots))
	for _, slot := range order {
		filled := false
		for _, idx := range eligible[slot] {
			if used[idx] {
				continue
			}
			used[idx] = true
			assignment[slot] = squad[idx]
			filled = true
			break
		}
		if !filled {
			spec, _ := SlotSpecFor(slot)
			return nil, fmt.Errorf("no one left who can play %s", spec.Label)
		}
	}
	return assignment, nil
}

// SellQuote is what a manager gets back for a player.
//
// Players are sold at the current market price, not what was paid: prices move
// with form, so selling is where a good buy is realised and a bad one is taken
// on the chin. There is no sell-on tax today; if churn becomes a problem, this
// is the one place it would be applied.
func SellQuote(p SquadPlayer) float64 {
	if p.CurrentPrice > 0 {
		return p.CurrentPrice
	}
	// A player with no price on file falls back to what was paid, so a missing
	// price row can never quietly wipe out a manager's money.
	return p.PurchasePrice
}

// Readiness builds the checklist a manager works down while assembling a squad.
//
// It is advice, not enforcement. Nothing here refuses a purchase or a sale; the
// starting fourteen is where the rules bite, and this exists so that moment
// never comes as a surprise.
func Readiness(squad []SquadPlayer, rules LineupRules) SquadReadiness {
	var out SquadReadiness

	// How many the squad holds for each slot family. The families are disjoint,
	// so a straight count answers "can these slots be filled".
	counts := map[string]int{}
	for _, p := range squad {
		switch {
		case p.Position == "QB" && NormalizeGender(p.Gender) == "M":
			counts["qb_m"]++
		case p.Position == "QB" && NormalizeGender(p.Gender) == "F":
			counts["qb_f"]++
		case p.Position == "Receiver" || p.Position == "Center":
			counts["rec"]++
		case p.Position == "Rusher":
			counts["rush"]++
		case p.Position == "Defender":
			counts["def"]++
		}
	}
	femaleOffense, femaleDefense := FemaleCount(squad)

	add := func(key, label string, have, need int, hint string) {
		out.Requirements = append(out.Requirements, SquadRequirement{
			Key: key, Label: label, Have: have, Need: need, Met: have >= need, Hint: hint,
		})
	}

	add("squad_size", "Players in your squad", len(squad), SquadMin,
		"Fewer than 14 and you cannot field a team sheet — you would score nothing that match day.")
	add("qb_m", "Male QB", counts["qb_m"], 1, "")
	add("qb_f", "Female QB", counts["qb_f"], 1, "")
	add("rec", "Receivers or centers", counts["rec"], 5, "Centers fill receiver slots.")
	add("rush", "Pass rusher", counts["rush"], 1, "")
	add("def", "Defenders", counts["def"], 6, "")
	add("female_offense", "Women on offense", femaleOffense, rules.MinFemaleOffense,
		"QBs, receivers and centers. Counted separately from defense — women on one unit do not cover the other.")
	add("female_defense", "Women on defense", femaleDefense, rules.MinFemaleDefense,
		"Rushers and defenders. Counted separately from offense.")

	out.Forfeits = len(squad) < SquadMin

	// The counts above are necessary but not sufficient: they cannot see the
	// club cap, or that one player is being counted on for two things at once.
	// The authoritative answer is whether a legal fourteen can actually be
	// drawn, so that is what Ready reports.
	if err := CanFieldLineup(squad, rules); err != nil {
		out.Blocker = err.Error()
		for _, r := range out.Requirements {
			// Prefer a checklist line as the headline when one is unmet: it is
			// more actionable than the assignment failure behind it.
			if !r.Met {
				out.Blocker = fmt.Sprintf("You need %d %s and have %d.", r.Need, r.Label, r.Have)
				break
			}
		}
		return out
	}
	out.Ready = true
	return out
}
