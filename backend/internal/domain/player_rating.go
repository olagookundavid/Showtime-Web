package domain

import (
	"math"
	"strings"
)

// Player rating engine — pure, dependency-free implementations of the Showtime
// rating specifications (see /Ratings/*.docx). Each formula scores a player
// 0.0–10.0 from a single stat line (one game, or an aggregated season/career
// rollup — the math is identical, only the input totals differ).
//
// Only Receiver, Defender and Rusher are implemented here (v1) — Center uses
// the Receiver formula verbatim (same inputs, no separate spec). The
// Quarterback rating (QB_RATING_V1.1) is deferred: it needs per-QB `drives`,
// `punts` and `turnovers`, which aren't tracked yet.
//
// NOTE ON SPEC SAMPLES: the "Suggested API Response" blocks in the Defender and
// Receiver specs are illustrative and internally inconsistent (e.g. the Defender
// sample lists defensive_actions=4 while its own stats sum to 5, and a
// raw_rating that doesn't match its components). The *formulas* (the numbered
// sections) are the source of truth and are what this file implements; the
// tests assert against values hand-computed from those formulas.

// Rating status values. A player with no qualifying activity is UNRATED and
// must NOT be shown a number — callers check Status before reading FinalRating.
const (
	RatingStatusOfficial    = "OFFICIAL"
	RatingStatusProvisional = "PROVISIONAL"
	RatingStatusSingleRole  = "SINGLE_ROLE"
	RatingStatusUnrated     = "UNRATED"
)

// Formula version tags, stored alongside each rating so historical results stay
// reproducible if the weights are later refined.
const (
	ReceiverFormulaVersion    = "RECEIVER_RATING_V1.1"
	DefenderFormulaVersion    = "DEFENDER_RATING_V1.0"
	RusherFormulaVersion      = "RUSHER_RATING_V1.0"
	QuarterbackFormulaVersion = "QB_RATING_V1.3"
	AllRounderFormulaVersion  = "ALL_ROUNDER_RATING_V1.0"
)

// Baseline every player starts from, and the display bounds.
const (
	ratingBaseline = 5.0
	ratingMin      = 0.0
	ratingMax      = 10.0
)

// RatingResult is the output of any player rating formula. When Status is
// UNRATED, FinalRating is 0 and should be rendered as "no rating", never as a
// number (the specs are explicit that an inactive player is not a 5.0).
type RatingResult struct {
	Status            string             `json:"status"`
	RawRating         float64            `json:"raw_rating"`
	ReliabilityFactor float64            `json:"reliability_factor"`
	FinalRating       float64            `json:"final_rating"`
	ExactRating       float64            `json:"exact_rating"`
	FormulaVersion    string             `json:"formula_version"`
	Components        map[string]float64 `json:"components"`
}

// round1 rounds to one decimal place (the displayed precision).
func round1(x float64) float64 { return math.Round(x*10) / 10 }

// clampRating bounds a rating to [0, 10].
func clampRating(x float64) float64 {
	if x < ratingMin {
		return ratingMin
	}
	if x > ratingMax {
		return ratingMax
	}
	return x
}

// capped returns min(cap, perUnit*count) — the standard "reward, but cap the
// contribution" shape shared by the Defender and Rusher components.
func capped(perUnit float64, count int, cap float64) float64 {
	v := perUnit * float64(count)
	if v > cap {
		return cap
	}
	return v
}

// finalise applies the reliability pull-toward-baseline, clamps and returns
// the 1-decimal rounded rating along with the unrounded exact clamped rating.
func finalise(raw, reliability float64) (float64, float64) {
	adjusted := ratingBaseline + (raw-ratingBaseline)*reliability
	exact := clampRating(adjusted)
	return round1(exact), exact
}

// ─── Position dispatch ───────────────────────────────────────────────────────

