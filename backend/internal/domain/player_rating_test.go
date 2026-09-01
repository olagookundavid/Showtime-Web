package domain

import (
	"math"
	"testing"
)

const ratingEps = 1e-9

func approx(a, b float64) bool { return math.Abs(a-b) < ratingEps }

func TestCalculateReceiverRating(t *testing.T) {
	cases := []struct {
		name       string
		in         ReceiverRatingInput
		wantStatus string
		wantFinal  float64
	}{
		{
			// Spec §9 Worked Example: 1 reception, 1 receiving TD, 1 drop (2 opportunities).
			// catch -0.625, reception +0.200 => raw 4.575, rel 0.40 => reliable 4.830
			// tdImpact +2.25 => final 7.1
			name: "spec v1.1 worked example", in: ReceiverRatingInput{Receptions: 1, ReceivingTDs: 1, Drops: 1},
			wantStatus: RatingStatusOfficial, wantFinal: 7.1,
		},
		{
			// 4 catches / 5 opportunities, 1 TD.
			// catch = 2.50 * (0.80 - 0.75) = +0.125, reception = +0.80 => raw 5.925, rel 1.0
			// tdImpact +2.25 => final 8.2
			name: "official mixed", in: ReceiverRatingInput{Receptions: 4, ReceivingTDs: 1, Drops: 1},
			wantStatus: RatingStatusOfficial, wantFinal: 8.2,
		},
		{
			// Caps: reception cap 1.00, recTD cap 4.50, xp cap 1.20. catch .625.
			// raw = 5 + 1.00 + .625 = 6.625, rel 1.0 => + 4.50 + 1.20 = 12.325 => clamped to 10.0
			name: "caps applied", in: ReceiverRatingInput{Receptions: 10, ReceivingTDs: 3, ExtraPointTDs: 3},
			wantStatus: RatingStatusOfficial, wantFinal: 10.0,
		},
		{
			// 1 opportunity => provisional, reliability 0.20
			name: "provisional one catch", in: ReceiverRatingInput{Receptions: 1},
			wantStatus: RatingStatusProvisional, wantFinal: 5.2,
		},
		{
			name: "provisional one drop", in: ReceiverRatingInput{Drops: 1},
			wantStatus: RatingStatusProvisional, wantFinal: 4.6,
		},
		{
			name: "unrated", in: ReceiverRatingInput{},
			wantStatus: RatingStatusUnrated, wantFinal: 0.0,
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := CalculateReceiverRating(c.in)
			if got.Status != c.wantStatus {
				t.Errorf("status = %q, want %q", got.Status, c.wantStatus)
			}
			if !approx(got.FinalRating, c.wantFinal) {
				t.Errorf("final = %v, want %v", got.FinalRating, c.wantFinal)
			}
			if got.FormulaVersion != ReceiverFormulaVersion {
				t.Errorf("formula version = %q, want %q", got.FormulaVersion, ReceiverFormulaVersion)
			}
		})
	}
}

func TestCalculateDefenderRating(t *testing.T) {
	cases := []struct {
		name       string
		in         DefenderRatingInput
		wantStatus string
		wantFinal  float64
		wantRaw    float64
		wantRel    float64
		checkRaw   bool
		checkRel   bool
	}{
		{
			// 3 flag pulls + 1 deflection + 1 INT (5 actions).
			// .45 + .35 + 1.40 => raw 7.20, rel 1.0. (Spec's sample response is
			// internally inconsistent; this is the formula-correct value.)
			name: "official mixed", in: DefenderRatingInput{FlagPulls: 3, PassDeflections: 1, Interceptions: 1},
			wantStatus: RatingStatusOfficial, wantFinal: 7.2, wantRaw: 7.2, wantRel: 1.0, checkRaw: true, checkRel: true,
		},
		{
			// 3 INTs: cap 2.80, 3 actions => reliability 0.60.
			// adjusted = 5 + 2.80*0.60 = 6.68
			name: "int cap and partial reliability", in: DefenderRatingInput{Interceptions: 3},
			wantStatus: RatingStatusOfficial, wantFinal: 6.7, wantRaw: 7.8, wantRel: 0.6, checkRaw: true, checkRel: true,
		},
		{
			name: "provisional one flag pull", in: DefenderRatingInput{FlagPulls: 1},
			wantStatus: RatingStatusProvisional, wantFinal: 5.0, wantRel: 0.2, checkRel: true,
		},
		{
			name: "unrated", in: DefenderRatingInput{},
			wantStatus: RatingStatusUnrated, wantFinal: 0.0,
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := CalculateDefenderRating(c.in)
			if got.Status != c.wantStatus {
				t.Errorf("status = %q, want %q", got.Status, c.wantStatus)
			}
			if !approx(got.FinalRating, c.wantFinal) {
				t.Errorf("final = %v, want %v", got.FinalRating, c.wantFinal)
			}
			if c.checkRaw && !approx(got.RawRating, c.wantRaw) {
				t.Errorf("raw = %v, want %v", got.RawRating, c.wantRaw)
			}
			if c.checkRel && !approx(got.ReliabilityFactor, c.wantRel) {
				t.Errorf("reliability = %v, want %v", got.ReliabilityFactor, c.wantRel)
			}
		})
	}
}

