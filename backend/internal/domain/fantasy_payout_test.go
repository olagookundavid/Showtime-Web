package domain

import "testing"

func TestSplitPool(t *testing.T) {
	cases := []struct {
		name       string
		gross      int64
		cutPercent float64
		wantCut    int64
		wantPool   int64
	}{
		{"ten percent of a round pot", 100000, 10, 10000, 90000},
		{"fractional percent", 100000, 7.5, 7500, 92500},
		{"zero cut leaves the whole pot", 100000, 0, 0, 100000},
		{"full cut leaves nothing", 100000, 100, 100000, 0},
		{"empty pot", 0, 10, 0, 0},
		// 33333 kobo at 10% doesn't divide evenly; the cut absorbs the remainder
		// so no kobo is invented or lost.
		{"indivisible pot", 33333, 10, 3334, 29999},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			cut, pool := SplitPool(c.gross, c.cutPercent)
			if cut != c.wantCut || pool != c.wantPool {
				t.Errorf("SplitPool(%d, %.2f) = cut %d, pool %d; want cut %d, pool %d",
					c.gross, c.cutPercent, cut, pool, c.wantCut, c.wantPool)
			}
			if cut+pool != c.gross {
				t.Errorf("cut + pool = %d, which does not reconcile to gross %d", cut+pool, c.gross)
			}
		})
	}
}

func TestDistributePrizes(t *testing.T) {
	standing := func(id string, pts float64) PrizeStanding {
		return PrizeStanding{UserID: id, TeamID: "team-" + id, Points: pts}
	}
	sum := func(awards []PrizeAward) int64 {
		var total int64
		for _, a := range awards {
			total += a.AmountKobo
		}
		return total
	}
	amountFor := func(awards []PrizeAward, userID string) int64 {
		for _, a := range awards {
			if a.UserID == userID {
				return a.AmountKobo
			}
		}
		return 0
	}

	t.Run("splits by the default structure", func(t *testing.T) {
		awards := DistributePrizes([]PrizeStanding{
			standing("a", 100), standing("b", 90), standing("c", 80), standing("d", 70),
		}, 100000, DefaultPrizeStructure)

		if got := amountFor(awards, "a"); got != 50000 {
			t.Errorf("1st should take 50%%, got %d", got)
		}
		if got := amountFor(awards, "b"); got != 30000 {
			t.Errorf("2nd should take 30%%, got %d", got)
		}
		if got := amountFor(awards, "c"); got != 20000 {
			t.Errorf("3rd should take 20%%, got %d", got)
		}
		if got := amountFor(awards, "d"); got != 0 {
			t.Errorf("4th is outside the prizes and should take nothing, got %d", got)
		}
		if sum(awards) != 100000 {
			t.Errorf("the whole pool must be paid out, got %d of 100000", sum(awards))
		}
	})

	// Two managers level on points share 1st and 2nd, and the next one is 3rd.
	t.Run("ties share the positions they occupy", func(t *testing.T) {
		awards := DistributePrizes([]PrizeStanding{
			standing("a", 100), standing("b", 100), standing("c", 80),
		}, 100000, DefaultPrizeStructure)

		// (50% + 30%) / 2 = 40% each.
		if got := amountFor(awards, "a"); got != 40000 {
			t.Errorf("joint 1st should take 40%%, got %d", got)
		}
		if got := amountFor(awards, "b"); got != 40000 {
			t.Errorf("joint 1st should take 40%%, got %d", got)
		}
		if got := amountFor(awards, "c"); got != 20000 {
			t.Errorf("the next manager finishes 3rd and takes 20%%, got %d", got)
		}
		if sum(awards) != 100000 {
			t.Errorf("the whole pool must still be paid out, got %d", sum(awards))
		}
		for _, a := range awards {
			if a.UserID == "a" && a.Rank != 1 {
				t.Errorf("tied managers should both show rank 1, got %d", a.Rank)
			}
			if a.UserID == "c" && a.Rank != 3 {
				t.Errorf("the manager after a two-way tie is 3rd, got %d", a.Rank)
			}
		}
	})

	t.Run("a three-way tie for first takes every prize", func(t *testing.T) {
		awards := DistributePrizes([]PrizeStanding{
			standing("a", 50), standing("b", 50), standing("c", 50), standing("d", 10),
		}, 90000, DefaultPrizeStructure)

		for _, id := range []string{"a", "b", "c"} {
			if got := amountFor(awards, id); got != 30000 {
				t.Errorf("a three-way tie splits the whole pool equally; %s got %d", id, got)
			}
		}
		if got := amountFor(awards, "d"); got != 0 {
			t.Errorf("4th is outside the prizes, got %d", got)
		}
	})

	// The indivisible remainder must be handed out, not dropped.
	t.Run("an indivisible tie loses no kobo", func(t *testing.T) {
		awards := DistributePrizes([]PrizeStanding{
			standing("a", 50), standing("b", 50), standing("c", 50),
		}, 100000, DefaultPrizeStructure)

		if sum(awards) != 100000 {
			t.Errorf("expected every kobo distributed, got %d of 100000", sum(awards))
		}
		// 100000 / 3 = 33333 remainder 1, so exactly one manager gets 33334.
		counts := map[int64]int{}
		for _, a := range awards {
			counts[a.AmountKobo]++
		}
		if counts[33334] != 1 || counts[33333] != 2 {
			t.Errorf("expected one award of 33334 and two of 33333, got %v", counts)
		}
	})

	t.Run("rounding dust goes to the winner", func(t *testing.T) {
		// 33333 split 50/30/20 leaves a kobo unallocated by flooring.
		awards := DistributePrizes([]PrizeStanding{
			standing("a", 30), standing("b", 20), standing("c", 10),
		}, 33333, DefaultPrizeStructure)

		if sum(awards) != 33333 {
			t.Errorf("expected the full 33333 distributed, got %d", sum(awards))
		}
	})

	t.Run("a partial structure keeps the rest in the pool", func(t *testing.T) {
		// Only 60% is allocated; the remaining 40% is deliberately not paid out.
		awards := DistributePrizes([]PrizeStanding{
			standing("a", 30), standing("b", 20),
		}, 100000, []PrizeTier{{Rank: 1, Percent: 60}})

		if got := sum(awards); got != 60000 {
			t.Errorf("expected only the allocated 60%% paid out, got %d", got)
		}
	})

	t.Run("fewer managers than prize positions", func(t *testing.T) {
		awards := DistributePrizes([]PrizeStanding{standing("a", 30)}, 100000, DefaultPrizeStructure)

		if got := amountFor(awards, "a"); got != 50000 {
			t.Errorf("a lone manager takes only the 1st place share, got %d", got)
		}
	})

	t.Run("no pool means no awards", func(t *testing.T) {
		if awards := DistributePrizes([]PrizeStanding{standing("a", 30)}, 0, DefaultPrizeStructure); awards != nil {
			t.Errorf("expected no awards from an empty pool, got %v", awards)
		}
	})

	t.Run("is deterministic across runs", func(t *testing.T) {
		in := []PrizeStanding{standing("z", 50), standing("a", 50), standing("m", 50)}
		first := DistributePrizes(in, 100000, DefaultPrizeStructure)
		second := DistributePrizes(in, 100000, DefaultPrizeStructure)
		for i := range first {
			if first[i].UserID != second[i].UserID || first[i].AmountKobo != second[i].AmountKobo {
				t.Fatalf("distribution is not deterministic: %+v vs %+v", first, second)
			}
		}
	})
}