// RatingStatLine is the union of stat fields the four implemented ratings read,
// so a caller can hand over one struct and let RateByPosition pick the formula.
type RatingStatLine struct {
	Receptions          int
	ReceivingTDs        int
	ExtraPointTDs       int
	Drops               int
	FlagPulls           int
	PassDeflections     int
	Interceptions       int
	DefensiveTDs        int
	Safeties            int
	DefensiveXPTDs      int
	DefensiveSacks      int
	PassingAttempts     int
	CompletedPasses     int
	PassingYards        int
	PassingTDs          int
	InterceptionsThrown int
	RushingAttempts     int
	RushingYards        int
	RushingTDs          int
	QBSacks             int
	XPAttempts          int
	Drives              int
	Turnovers           int
	Punts               int
	UncatchablePasses   int
	ThrownAwayPasses    int
	BattedDownPasses    int
	XPGood              int
}

// RateByPosition computes a rating for a stat line using the formula for the
// player's rating category (the value stored in players.position after the
// backfill: "Receiver" / "Center" / "Defender" / "Rusher" / "QB" / "-"). Center
// shares the Receiver formula. It returns nil for positions with no
// implemented formula ("-"), so callers can render those distinctly from a
// genuine UNRATED result.
func RateByPosition(position string, s RatingStatLine) *RatingResult {
	var res RatingResult
	switch position {
	case "QB":
		otherTurnovers := s.Turnovers - s.InterceptionsThrown
		if otherTurnovers < 0 {
			otherTurnovers = 0
		}
		xpTDs := max(s.ExtraPointTDs, s.XPGood)
		res = CalculateQuarterbackRating(QuarterbackRatingInput{
			PassingAttempts:     s.PassingAttempts,
			CompletedPasses:     s.CompletedPasses,
			PassingYards:        s.PassingYards,
			PassingTDs:          s.PassingTDs,
			InterceptionsThrown: s.InterceptionsThrown,
			QBSacks:             s.QBSacks,
			RushingAttempts:     s.RushingAttempts,
			RushingYards:        s.RushingYards,
			RushingTDs:          s.RushingTDs,
			ExtraPointTDs:       xpTDs,
			OtherTurnovers:      otherTurnovers,
			UncatchablePasses:   s.UncatchablePasses,
			ThrownAwayPasses:    s.ThrownAwayPasses,
			BattedDownPasses:    s.BattedDownPasses,
		})
	case "Receiver", "Center":
		// Center is scored identically to Receiver — same formula, same inputs.
		res = CalculateReceiverRating(ReceiverRatingInput{
			Receptions: s.Receptions, ReceivingTDs: s.ReceivingTDs,
			ExtraPointTDs: s.ExtraPointTDs, Drops: s.Drops,
		})
	case "Defender":
		res = CalculateDefenderRating(DefenderRatingInput{
			FlagPulls: s.FlagPulls, PassDeflections: s.PassDeflections,
			Interceptions: s.Interceptions, Safeties: s.Safeties,
			DefensiveTDs: s.DefensiveTDs, DefensiveXPTDs: s.DefensiveXPTDs,
			DefensiveSacks: s.DefensiveSacks,
		})
	case "Rusher":
		res = CalculateRusherRating(RusherRatingInput{
			DefensiveSacks: s.DefensiveSacks, Safeties: s.Safeties,
			PassDeflections: s.PassDeflections, Interceptions: s.Interceptions,
			DefensiveTDs: s.DefensiveTDs, DefensiveXPTDs: s.DefensiveXPTDs,
			FlagPulls: s.FlagPulls,
		})
	case "All Rounder":
		roles := make(map[string]AllRounderRoleInput)

		// 1. QB
		if s.PassingAttempts > 0 {
			otherTurnovers := s.Turnovers - s.InterceptionsThrown
			if otherTurnovers < 0 {
				otherTurnovers = 0
			}
			xpTDs := max(s.ExtraPointTDs, s.XPGood)
			qbRes := CalculateQuarterbackRating(QuarterbackRatingInput{
				PassingAttempts:     s.PassingAttempts,
				CompletedPasses:     s.CompletedPasses,
				PassingYards:        s.PassingYards,
				PassingTDs:          s.PassingTDs,
				InterceptionsThrown: s.InterceptionsThrown,
				QBSacks:             s.QBSacks,
				RushingAttempts:     s.RushingAttempts,
				RushingYards:        s.RushingYards,
				RushingTDs:          s.RushingTDs,
				ExtraPointTDs:       xpTDs,
				OtherTurnovers:      otherTurnovers,
				UncatchablePasses:   s.UncatchablePasses,
				ThrownAwayPasses:    s.ThrownAwayPasses,
				BattedDownPasses:    s.BattedDownPasses,
			})
			if qbRes.Status != RatingStatusUnrated {
				adjAttempts := s.PassingAttempts
				exclusions := s.UncatchablePasses + s.ThrownAwayPasses + s.BattedDownPasses
				if exclusions > 0 {
					testAdj := s.PassingAttempts - exclusions
					if testAdj >= s.CompletedPasses && testAdj >= s.PassingTDs && testAdj > 0 {
						adjAttempts = testAdj
					}
				}
				roles["QB"] = AllRounderRoleInput{
					Activity:    adjAttempts,
					RatingExact: qbRes.ExactRating,
					DataState:   "VALID",
				}
			}
		}

		// 2. REC
		recOpportunities := s.Receptions + s.Drops
		if recOpportunities > 0 || s.ReceivingTDs > 0 || s.ExtraPointTDs > 0 {
			recRes := CalculateReceiverRating(ReceiverRatingInput{
				Receptions:    s.Receptions,
				ReceivingTDs:  s.ReceivingTDs,
				ExtraPointTDs: s.ExtraPointTDs,
				Drops:         s.Drops,
			})
			if recRes.Status != RatingStatusUnrated {
				activity := recOpportunities
				if activity == 0 && (s.ReceivingTDs > 0 || s.ExtraPointTDs > 0) {
					activity = s.ReceivingTDs + s.ExtraPointTDs
				}
				roles["REC"] = AllRounderRoleInput{
					Activity:    activity,
					RatingExact: recRes.ExactRating,
					DataState:   "VALID",
				}
			}
		}

		// 3. DEF: open field stats (excluding sacks per Spec §7 & §9)
		defActions := s.FlagPulls + s.PassDeflections + s.Interceptions +
			s.Safeties + s.DefensiveTDs + s.DefensiveXPTDs
		if defActions > 0 {
			defRes := CalculateDefenderRating(DefenderRatingInput{
				FlagPulls:       s.FlagPulls,
				PassDeflections: s.PassDeflections,
				Interceptions:   s.Interceptions,
				Safeties:        s.Safeties,
				DefensiveTDs:    s.DefensiveTDs,
				DefensiveXPTDs:  s.DefensiveXPTDs,
				DefensiveSacks:  0, // Sacks allocated exclusively to RUSH per Spec §9
			})
			if defRes.Status != RatingStatusUnrated {
				roles["DEF"] = AllRounderRoleInput{
					Activity:    defActions,
					RatingExact: defRes.ExactRating,
					DataState:   "VALID",
				}
			}
		}

		// 4. RUSH: defensive sacks (Spec §7 & §9)
		if s.DefensiveSacks > 0 {
			rushRes := CalculateRusherRating(RusherRatingInput{
				DefensiveSacks: s.DefensiveSacks,
			})
			if rushRes.Status != RatingStatusUnrated {
				roles["RUSH"] = AllRounderRoleInput{
					Activity:    s.DefensiveSacks,
					RatingExact: rushRes.ExactRating,
					DataState:   "VALID",
				}
			}
		}

		res = CalculateAllRounderRating(AllRounderRatingInput{Roles: roles})
	default:
		return nil
	}
	return &res
}

