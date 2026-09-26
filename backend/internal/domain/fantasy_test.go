package domain

import (
	"math"
	"testing"
)

func TestFantasyScoring(t *testing.T) {
	weights := FantasyWeights{}

	t.Run("All fields zero produces 0.0", func(t *testing.T) {
		stat := PlayerStat{}
		score := weights.Calculate(stat)
		if score.NetTotal != 0.0 {
			t.Errorf("expected 0.0, got %f", score.NetTotal)
		}
	})

	t.Run("5 flag pulls equals 1 deflection (1.50 pts)", func(t *testing.T) {
		pullsStat := PlayerStat{FlagPulls: 5}
		pullsScore := weights.Calculate(pullsStat)
		if math.Abs(pullsScore.DefensiveTotal-1.50) > 0.0001 {
			t.Errorf("expected 1.50 for 5 pulls, got %f", pullsScore.DefensiveTotal)
		}

		deflStat := PlayerStat{PassDeflections: 1}
		deflScore := weights.Calculate(deflStat)
		if math.Abs(deflScore.DefensiveTotal-1.50) > 0.0001 {
			t.Errorf("expected 1.50 for 1 deflection, got %f", deflScore.DefensiveTotal)
		}
	})

	t.Run("8 flag pulls produces max contribution (2.40 pts)", func(t *testing.T) {
		stat := PlayerStat{FlagPulls: 8}
		score := weights.Calculate(stat)
		if math.Abs(score.DefensiveTotal-2.40) > 0.0001 {
			t.Errorf("expected 2.40 for 8 pulls, got %f", score.DefensiveTotal)
		}
	})

	t.Run("12 flag pulls capped at 8 scoring pulls (2.40 pts)", func(t *testing.T) {
		stat := PlayerStat{FlagPulls: 12}
		score := weights.Calculate(stat)
		if math.Abs(score.DefensiveTotal-2.40) > 0.0001 {
			t.Errorf("expected 2.40 for 12 pulls (capped at 8), got %f", score.DefensiveTotal)
		}
	})

	t.Run("1 defensive sack (2.50 pts)", func(t *testing.T) {
		stat := PlayerStat{DefSacks: 1}
		score := weights.Calculate(stat)
		if math.Abs(score.DefensiveTotal-2.50) > 0.0001 {
			t.Errorf("expected 2.50 for 1 sack, got %f", score.DefensiveTotal)
		}
	})

	t.Run("1 interception (4.00 pts)", func(t *testing.T) {
		stat := PlayerStat{Interceptions: 1}
		score := weights.Calculate(stat)
		if math.Abs(score.DefensiveTotal-4.00) > 0.0001 {
			t.Errorf("expected 4.00 for 1 INT, got %f", score.DefensiveTotal)
		}
	})

	t.Run("Pick-Six (INT + Defensive TD) earns 9.00 pts", func(t *testing.T) {
		stat := PlayerStat{
			Interceptions: 1,
			DefensiveTDs:  1,
		}
		score := weights.Calculate(stat)
		if math.Abs(score.NetTotal-9.00) > 0.0001 {
			t.Errorf("expected 9.00 for pick-six, got %f", score.NetTotal)
		}
	})

	t.Run("Productive defender: 6 pulls + 2 deflections + 1 INT (8.8 pts)", func(t *testing.T) {
		// (6*0.30) + (2*1.50) + (1*4.00) = 1.80 + 3.00 + 4.00 = 8.80
		stat := PlayerStat{
			FlagPulls:       6,
			PassDeflections: 2,
			Interceptions:   1,
		}
		score := weights.Calculate(stat)
		if math.Abs(score.NetTotal-8.80) > 0.0001 {
			t.Errorf("expected 8.80, got %f", score.NetTotal)
		}
	})

	t.Run("Pick-six scenario: 3 pulls + 1 deflection + 1 INT + 1 TD (11.4 pts)", func(t *testing.T) {
		// (3*0.30) + 1.50 + 4.00 + 5.00 = 0.90 + 10.50 = 11.40
		stat := PlayerStat{
			FlagPulls:       3,
			PassDeflections: 1,
			Interceptions:   1,
			DefensiveTDs:    1,
		}
		score := weights.Calculate(stat)
		if math.Abs(score.NetTotal-11.40) > 0.0001 {
			t.Errorf("expected 11.40, got %f", score.NetTotal)
		}
	})

	t.Run("Impact play: 1 sack + 1 safety (6.5 pts)", func(t *testing.T) {
		// 2.50 + 4.00 = 6.50
		stat := PlayerStat{
			DefSacks: 1,
			Safety:   1,
		}
		score := weights.Calculate(stat)
		if math.Abs(score.NetTotal-6.50) > 0.0001 {
			t.Errorf("expected 6.50, got %f", score.NetTotal)
		}
	})

	t.Run("Safeties conceded has 0 penalty", func(t *testing.T) {
		stat := PlayerStat{SafetyConceded: 3}
		score := weights.Calculate(stat)
		if score.NetTotal != 0.0 {
			t.Errorf("expected 0.0 penalty for safety conceded, got %f", score.NetTotal)
		}
	})

	t.Run("Negative defensive fields clamped to 0", func(t *testing.T) {
		stat := PlayerStat{
			FlagPulls:       -2,
			PassDeflections: -1,
			DefSacks:        -1,
			Interceptions:   -1,
		}
		score := weights.Calculate(stat)
		if score.DefensiveTotal != 0.0 {
			t.Errorf("expected 0.0 for negative defensive stats, got %f", score.DefensiveTotal)
		}
	})

	t.Run("Negative offensive score not clamped", func(t *testing.T) {
		stat := PlayerStat{Drops: 2}
		score := weights.Calculate(stat)
		if math.Abs(score.NetTotal-(-0.500)) > 0.0001 {
			t.Errorf("expected -0.500 for 2 drops, got %f", score.NetTotal)
		}
	})

	t.Run("Receiver offensive scoring", func(t *testing.T) {
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
}

func TestFantasyPointsBreakdown_ForSlot(t *testing.T) {
	weights := FantasyWeights{}
	// Player with both offensive (5 catches + 80 yds = 3.25 pts) and defensive (1 INT = 3.0 pts) output.
	stat := PlayerStat{
		Receptions:     5,
		ReceivingYards: 80,
		Interceptions:  1,
	}
	breakdown := weights.Calculate(stat)
	// Offensive: 1.25 + 2.0 = 3.25
	// Defensive: 4.0
	// Net: 7.25

	t.Run("Non-All-Rounder in offensive slot keeps full match score", func(t *testing.T) {
		pts, scoped := breakdown.ForSlot(SlotRec1, false)
		if pts != 7.25 {
			t.Fatalf("expected 7.25 pts, got %f", pts)
		}
		if scoped.NetTotal != 7.25 {
			t.Errorf("expected NetTotal 7.25, got %f", scoped.NetTotal)
		}
		if scoped.DefensiveTotal != 4.0 {
			t.Errorf("expected DefensiveTotal 4.0, got %f", scoped.DefensiveTotal)
		}
		if scoped.FullMatchTotal == nil || *scoped.FullMatchTotal != 7.25 {
			t.Errorf("expected FullMatchTotal 7.25, got %v", scoped.FullMatchTotal)
		}
	})

	t.Run("Non-All-Rounder in defensive slot keeps full match score", func(t *testing.T) {
		pts, scoped := breakdown.ForSlot(SlotDef1, false)
		if pts != 7.25 {
			t.Fatalf("expected 7.25 pts, got %f", pts)
		}
		if scoped.NetTotal != 7.25 {
			t.Errorf("expected NetTotal 7.25, got %f", scoped.NetTotal)
		}
	})

	t.Run("All-Rounder in Offensive slot earns only offensive points", func(t *testing.T) {
		pts, scoped := breakdown.ForSlot(SlotRec1, true)
		if pts != 3.25 {
			t.Fatalf("expected 3.25 offensive pts, got %f", pts)
		}
		if scoped.NetTotal != 3.25 {
			t.Errorf("expected scoped NetTotal 3.25, got %f", scoped.NetTotal)
		}
		if scoped.OffensiveTotal != 3.25 {
			t.Errorf("expected OffensiveTotal 3.25, got %f", scoped.OffensiveTotal)
		}
		if scoped.DefensiveTotal != 0 {
			t.Errorf("expected DefensiveTotal zeroed out, got %f", scoped.DefensiveTotal)
		}
		if scoped.InterceptionsPts != 0 {
			t.Errorf("expected InterceptionsPts zeroed out, got %f", scoped.InterceptionsPts)
		}
		if scoped.FullMatchTotal == nil || *scoped.FullMatchTotal != 7.25 {
			t.Errorf("expected FullMatchTotal to be preserved as 7.25, got %v", scoped.FullMatchTotal)
		}
	})

	t.Run("All-Rounder in Defensive slot earns only defensive points", func(t *testing.T) {
		pts, scoped := breakdown.ForSlot(SlotDef1, true)
		if pts != 4.0 {
			t.Fatalf("expected 4.0 defensive pts, got %f", pts)
		}
		if scoped.NetTotal != 4.0 {
			t.Errorf("expected scoped NetTotal 4.0, got %f", scoped.NetTotal)
		}
		if scoped.DefensiveTotal != 4.0 {
			t.Errorf("expected DefensiveTotal 4.0, got %f", scoped.DefensiveTotal)
		}
		if scoped.OffensiveTotal != 0 {
			t.Errorf("expected OffensiveTotal zeroed out, got %f", scoped.OffensiveTotal)
		}
		if scoped.ReceptionsPts != 0 || scoped.ReceivingYardsPts != 0 {
			t.Errorf("expected offensive stats zeroed out")
		}
		if scoped.FullMatchTotal == nil || *scoped.FullMatchTotal != 7.25 {
			t.Errorf("expected FullMatchTotal to be preserved as 7.25, got %v", scoped.FullMatchTotal)
		}
	})
}

func TestIsAllrounderPlayer(t *testing.T) {
	secAR := "All-Rounder"
	secWR := "Receiver"

	tests := []struct {
		pos    string
		sec    *string
		wantAR bool
	}{
		{"ALLROUNDER", nil, true},
		{"all-rounder", nil, true},
		{"All Rounder", nil, true},
		{"AR", nil, true},
		{"Receiver", &secAR, true},
		{"QB", nil, false},
		{"Receiver", &secWR, false},
		{"", nil, false},
	}

	for _, tt := range tests {
		got := IsAllrounderPlayer(tt.pos, tt.sec)
		if got != tt.wantAR {
			t.Errorf("IsAllrounderPlayer(%q, %v) = %v, want %v", tt.pos, tt.sec, got, tt.wantAR)
		}
	}
}

func TestSumBreakdowns(t *testing.T) {
	t.Run("raw (unscoped) parts fall back to NetTotal", func(t *testing.T) {
		parts := []FantasyPointsBreakdown{
			{NetTotal: 3.0},
			{NetTotal: 4.5},
		}
		total := SumBreakdowns(parts)
		if total.FullMatchTotal == nil || *total.FullMatchTotal != 7.5 {
			t.Errorf("expected FullMatchTotal 7.5, got %v", total.FullMatchTotal)
		}
	})

	// A ForSlot-scoped All-Rounder breakdown whose real full-match total is
	// exactly zero (offense and defense cancelling out) must still be summed
	// as zero, not silently replaced by the scoped NetTotal — see the
	// FullMatchTotal doc comment for why this has to be a pointer.
	t.Run("a scoped part whose real FullMatchTotal is exactly zero is not mistaken for unset", func(t *testing.T) {
		zero := 0.0
		parts := []FantasyPointsBreakdown{
			{NetTotal: -1.5, FullMatchTotal: &zero},
		}
		total := SumBreakdowns(parts)
		if total.FullMatchTotal == nil || *total.FullMatchTotal != 0 {
			t.Errorf("expected FullMatchTotal 0, got %v", total.FullMatchTotal)
		}
	})
}
