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
	// TeamActive is true when the player's club is active and participating.
	TeamActive bool `json:"team_active"`

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

// maxAssignment seats as many slots as the squad can simultaneously fill, and
// returns the ones it could not. A squad that can field a lineup comes back with
// no unfilled slots; anything left over is precisely what the manager is short
// of, which is what the readiness checklist reports.
//
// This is a bipartite matching rather than a greedy pass, because slots overlap:
// the women's starting slot takes a QB *or* a receiver, so a female receiver is
// eligible for both it and REC_1–5. Filling greedily can spend her on the
// women's slot and then run out of receivers, reporting "no one left who can
// play Wide Receiver 5" for a squad that could field a perfectly legal fourteen
// by starting the female QB instead. Ordering by scarcity narrows that window
// but does not close it — only a matching that can revisit earlier choices does.
//
// Kuhn's algorithm: try to place each slot in turn, and when every player it
// accepts is taken, ask each of those players to move to another slot they fit.
// With 14 slots and a squad of that order it is instant, and unlike the greedy
// it never reports a failure that a different arrangement would have avoided.
func maxAssignment(squad []SquadPlayer) (map[FantasySlot]SquadPlayer, []FantasySlot) {
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
		// Women first among equally eligible players. Matching decides whether a
		// lineup exists at all; this decides which of several it finds, and the
		// caller then checks the female minimums against it. Offering women for
		// the flexible slots first means a squad that can meet the quota usually
		// produces an assignment that does.
		ids := eligible[slot]
		sort.SliceStable(ids, func(a, b int) bool {
			return NormalizeGender(squad[ids[a]].Gender) == "F" &&
				NormalizeGender(squad[ids[b]].Gender) != "F"
		})
	}

	// Scarcest slot first. Not needed for correctness now that the matching can
	// back out of a choice, but it reaches a full assignment in fewer augmenting
	// passes and keeps the failure message pointing at the genuinely stuck slot.
	order := append([]FantasySlot(nil), AllValidSlots...)
	sort.SliceStable(order, func(a, b int) bool {
		return len(eligible[order[a]]) < len(eligible[order[b]])
	})

	// playerToSlot is the matching so far, keyed by index into squad.
	playerToSlot := make(map[int]FantasySlot, len(AllValidSlots))

	// tryAssign seats one slot, displacing earlier choices where they have
	// somewhere else to go. seen stops a displacement chain revisiting a player.
	var tryAssign func(slot FantasySlot, seen map[int]bool) bool
	tryAssign = func(slot FantasySlot, seen map[int]bool) bool {
		for _, idx := range eligible[slot] {
			if seen[idx] {
				continue
			}
			seen[idx] = true
			holder, taken := playerToSlot[idx]
			if !taken || tryAssign(holder, seen) {
				playerToSlot[idx] = slot
				return true
			}
		}
		return false
	}

	var unfilled []FantasySlot
	for _, slot := range order {
		if !tryAssign(slot, make(map[int]bool, len(squad))) {
			unfilled = append(unfilled, slot)
		}
	}

	assignment := make(map[FantasySlot]SquadPlayer, len(AllValidSlots))
	for idx, slot := range playerToSlot {
		assignment[slot] = squad[idx]
	}

	// Report unfilled slots in roster order rather than the scarcity order they
	// were attempted in, so the same squad always names the same slot first.
	sort.SliceStable(unfilled, func(a, b int) bool {
		return slotRosterIndex(unfilled[a]) < slotRosterIndex(unfilled[b])
	})
	return assignment, unfilled
}

func slotRosterIndex(slot FantasySlot) int {
	for i, s := range AllValidSlots {
		if s == slot {
			return i
		}
	}
	return len(AllValidSlots)
}

// assignSlots fills every slot or fails, naming one that could not be filled.
func assignSlots(squad []SquadPlayer) (map[FantasySlot]SquadPlayer, error) {
	assignment, unfilled := maxAssignment(squad)
	if len(unfilled) > 0 {
		spec, _ := SlotSpecFor(unfilled[0])
		return nil, fmt.Errorf("no one left who can play %s", spec.Label)
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

	// How many of each slot family the squad can fill *at the same time*.
	//
	// Counting players per family would be wrong now that the families overlap:
	// the women's starting slot takes a QB or a receiver, so a female receiver
	// is cover for that slot and one of the five receivers, but never both at
	// once. Counting her twice reads as "5 receivers" and "1 for the women's
	// slot" — both ticked, on a squad that cannot field a fourteen.
	//
	// So the checklist is built from the same assignment that decides whether a
	// lineup exists. A slot the matching could not seat is a slot the manager is
	// genuinely short of, which makes every line here agree with Ready below.
	assignment, _ := maxAssignment(squad)

	// slotFamily groups the fourteen slots into the lines the checklist shows.
	slotFamily := func(slot FantasySlot) string {
		switch slot {
		case SlotQBMale:
			return "qb_m"
		case SlotQBFemale:
			return "female_starter"
		case SlotRusher:
			return "rush"
		default:
			if spec, ok := SlotSpecFor(slot); ok && spec.Unit == UnitDefense {
				return "def"
			}
			return "rec"
		}
	}

	filled := map[string]int{}
	needed := map[string]int{}
	for _, slot := range AllValidSlots {
		fam := slotFamily(slot)
		needed[fam]++
		if _, ok := assignment[slot]; ok {
			filled[fam]++
		}
	}

	// Squad depth, for the hints. Unlike the counts above this may exceed what
	// can be started, which is the point: it tells a manager they have cover.
	depth := map[string]int{}
	for _, p := range squad {
		isFemale := NormalizeGender(p.Gender) == "F"
		isReceiver := p.Position == "Receiver" || p.Position == "Center"
		switch {
		case p.Position == "QB" && !isFemale:
			depth["qb_m"]++
		case isReceiver:
			depth["rec"]++
		case p.Position == "Rusher":
			depth["rush"]++
		case p.Position == "Defender":
			depth["def"]++
		}
		if isFemale && (p.Position == "QB" || isReceiver) {
			depth["female_starter"]++
		}
	}
	femaleOffense, femaleDefense := FemaleCount(squad)

	add := func(key, label string, have, need int, hint string) {
		out.Requirements = append(out.Requirements, SquadRequirement{
			Key: key, Label: label, Have: have, Need: need, Met: have >= need, Hint: hint,
		})
	}

	// cover appends "(n in the squad)" when a family holds more players than it
	// can start, so depth still shows even though Have counts startable slots.
	cover := func(fam, base string) string {
		if depth[fam] > needed[fam] {
			extra := fmt.Sprintf("%d in your squad, so you have cover.", depth[fam])
			if base == "" {
				return extra
			}
			return base + " " + extra
		}
		return base
	}

	add("squad_size", "Players in your squad", len(squad), SquadMin,
		"Fewer than 14 and you cannot field a team sheet — you would score nothing that match day.")
	add("qb_m", "Male QB", filled["qb_m"], needed["qb_m"], cover("qb_m", ""))
	add("female_starter", "Woman for the starting slot", filled["female_starter"], needed["female_starter"],
		cover("female_starter", "A female QB, receiver or center — it does not have to be a quarterback."))
	add("rec", "Receivers or centers", filled["rec"], needed["rec"],
		cover("rec", "Centers fill receiver slots."))
	add("rush", "Pass rusher", filled["rush"], needed["rush"], cover("rush", ""))
	add("def", "Defenders", filled["def"], needed["def"], cover("def", ""))
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
