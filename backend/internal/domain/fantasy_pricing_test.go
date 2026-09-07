package domain

import (
	"math"
	"testing"
)

func TestPriceFromIndex(t *testing.T) {
	cases := []struct {
		name  string
		index float64
		want  float64
	}{
		{"the worst eligible player sits at the floor", 0, PriceFloor},
		{"the best sits at the ceiling", 1, PriceCeiling},
		// The curve is the point: a mid-table player is priced well below the
		// midpoint of the range, which is what keeps expensive players scarce.
		{"the midpoint prices below the middle of the range", 0.5, 6.5},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := PriceFromIndex(c.index); got != c.want {
				t.Errorf("index %.2f: want %.2f, got %.2f", c.index, c.want, got)
			}
		})
	}

	t.Run("never escapes the floor or the ceiling", func(t *testing.T) {
		for _, idx := range []float64{-5, -0.01, 1.01, 99} {
			p := PriceFromIndex(idx)
			if p < PriceFloor || p > PriceCeiling {
				t.Errorf("index %.2f produced %.2f, outside [%.2f, %.2f]", idx, p, PriceFloor, PriceCeiling)
			}
		}
	})

	t.Run("always lands on an increment", func(t *testing.T) {
		for i := 0; i <= 100; i++ {
			p := PriceFromIndex(float64(i) / 100)
			if math.Abs(p/PriceIncrement-math.Round(p/PriceIncrement)) > 1e-9 {
				t.Errorf("index %.2f produced %.3f, not a multiple of %.2f", float64(i)/100, p, PriceIncrement)
			}
		}
	})
}

func TestPriceSeason(t *testing.T) {
	// Two positions with different scoring scales. Defenders score far fewer
	// raw points than receivers here, which is exactly the case an absolute
	// price scale gets wrong.
	inputs := []PricingInput{
		{PlayerID: "rec_best", Position: "Receiver", Games: 9, Points: 90},
		{PlayerID: "rec_mid", Position: "Receiver", Games: 9, Points: 45},
		{PlayerID: "rec_worst", Position: "Receiver", Games: 9, Points: 9},
		{PlayerID: "def_best", Position: "Defender", Games: 9, Points: 18},
		{PlayerID: "def_mid", Position: "Defender", Games: 9, Points: 9},
		{PlayerID: "def_worst", Position: "Defender", Games: 9, Points: 2},
	}
	priced := map[string]PricedPlayer{}
	for _, p := range PriceSeason(inputs) {
		priced[p.PlayerID] = p
	}

	t.Run("each position spans the full range", func(t *testing.T) {
		// The best defender scores a fifth of what the best receiver does, and
		// must still command a top price. On an absolute scale every defender
		// would be cheap forever.
		if priced["def_best"].Price != priced["rec_best"].Price {
			t.Errorf("the best of each position should cost the same: receiver %.2f, defender %.2f",
				priced["rec_best"].Price, priced["def_best"].Price)
		}
		if priced["def_best"].Price <= priced["def_mid"].Price {
			t.Error("the best defender must cost more than an average one")
		}
	})

	t.Run("under the appearance threshold everyone sits at the floor", func(t *testing.T) {
		short := PriceSeason([]PricingInput{
			{PlayerID: "one_great_game", Position: "Receiver", Games: 1, Points: 40},
		})
		if !short[0].AtFloor || short[0].Price != PriceFloor {
			t.Errorf("a %d-game player must be priced at the floor, got %.2f", 1, short[0].Price)
		}
	})

	t.Run("availability separates equal scorers", func(t *testing.T) {
		got := PriceSeason([]PricingInput{
			{PlayerID: "ever_present", Position: "Rusher", Games: 9, Points: 45},
			{PlayerID: "half_season", Position: "Rusher", Games: 4, Points: 20},
			{PlayerID: "filler", Position: "Rusher", Games: 9, Points: 10},
		})
		var ever, half PricedPlayer
		for _, p := range got {
			switch p.PlayerID {
			case "ever_present":
				ever = p
			case "half_season":
				half = p
			}
		}
		// Both average 5 points a game; only the games played differ.
		if math.Abs(ever.PointsPerGame-half.PointsPerGame) > 1e-9 {
			t.Fatalf("test setup: expected equal points per game, got %.3f and %.3f",
				ever.PointsPerGame, half.PointsPerGame)
		}
		if ever.Price <= half.Price {
			t.Errorf("the ever-present player should cost more: %.2f vs %.2f", ever.Price, half.Price)
		}
	})
}

func TestMovementCap(t *testing.T) {
	t.Run("a rise is capped", func(t *testing.T) {
		got := PriceSeason([]PricingInput{
			{PlayerID: "riser", Position: "QB", Games: 9, Points: 90, PreviousPrice: 5.0},
		})
		if got[0].Price > 5.0+MaxPriceMovePerGameweek {
			t.Errorf("a rise from 5.00 must stop at %.2f, got %.2f", 5.0+MaxPriceMovePerGameweek, got[0].Price)
		}
		if !got[0].MovementLimited {
			t.Error("expected the cap to be reported")
		}
	})

	t.Run("a fall is capped", func(t *testing.T) {
		got := PriceSeason([]PricingInput{
			{PlayerID: "faller", Position: "QB", Games: 1, Points: 0, PreviousPrice: 11.0},
		})
		if got[0].Price < 11.0-MaxPriceMovePerGameweek {
			t.Errorf("a fall from 11.00 must stop at %.2f, got %.2f", 11.0-MaxPriceMovePerGameweek, got[0].Price)
		}
	})

	t.Run("the opening price is uncapped", func(t *testing.T) {
		got := PriceSeason([]PricingInput{
			{PlayerID: "opening", Position: "QB", Games: 9, Points: 90, PreviousPrice: 0},
		})
		if got[0].MovementLimited {
			t.Error("an opening price has nothing to move from and must not be capped")
		}
	})

	// The cap is the brake on farming a price swing, so it must hold the price
	// inside the legal range too.
	t.Run("capping never escapes the range", func(t *testing.T) {
		got := PriceSeason([]PricingInput{
			{PlayerID: "edge", Position: "QB", Games: 1, Points: 0, PreviousPrice: PriceFloor},
		})
		if got[0].Price < PriceFloor {
			t.Errorf("capped price %.2f fell below the floor", got[0].Price)
		}
	})
}
