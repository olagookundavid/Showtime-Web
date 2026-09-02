package domain

import (
	"math"
	"testing"
)

func TestFantasyScoring(t *testing.T) {
	weights := FantasyWeights{}

	t.Run("5 flag pulls equals 1 deflection (0.250 pts)", func(t *testing.T) {
		pullsStat := PlayerStat{FlagPulls: 5}
		pullsScore := weights.Calculate(pullsStat)
		if math.Abs(pullsScore.DefensiveTotal-0.250) > 0.0001 {
			t.Errorf("expected 0.250 for 5 pulls, got %f", pullsScore.DefensiveTotal)
		}

		deflStat := PlayerStat{PassDeflections: 1}
		deflScore := weights.Calculate(deflStat)
		if math.Abs(deflScore.DefensiveTotal-0.250) > 0.0001 {
			t.Errorf("expected 0.250 for 1 deflection, got %f", deflScore.DefensiveTotal)
		}
	})

	t.Run("Pick-Six (INT + TD) earns 3.250 pts", func(t *testing.T) {
		stat := PlayerStat{
			Interceptions: 1,
			DefensiveTDs:  1,
		}
		score := weights.Calculate(stat)
		if math.Abs(score.NetTotal-3.250) > 0.0001 {
			t.Errorf("expected 3.250 for pick-six, got %f", score.NetTotal)
		}
	})

	t.Run("Safeties conceded has 0 penalty", func(t *testing.T) {
		stat := PlayerStat{SafetyConceded: 3}
		score := weights.Calculate(stat)
		if score.NetTotal != 0.0 {
			t.Errorf("expected 0.0 penalty for safety conceded, got %f", score.NetTotal)
		}
	})

	t.Run("Negative offensive score not clamped", func(t *testing.T) {
		stat := PlayerStat{Drops: 2}
		score := weights.Calculate(stat)
		if math.Abs(score.NetTotal-(-0.500)) > 0.0001 {
			t.Errorf("expected -0.500 for 2 drops, got %f", score.NetTotal)
		}
	})

	t.Run("Developer spec worked example: Defender", func(t *testing.T) {
		// 10 pulls + 2 deflections + 1 interception = 0.500 + 0.500 + 1.250 = 2.250
		stat := PlayerStat{
			FlagPulls:       10,
			PassDeflections: 2,
			Interceptions:   1,
		}
		score := weights.Calculate(stat)
		if math.Abs(score.NetTotal-2.250) > 0.0001 {
			t.Errorf("expected 2.250, got %f", score.NetTotal)
		}
	})

	t.Run("Developer spec worked example: Receiver", func(t *testing.T) {
		// 5 catches (1.250) + 80 yards (2.000) + 1 TD (2.000) - 2 drops (-0.500) = 4.750
		stat := PlayerStat{
			Receptions:     5,
			ReceivingYards: 80,
			ReceivingTDs:   1,
			Drops:          2,
		}
		score := weights.Calculate(stat)
		if math.Abs(score.NetTotal-4.750) > 0.0001 {
			t.Errorf("expected 4.750, got %f", score.NetTotal)
		}
	})

	t.Run("Dynamic pricing formula", func(t *testing.T) {
		p1 := CalculatePlayerPrice(10.0, 5.0)
		if math.Abs(p1-10.0) > 0.0001 {
			t.Errorf("expected 10.0, got %f", p1)
		}
		p2 := CalculatePlayerPrice(10.0, 7.5)
		if math.Abs(p2-15.0) > 0.0001 {
			t.Errorf("expected 15.0, got %f", p2)
		}
		p3 := CalculatePlayerPrice(10.0, 10.0)
		if math.Abs(p3-20.0) > 0.0001 {
			t.Errorf("expected 20.0, got %f", p3)
		}
		pUnrated := CalculatePlayerPrice(10.0, 0.0)
		if math.Abs(pUnrated-10.0) > 0.0001 {
			t.Errorf("expected 10.0 for unrated, got %f", pUnrated)
		}
	})
}