func TestCalculateRusherRating(t *testing.T) {
	cases := []struct {
		name       string
		in         RusherRatingInput
		wantStatus string
		wantFinal  float64
		wantRaw    float64
		checkRaw   bool
	}{
		{
			// The Rusher spec's sample response IS formula-consistent: 2 sacks,
			// 1 safety, 1 deflection, 1 flag pull => raw 8.30, rel 1.0 => 8.3.
			name: "spec sample 8.3", in: RusherRatingInput{DefensiveSacks: 2, Safeties: 1, PassDeflections: 1, FlagPulls: 1},
			wantStatus: RatingStatusOfficial, wantFinal: 8.3, wantRaw: 8.3, checkRaw: true,
		},
		{
			// Sack cap 3.00 (5 sacks would be 4.50), full reliability at 4 actions.
			name: "sack cap", in: RusherRatingInput{DefensiveSacks: 5},
			wantStatus: RatingStatusOfficial, wantFinal: 8.0, wantRaw: 8.0, checkRaw: true,
		},
		{
			// Official via >=2 actions with no sack: 2 deflections => .80, rel 0.50.
			// adjusted = 5 + 0.80*0.50 = 5.40
			name: "official two actions no sack", in: RusherRatingInput{PassDeflections: 2},
			wantStatus: RatingStatusOfficial, wantFinal: 5.4,
		},
		{
			// Exactly 1 action, no sack => provisional.
			name: "provisional one flag pull", in: RusherRatingInput{FlagPulls: 1},
			wantStatus: RatingStatusProvisional, wantFinal: 5.0,
		},
		{
			// 1 sack => OFFICIAL even though only 1 action.
			name: "official one sack", in: RusherRatingInput{DefensiveSacks: 1},
			wantStatus: RatingStatusOfficial, wantFinal: 5.2, // raw 5.90, rel 0.25 => 5.225
		},
		{
			// Everything maxed => clamps to 10.0.
			name: "clamp to ten", in: RusherRatingInput{DefensiveSacks: 3, Safeties: 2, PassDeflections: 3, Interceptions: 2, DefensiveTDs: 2, DefensiveXPTDs: 2, FlagPulls: 8},
			wantStatus: RatingStatusOfficial, wantFinal: 10.0,
		},
		{
			name: "unrated", in: RusherRatingInput{},
			wantStatus: RatingStatusUnrated, wantFinal: 0.0,
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := CalculateRusherRating(c.in)
			if got.Status != c.wantStatus {
				t.Errorf("status = %q, want %q", got.Status, c.wantStatus)
			}
			if !approx(got.FinalRating, c.wantFinal) {
				t.Errorf("final = %v, want %v", got.FinalRating, c.wantFinal)
			}
			if c.checkRaw && !approx(got.RawRating, c.wantRaw) {
				t.Errorf("raw = %v, want %v", got.RawRating, c.wantRaw)
			}
		})
	}
}