func TestValidatePrizeStructure(t *testing.T) {
	t.Run("accepts the default", func(t *testing.T) {
		if err := ValidatePrizeStructure(DefaultPrizeStructure); err != nil {
			t.Errorf("the default structure should be valid, got: %v", err)
		}
	})

	t.Run("accepts a partial allocation", func(t *testing.T) {
		if err := ValidatePrizeStructure([]PrizeTier{{Rank: 1, Percent: 60}}); err != nil {
			t.Errorf("a partial structure should be valid, got: %v", err)
		}
	})

	t.Run("rejects an empty structure", func(t *testing.T) {
		if err := ValidatePrizeStructure(nil); err == nil {
			t.Error("expected an empty structure to be rejected")
		}
	})

	t.Run("rejects a gap in positions", func(t *testing.T) {
		err := ValidatePrizeStructure([]PrizeTier{{Rank: 1, Percent: 50}, {Rank: 3, Percent: 50}})
		if err == nil {
			t.Error("expected a gap between positions 1 and 3 to be rejected")
		}
	})

	t.Run("rejects over-allocation", func(t *testing.T) {
		err := ValidatePrizeStructure([]PrizeTier{{Rank: 1, Percent: 70}, {Rank: 2, Percent: 40}})
		if err == nil {
			t.Error("expected shares totalling more than 100% to be rejected")
		}
	})
}

func TestValidatePayoutStatusTransition(t *testing.T) {
	t.Run("allows the normal progression", func(t *testing.T) {
		if err := ValidatePayoutStatusTransition(PayoutPending, PayoutProcessing); err != nil {
			t.Errorf("pending to processing should be allowed, got: %v", err)
		}
		if err := ValidatePayoutStatusTransition(PayoutProcessing, PayoutPaid); err != nil {
			t.Errorf("processing to paid should be allowed, got: %v", err)
		}
	})

	// Reopening a settled payout would let the same money go out twice.
	t.Run("refuses to reopen a terminal payout", func(t *testing.T) {
		for _, from := range []PayoutStatus{PayoutPaid, PayoutRejected, PayoutCancelled} {
			if err := ValidatePayoutStatusTransition(from, PayoutProcessing); err == nil {
				t.Errorf("expected %s to be final", from)
			}
		}
	})

	t.Run("refuses a no-op", func(t *testing.T) {
		if err := ValidatePayoutStatusTransition(PayoutPending, PayoutPending); err == nil {
			t.Error("expected re-applying the same status to be rejected")
		}
	})

	t.Run("only rejection and cancellation return funds", func(t *testing.T) {
		if !PayoutRejected.ReturnsFunds() || !PayoutCancelled.ReturnsFunds() {
			t.Error("rejected and cancelled payouts must return the held funds")
		}
		if PayoutPaid.ReturnsFunds() || PayoutProcessing.ReturnsFunds() {
			t.Error("paid and in-flight payouts must not return funds")
		}
	})
}
