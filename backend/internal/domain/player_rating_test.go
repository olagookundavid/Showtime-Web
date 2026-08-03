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
		wantRaw    float64 // only checked when checkRaw
		wantRel    float64 // only checked when checkRel
		checkRaw   bool
		checkRel   bool
	}{
		{
			// 4 catches / 5 opportunities, 1 TD, 1 drop.
			// reception .80 + catch .125 + recTD .75 - drop .60 => raw 6.075, rel 1.0
			name: "official mixed", in: ReceiverRatingInput{Receptions: 4, ReceivingTDs: 1, Drops: 1},
			wantStatus: RatingStatusOfficial, wantFinal: 6.1, wantRaw: 6.075, wantRel: 1.0, checkRaw: true, checkRel: true,
		},
		{
			// Caps: reception cap 1.00, recTD cap 2.25, xp cap 1.05. catch .625.
			// raw = 5 + 1.00 + .625 + 2.25 + 1.05 = 9.925
			name: "caps applied", in: ReceiverRatingInput{Receptions: 10, ReceivingTDs: 3, ExtraPointTDs: 3},
			wantStatus: RatingStatusOfficial, wantFinal: 9.9, wantRaw: 9.925, checkRaw: true,
		},
		{
			// All drops: catch -1.875, drop cap 2.40 => raw 0.725
			name: "heavy drops floor", in: ReceiverRatingInput{Drops: 5},
			wantStatus: RatingStatusOfficial, wantFinal: 0.7, wantRaw: 0.725, checkRaw: true,
		},
		{
			// 1 opportunity => provisional, reliability 0.20
			name: "provisional one catch", in: ReceiverRatingInput{Receptions: 1},
			wantStatus: RatingStatusProvisional, wantFinal: 5.2, wantRel: 0.2, checkRel: true,
		},
		{
			name: "provisional one drop", in: ReceiverRatingInput{Drops: 1},
			wantStatus: RatingStatusProvisional, wantFinal: 4.5,
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
			if c.checkRaw && !approx(got.RawRating, c.wantRaw) {
				t.Errorf("raw = %v, want %v", got.RawRating, c.wantRaw)
			}
			if c.checkRel && !approx(got.ReliabilityFactor, c.wantRel) {
				t.Errorf("reliability = %v, want %v", got.ReliabilityFactor, c.wantRel)
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