// ─── Receiver (RECEIVER_RATING_V1.1) ─────────────────────────────────────────

// ReceiverRatingInput is the stat line a receiver rating is computed from.
type ReceiverRatingInput struct {
	Receptions    int
	ReceivingTDs  int
	ExtraPointTDs int
	Drops         int
}

// Receiver formula weights / benchmarks (RECEIVER_RATING_V1.1).
const (
	recReceptionPerUnit = 0.20
	recReceptionCap     = 1.00
	recCatchWeight      = 2.50
	recCatchBenchmark   = 0.75 // neutral catch rate (75%)
	recTDPerUnit        = 2.25
	recTDCap            = 4.50
	recXPPerUnit        = 0.60
	recXPCap            = 1.20
	recFullReliability  = 5.0 // receiving opportunities for full reliability
)

// CalculateReceiverRating implements RECEIVER_RATING_V1.1.
func CalculateReceiverRating(in ReceiverRatingInput) RatingResult {
	opportunities := in.Receptions + in.Drops

	res := RatingResult{
		FormulaVersion: ReceiverFormulaVersion,
		Components:     map[string]float64{},
	}

	// Status by receiving opportunities (spec §4).
	switch {
	case opportunities == 0:
		res.Status = RatingStatusUnrated
		return res
	case opportunities == 1:
		res.Status = RatingStatusProvisional
	default:
		res.Status = RatingStatusOfficial
	}

	var catch float64
	if opportunities > 0 {
		catch = recCatchWeight * ((float64(in.Receptions) / float64(opportunities)) - recCatchBenchmark)
	}
	reception := capped(recReceptionPerUnit, in.Receptions, recReceptionCap)

	raw := ratingBaseline + catch + reception
	reliability := math.Min(1.0, float64(opportunities)/recFullReliability)
	reliablePerf := ratingBaseline + (raw-ratingBaseline)*reliability

	tdImpact := capped(recTDPerUnit, in.ReceivingTDs, recTDCap)
	xpImpact := capped(recXPPerUnit, in.ExtraPointTDs, recXPCap)

	exact := clampRating(reliablePerf + tdImpact + xpImpact)
	final := round1(exact)

	res.Components = map[string]float64{
		"catch":        catch,
		"reception":    reception,
		"receiving_td": tdImpact,
		"extra_point":  xpImpact,
	}
	res.RawRating = raw
	res.ReliabilityFactor = reliability
	res.ExactRating = exact
	res.FinalRating = final
	return res
}

