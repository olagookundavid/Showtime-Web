package domain

import (
	"math"
	"sort"
)

// The opening economy.
//
// A price is not a rating. A rating judges how well someone played; a price is
// what a manager pays for the fantasy points they are likely to produce. A
// receiver with a superb catch rate on four receptions rates highly and scores
// almost nothing, so pricing reads points per game, not the rating engine.
//
// Every number below is deliberate. The floor and ceiling set how far apart the
// cheapest and dearest player can be, and that ratio — not the budget on its
// own — is what forces a manager to choose.
const (
	// PriceFloor is the least any player can cost. Without one, a poorly rated
	// player is close to free and a squad can be padded for nothing.
	PriceFloor = 3.0
	// PriceCeiling is the most any player can cost. Floor to ceiling is a 4.2×
	// spread, which is what makes the budget bind.
	PriceCeiling = 12.5
	// PriceIncrement is the step prices are rounded to.
	PriceIncrement = 0.5
	// PriceCurveExponent skews prices towards the floor. An index spread evenly
	// over 0–1 averages 1/(1+exponent) = 0.4 once raised to this power, so the
	// median price sits near the per-player budget allowance rather than at the
	// midpoint of the range. Expensive players stay scarce.
	PriceCurveExponent = 1.5

	// PerformanceWeight and AvailabilityWeight split the composite index.
	// Performance dominates; availability stops a one-good-game player being
	// priced like someone who turned up all season.
	PerformanceWeight  = 0.85
	AvailabilityWeight = 0.15

	// MinPricingAppearances is the sample below which no performance price is
	// assigned. Fewer games than this and the player sits at the floor: unknown,
	// and therefore cheap, rather than unknown and priced as average.
	MinPricingAppearances = 3
	// FullSeasonAppearances is the games count that counts as full availability.
	FullSeasonAppearances = 9

	// MaxPriceMovePerGameweek caps ordinary movement between gamedays. Since a
	// sale pays the market price, an uncapped swing is money a manager can farm
	// by buying before a rise and selling after it.
	MaxPriceMovePerGameweek = 1.0
)

// PricingInput is one player's season to date, as pricing sees them.
type PricingInput struct {
	PlayerID string
	Position string
	Games    int
	// Points is the fantasy points they have scored all season, using the same
	// weights the game scores with.
	Points float64
	// PreviousPrice is last gameday's published price, or 0 on the first run.
	PreviousPrice float64
}

// PricedPlayer is the result, with the workings kept so a manager asking "why
// does he cost that" can be answered.
type PricedPlayer struct {
	PlayerID string
	Price    float64

	Games           int
	PointsPerGame   float64
	Percentile      float64
	Availability    float64
	Index           float64
	AtFloor         bool
	MovementLimited bool
}

// RoundToIncrement rounds to the nearest PriceIncrement.
func RoundToIncrement(v float64) float64 {
	return math.Round(v/PriceIncrement) * PriceIncrement
}

// PriceFromIndex converts a 0–1 composite index into money.
func PriceFromIndex(index float64) float64 {
	if index < 0 {
		index = 0
	}
	if index > 1 {
		index = 1
	}
	raw := PriceFloor + (PriceCeiling-PriceFloor)*math.Pow(index, PriceCurveExponent)
	return clampPrice(RoundToIncrement(raw))
}

func clampPrice(p float64) float64 {
	if p < PriceFloor {
		return PriceFloor
	}
	if p > PriceCeiling {
		return PriceCeiling
	}
	return p
}

// applyMovementCap holds a price within MaxPriceMovePerGameweek of the last one
// published. A previous price of 0 means this is the opening price, which is
// free to land anywhere.
func applyMovementCap(target, previous float64) (float64, bool) {
	if previous <= 0 {
		return target, false
	}
	if diff := target - previous; diff > MaxPriceMovePerGameweek {
		return clampPrice(RoundToIncrement(previous + MaxPriceMovePerGameweek)), true
	} else if diff < -MaxPriceMovePerGameweek {
		return clampPrice(RoundToIncrement(previous - MaxPriceMovePerGameweek)), true
	}
	return target, false
}

// PriceSeason prices every player in one pass.
//
// Performance is measured as a percentile against the player's own position,
// not on an absolute scale. Positions are scored by different formulas over
// different events, so an absolute comparison would make a whole position
// systematically cheap and nobody would notice — there would be nothing to
// compare it against. A percentile guarantees each position spans the full
// range: the best defender costs what the best receiver costs.
func PriceSeason(inputs []PricingInput) []PricedPlayer {
	// Only players with a real sample set the scale. Including everyone would
	// let the large block of unproven players drag the percentiles, making an
	// average performer look elite by comparison.
	eligibleByPosition := map[string][]float64{}
	for _, in := range inputs {
		if in.Games >= MinPricingAppearances {
			eligibleByPosition[in.Position] = append(eligibleByPosition[in.Position], pointsPerGame(in))
		}
	}
	for pos := range eligibleByPosition {
		sort.Float64s(eligibleByPosition[pos])
	}

	out := make([]PricedPlayer, 0, len(inputs))
	for _, in := range inputs {
		p := PricedPlayer{
			PlayerID:      in.PlayerID,
			Games:         in.Games,
			PointsPerGame: pointsPerGame(in),
		}

		if in.Games < MinPricingAppearances {
			// Not enough evidence to price on. The floor is the honest answer:
			// cheap because unknown, which makes them a punt rather than dead
			// money at mid-price.
			p.AtFloor = true
			p.Price = PriceFloor
		} else {
			p.Percentile = percentileOf(eligibleByPosition[in.Position], p.PointsPerGame)
			p.Availability = math.Min(1, float64(in.Games)/FullSeasonAppearances)
			p.Index = PerformanceWeight*p.Percentile + AvailabilityWeight*p.Availability
			p.Price = PriceFromIndex(p.Index)
		}

		p.Price, p.MovementLimited = applyMovementCap(p.Price, in.PreviousPrice)
		out = append(out, p)
	}
	return out
}

func pointsPerGame(in PricingInput) float64 {
	if in.Games <= 0 {
		return 0
	}
	return in.Points / float64(in.Games)
}

// percentileOf is the share of the sorted peer group at or below v. A lone
// eligible player in a position scores 1.0 — with no one to compare against,
// they are the best there is at it.
func percentileOf(sorted []float64, v float64) float64 {
	if len(sorted) == 0 {
		return 0
	}
	if len(sorted) == 1 {
		return 1
	}
	// Count strictly-below plus half of the ties, so equal players share a rank
	// rather than one of them arbitrarily out-ranking the other.
	below, equal := 0, 0
	for _, s := range sorted {
		if s < v {
			below++
		} else if s == v {
			equal++
		}
	}
	return (float64(below) + float64(equal)/2) / float64(len(sorted))
}