func TestCalculateQuarterbackRating(t *testing.T) {
	cases := []struct {
		name       string
		in         QuarterbackRatingInput
		wantStatus string
		wantFinal  float64
		wantRaw    float64
		wantRel    float64
		checkRaw   bool
		checkRel   bool
	}{
		{
			// Spec §11 Worked Example (Disputed 4.2 performance resolved to 7.5):
			// 21 attempts, 8 completions, 3 pass TDs, 1 INT, 0 sacks, 0 rush, 0 exclusions.
			// completionRate = 8/21 = 0.380952 => compComp = 2.50*(0.380952-0.55) = -0.422619
			// rawPerf = 5.0 - 0.422619 = 4.577381, rel = 1.0 => reliablePerf = 4.577381
			// passTD = 3.90, INT = -1.00 => final = 7.477381 => 7.5
			name: "spec v1.3 worked example",
			in: QuarterbackRatingInput{
				PassingAttempts:     21,
				CompletedPasses:     8,
				PassingTDs:          3,
				InterceptionsThrown: 1,
			},
			wantStatus: RatingStatusOfficial,
			wantFinal:  7.5,
			wantRaw:    4.5773809523809525,
			wantRel:    1.0,
			checkRaw:   true,
			checkRel:   true,
		},
		{
			// Spec §12 Calibration 1: 8/21, 3 pass TD, 0 INT, 0 sacks => 8.5
			name: "calibration 8/21 3 TD 0 INT",
			in: QuarterbackRatingInput{
				PassingAttempts:     21,
				CompletedPasses:     8,
				PassingTDs:          3,
				InterceptionsThrown: 0,
			},
			wantStatus: RatingStatusOfficial,
			wantFinal:  8.5,
		},
		{
			// Spec §12 Calibration 2: 8/21, 3 pass TD, 2 INT, 0 sacks => 6.5
			name: "calibration 8/21 3 TD 2 INT",
			in: QuarterbackRatingInput{
				PassingAttempts:     21,
				CompletedPasses:     8,
				PassingTDs:          3,
				InterceptionsThrown: 2,
			},
			wantStatus: RatingStatusOfficial,
			wantFinal:  6.5,
		},
		{
			// Spec §12 Calibration 3: 19/27, 4 pass TD, 0 INT, 0 sacks => 10.0 (clamped from 10.6)
			name: "calibration 19/27 4 TD 0 INT",
			in: QuarterbackRatingInput{
				PassingAttempts:     27,
				CompletedPasses:     19,
				PassingTDs:          4,
				InterceptionsThrown: 0,
			},
			wantStatus: RatingStatusOfficial,
			wantFinal:  10.0,
		},
		{
			// Spec §12 Calibration 4: 3/6, 0 TD, 0 INT, 0 sacks => 4.9
			name: "calibration 3/6 0 TD 0 INT",
			in: QuarterbackRatingInput{
				PassingAttempts:     6,
				CompletedPasses:     3,
				PassingTDs:          0,
				InterceptionsThrown: 0,
			},
			wantStatus: RatingStatusOfficial,
			wantFinal:  4.9,
		},
		{
			// Spec §12 Calibration 5: 0 attempts => UNRATED, 0.0
			name:       "calibration 0 attempts unrated",
			in:         QuarterbackRatingInput{},
			wantStatus: RatingStatusUnrated,
			wantFinal:  0.0,
		},
		{
			// Provisional rating with 1 or 2 attempts
			// 1 attempt, 1 completion (100%): compComp = 2.50*(1.0 - 0.55) = +1.0 (capped at 1.0)
			// raw = 6.0, rel = 1/6 = 0.166667 => reliable = 5.0 + 1.0 * 0.166667 = 5.1667 => 5.2
			name: "provisional 1 attempt 1 comp",
			in: QuarterbackRatingInput{
				PassingAttempts: 1,
				CompletedPasses: 1,
			},
			wantStatus: RatingStatusProvisional,
			wantFinal:  5.2,
		},
		{
			// Adjusted attempts with valid exclusions:
			// 10 attempts, 2 throwaways, 1 batted = 7 adjusted attempts.
			// 5 completions / 7 adj attempts = 71.4%
			name: "adjusted attempts exclusions",
			in: QuarterbackRatingInput{
				PassingAttempts:   10,
				CompletedPasses:   5,
				ThrownAwayPasses:  2,
				BattedDownPasses:  1,
				PassingTDs:        1,
			},
			wantStatus: RatingStatusOfficial,
			wantFinal:  6.7, // 5.0 + 2.5*(5/7-0.55)*1.0 + 1.3 = 5.0 + 0.4107 + 1.3 = 6.71 => 6.7
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			res := CalculateQuarterbackRating(c.in)
			if res.Status != c.wantStatus {
				t.Errorf("status = %q, want %q", res.Status, c.wantStatus)
			}
			if !approx(res.FinalRating, c.wantFinal) {
				t.Errorf("final_rating = %v, want %v", res.FinalRating, c.wantFinal)
			}
			if c.checkRaw && !approx(res.RawRating, c.wantRaw) {
				t.Errorf("raw_rating = %v, want %v", res.RawRating, c.wantRaw)
			}
			if c.checkRel && !approx(res.ReliabilityFactor, c.wantRel) {
				t.Errorf("reliability = %v, want %v", res.ReliabilityFactor, c.wantRel)
			}
			if res.FormulaVersion != QuarterbackFormulaVersion {
				t.Errorf("formula version = %q, want %q", res.FormulaVersion, QuarterbackFormulaVersion)
			}
		})
	}
}