// ─── Defender (DEFENDER_RATING_V1.0) ─────────────────────────────────────────

// DefenderRatingInput is the stat line a defender rating is computed from.
type DefenderRatingInput struct {
	FlagPulls       int
	PassDeflections int
	Interceptions   int
	Safeties        int
	DefensiveTDs    int
	DefensiveXPTDs  int
	DefensiveSacks  int
}

// Defender formula weights / caps (spec §6).
const (
	defFlagPullPerUnit   = 0.15
	defFlagPullCap       = 1.20
	defDeflectionPerUnit = 0.35
	defDeflectionCap     = 1.40
	defIntPerUnit        = 1.40
	defIntCap            = 2.80
	defSafetyPerUnit     = 0.90
	defSafetyCap         = 1.80
	defTDPerUnit         = 1.20
	defTDCap             = 2.40
	defXPPerUnit         = 0.60
	defXPCap             = 1.20
	defSackPerUnit       = 0.50
	defSackCap           = 1.50
	defFullReliability   = 5.0 // defensive actions for full reliability
)

// CalculateDefenderRating implements DEFENDER_RATING_V1.0.
func CalculateDefenderRating(in DefenderRatingInput) RatingResult {
	actions := in.FlagPulls + in.PassDeflections + in.Interceptions +
		in.Safeties + in.DefensiveTDs + in.DefensiveXPTDs + in.DefensiveSacks

	res := RatingResult{
		FormulaVersion: DefenderFormulaVersion,
		Components:     map[string]float64{},
	}

	// Status by defensive actions (spec §4).
	switch {
	case actions == 0:
		res.Status = RatingStatusUnrated
		return res
	case actions == 1:
		res.Status = RatingStatusProvisional
	default:
		res.Status = RatingStatusOfficial
	}

	flagPull := capped(defFlagPullPerUnit, in.FlagPulls, defFlagPullCap)
	deflection := capped(defDeflectionPerUnit, in.PassDeflections, defDeflectionCap)
	interception := capped(defIntPerUnit, in.Interceptions, defIntCap)
	safety := capped(defSafetyPerUnit, in.Safeties, defSafetyCap)
	defensiveTD := capped(defTDPerUnit, in.DefensiveTDs, defTDCap)
	defensiveXP := capped(defXPPerUnit, in.DefensiveXPTDs, defXPCap)
	sack := capped(defSackPerUnit, in.DefensiveSacks, defSackCap)

	raw := ratingBaseline + flagPull + deflection + interception + safety + defensiveTD + defensiveXP + sack
	reliability := math.Min(1.0, float64(actions)/defFullReliability)

	res.Components = map[string]float64{
		"flag_pulls":       flagPull,
		"pass_deflections": deflection,
		"interceptions":    interception,
		"safeties":         safety,
		"defensive_tds":    defensiveTD,
		"defensive_xp_tds": defensiveXP,
		"defensive_sacks":  sack,
	}
	final, exact := finalise(raw, reliability)
	res.RawRating = raw
	res.ReliabilityFactor = reliability
	res.ExactRating = exact
	res.FinalRating = final
	return res
}

// ─── Rusher (RUSHER_RATING_V1.0) ─────────────────────────────────────────────

// RusherRatingInput is the stat line a rusher (pass-rusher) rating is computed
// from. DefensiveSacks maps to the player_stats `def_sacks` column.
type RusherRatingInput struct {
	DefensiveSacks  int
	Safeties        int
	PassDeflections int
	Interceptions   int
	DefensiveTDs    int
	DefensiveXPTDs  int
	FlagPulls       int
}

// Rusher formula weights / caps (spec §6). Sacks dominate; flag pulls are a
// minor supporting contribution (intentionally lower than the Defender rating).
const (
	rusSackPerUnit       = 0.90
	rusSackCap           = 3.00
	rusSafetyPerUnit     = 1.00
	rusSafetyCap         = 2.00
	rusDeflectionPerUnit = 0.40
	rusDeflectionCap     = 1.20
	rusIntPerUnit        = 1.00
	rusIntCap            = 2.00
	rusTDPerUnit         = 1.20
	rusTDCap             = 2.40
	rusXPPerUnit         = 0.60
	rusXPCap             = 1.20
	rusFlagPullPerUnit   = 0.10
	rusFlagPullCap       = 0.80
	rusFullReliability   = 4.0 // rusher actions for full reliability
)

// CalculateRusherRating implements RUSHER_RATING_V1.0.
func CalculateRusherRating(in RusherRatingInput) RatingResult {
	actions := in.DefensiveSacks + in.Safeties + in.PassDeflections +
		in.Interceptions + in.DefensiveTDs + in.DefensiveXPTDs + in.FlagPulls

	res := RatingResult{
		FormulaVersion: RusherFormulaVersion,
		Components:     map[string]float64{},
	}

	// Status (spec §4): OFFICIAL with at least 1 sack OR at least 2 actions;
	// PROVISIONAL for exactly 1 action and no sack; UNRATED for no actions.
	switch {
	case actions == 0:
		res.Status = RatingStatusUnrated
		return res
	case in.DefensiveSacks >= 1 || actions >= 2:
		res.Status = RatingStatusOfficial
	default:
		res.Status = RatingStatusProvisional
	}

	sack := capped(rusSackPerUnit, in.DefensiveSacks, rusSackCap)
	safety := capped(rusSafetyPerUnit, in.Safeties, rusSafetyCap)
	deflection := capped(rusDeflectionPerUnit, in.PassDeflections, rusDeflectionCap)
	interception := capped(rusIntPerUnit, in.Interceptions, rusIntCap)
	defensiveTD := capped(rusTDPerUnit, in.DefensiveTDs, rusTDCap)
	defensiveXP := capped(rusXPPerUnit, in.DefensiveXPTDs, rusXPCap)
	flagPull := capped(rusFlagPullPerUnit, in.FlagPulls, rusFlagPullCap)

	raw := ratingBaseline + sack + safety + deflection + interception + defensiveTD + defensiveXP + flagPull
	reliability := math.Min(1.0, float64(actions)/rusFullReliability)

	res.Components = map[string]float64{
		"defensive_sacks":  sack,
		"safeties":         safety,
		"pass_deflections": deflection,
		"interceptions":    interception,
		"defensive_tds":    defensiveTD,
		"defensive_xp_tds": defensiveXP,
		"flag_pulls":       flagPull,
	}
	final, exact := finalise(raw, reliability)
	res.RawRating = raw
	res.ReliabilityFactor = reliability
	res.ExactRating = exact
	res.FinalRating = final
	return res
}

// ─── Quarterback (QB_RATING_V1.3) ──────────────────────────────────────────

// QuarterbackRatingInput is the stat line a quarterback rating is computed from.
type QuarterbackRatingInput struct {
	PassingAttempts     int
	CompletedPasses     int
	PassingYards        int // optional / display only in v1.3
	PassingTDs          int
	InterceptionsThrown int
	QBSacks             int
	RushingAttempts     int
	RushingYards        int
	RushingTDs          int
	ExtraPointTDs       int
	OtherTurnovers      int
	UncatchablePasses   int
	ThrownAwayPasses    int
	BattedDownPasses    int
}

// Quarterback formula weights / benchmarks (QB_RATING_V1.3).
const (
	qbCompletionWeight    = 2.50
	qbCompletionBenchmark = 0.55 // neutral completion rate (55%)
	qbCompletionCap       = 1.00 // +/- 1.00 completion component cap
	qbFullReliability     = 6.0  // adjusted attempts for full reliability

	qbPassingTDPerUnit = 1.30
	qbPassingTDCap     = 5.20

	qbRushingTDPerUnit = 1.25
	qbRushingTDCap     = 2.50

	qbXPTDPerUnit = 0.40
	qbXPTDCap     = 1.20

	qbIntPerUnit = 1.00
	qbIntCap     = 3.00

	qbOtherTurnoverPerUnit = 1.00
	qbSackPerUnit          = 0.25
)

// CalculateQuarterbackRating implements QB_RATING_V1.3.
func CalculateQuarterbackRating(in QuarterbackRatingInput) RatingResult {
	res := RatingResult{
		FormulaVersion: QuarterbackFormulaVersion,
		Components:     map[string]float64{},
	}

	if in.PassingAttempts == 0 {
		res.Status = RatingStatusUnrated
		return res
	}

	// Status (Spec §4):
	// OFFICIAL: Game final and Passing Attempts >= 3
	// PROVISIONAL: Game final and Passing Attempts = 1 or 2
	if in.PassingAttempts >= 3 {
		res.Status = RatingStatusOfficial
	} else {
		res.Status = RatingStatusProvisional
	}

	// 1. Adjusted Passing Attempts (§5)
	// Adjusted Attempts = Passing Attempts - Uncatchable Passes - Throwaways - Batted Passes
	// Validation: Adjusted Attempts must be >= Completed Passes and >= Passing Touchdowns.
	adjustedAttempts := in.PassingAttempts
	exclusions := in.UncatchablePasses + in.ThrownAwayPasses + in.BattedDownPasses
	if exclusions > 0 {
		testAdj := in.PassingAttempts - exclusions
		if testAdj >= in.CompletedPasses && testAdj >= in.PassingTDs && testAdj > 0 {
			adjustedAttempts = testAdj
		}
	}

	// 2. Completion Component (§6)
	// Completion Rate = Completed Passes / Adjusted Attempts
	// Completion Component = CLAMP(-1.00, 1.00, 2.50 * (Completion Rate - 0.55))
	completionRate := float64(in.CompletedPasses) / float64(adjustedAttempts)
	completionComp := math.Max(-qbCompletionCap, math.Min(qbCompletionCap, qbCompletionWeight*(completionRate-qbCompletionBenchmark)))

	// 3. Reliability Adjustment (§7)
	// Reliability = MIN(1.0, Adjusted Attempts / 6)
	// Reliable Performance Rating = 5.0 + (Completion Component * Reliability)
	reliability := math.Min(1.0, float64(adjustedAttempts)/qbFullReliability)
	reliablePerf := ratingBaseline + (completionComp * reliability)
	rawPerf := ratingBaseline + completionComp

	// 4. Direct Game-Impact Components (§8)
	passingTDImpact := capped(qbPassingTDPerUnit, in.PassingTDs, qbPassingTDCap)
	rushingTDImpact := capped(qbRushingTDPerUnit, in.RushingTDs, qbRushingTDCap)
	xpTDImpact := capped(qbXPTDPerUnit, in.ExtraPointTDs, qbXPTDCap)
	positiveImpact := passingTDImpact + rushingTDImpact + xpTDImpact

	interceptionPenalty := capped(qbIntPerUnit, in.InterceptionsThrown, qbIntCap)
	otherTurnoverPenalty := qbOtherTurnoverPerUnit * float64(in.OtherTurnovers)
	qbSackPenalty := qbSackPerUnit * float64(in.QBSacks)
	negativeImpact := interceptionPenalty + otherTurnoverPenalty + qbSackPenalty

	// 5. Final Calculation (§9)
	exact := clampRating(reliablePerf + positiveImpact - negativeImpact)
	final := round1(exact)

	res.Components = map[string]float64{
		"completion":         completionComp,
		"passing_touchdowns": passingTDImpact,
		"rushing_touchdowns": rushingTDImpact,
		"extra_point_td":     xpTDImpact,
		"interceptions":      -interceptionPenalty,
		"other_turnovers":    -otherTurnoverPenalty,
		"qb_sacks":           -qbSackPenalty,
	}
	res.RawRating = rawPerf
	res.ReliabilityFactor = reliability
	res.ExactRating = exact
	res.FinalRating = final
	return res
}

// ─── All Rounder (ALL_ROUNDER_RATING_V1.0) ──────────────────────────────────

// AllRounderRoleInput represents the data for a single role (QB, REC, DEF, RUSH)
// fed into the All-Rounder aggregator.
type AllRounderRoleInput struct {
	Activity    int
	RatingExact float64
	DataState   string // "VALID", "NO_ACTIVITY"
}

// AllRounderRatingInput contains the role inputs keyed by role name ("QB", "REC", "DEF", "RUSH").
type AllRounderRatingInput struct {
	Roles map[string]AllRounderRoleInput
}

// All-Rounder formula parameters (ALL_ROUNDER_RATING_V1.0 §2 & §7).
const (
	arQBThreshold   = 6
	arRECThreshold  = 4
	arDEFThreshold  = 5
	arRUSHThreshold = 3
	arBonusPerRole  = 0.25
)

// CalculateAllRounderRating implements ALL_ROUNDER_RATING_V1.0.
func CalculateAllRounderRating(in AllRounderRatingInput) RatingResult {
	res := RatingResult{
		FormulaVersion: AllRounderFormulaVersion,
		Components:     map[string]float64{},
	}

	thresholds := map[string]int{
		"QB":   arQBThreshold,
		"REC":  arRECThreshold,
		"DEF":  arDEFThreshold,
		"RUSH": arRUSHThreshold,
	}

	type activeRole struct {
		rating    float64
		activity  int
		weight    float64
		impact    float64
		qualifies bool
	}

	active := make(map[string]activeRole)
	for key, threshold := range thresholds {
		role, ok := in.Roles[key]
		if !ok || role.DataState == "NO_ACTIVITY" || role.Activity <= 0 {
			continue
		}
		weight := math.Min(1.0, float64(role.Activity)/float64(threshold))
		qualifies := (2*role.Activity >= threshold) && (role.RatingExact >= 5.0)
		impact := (role.RatingExact - 5.0) * weight
		active[key] = activeRole{
			rating:    role.RatingExact,
			activity:  role.Activity,
			weight:    weight,
			impact:    impact,
			qualifies: qualifies,
		}
	}

	if len(active) == 0 {
		res.Status = RatingStatusUnrated
		res.FinalRating = 0.0
		res.ExactRating = 0.0
		return res
	}

	var totalWeight, totalImpact float64
	var qualifying int
	for key, r := range active {
		totalWeight += r.weight
		totalImpact += r.impact
		if r.qualifies {
			qualifying++
		}
		res.Components[strings.ToLower(key)+"_weight"] = r.weight
		res.Components[strings.ToLower(key)+"_impact"] = r.impact
	}

	var base float64
	if len(active) == 1 {
		// With one active position, its weight cancels and the base equals that position's exact rating.
		for _, r := range active {
			base = r.rating
		}
	} else {
		base = 5.0 + (totalImpact / totalWeight)
	}

	var bonus float64
	if qualifying >= 2 {
		bonus = arBonusPerRole * float64(qualifying-1)
	}

	bounded := math.Max(0.0, math.Min(10.0, base+bonus))
	final := round1(bounded)

	switch {
	case len(active) == 1:
		res.Status = RatingStatusSingleRole
	case qualifying >= 2:
		res.Status = RatingStatusOfficial
	default:
		res.Status = RatingStatusProvisional
	}

	res.RawRating = base
	res.Components["total_weight"] = totalWeight
	res.Components["base_rating"] = base
	res.Components["versatility_bonus"] = bonus
	res.Components["qualifying_roles"] = float64(qualifying)
	res.ExactRating = bounded
	res.FinalRating = final
	return res
}
