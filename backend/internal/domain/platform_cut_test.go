package domain

import "testing"

// The platform's cut is 2.5%, a fractional percent. SplitPool scales by 1000 to
// keep that exact in integer kobo; these pin that it holds, because the failure
// mode is money quietly vanishing between the cut and the prize pool rather
// than anything that would show up as an error.
func TestSplitPoolAtTwoPointFivePercent(t *testing.T) {
	t.Run("the split always accounts for every kobo", func(t *testing.T) {
		for _, gross := range []int64{1, 7, 100000, 400000, 1234567, 999999999} {
			cut, pool := SplitPool(gross, 2.5)
			if cut+pool != gross {
				t.Errorf("gross %d: cut %d + pool %d = %d, must equal the gross", gross, cut, pool, cut+pool)
			}
			if cut < 0 || pool < 0 {
				t.Errorf("gross %d: negative split cut=%d pool=%d", gross, cut, pool)
			}
		}
	})

	// The pool is computed and the cut is the remainder, so integer truncation
	// always lands in the platform's favour — by under a kobo. That is only
	// visible at absurdly small amounts (a gross of 1 kobo rounds the pool to
	// nothing); at any real entry fee the cut is the smaller share by a mile.
	// Recorded rather than asserted away, so the direction is a known choice.
	t.Run("at any realistic gross the pool dwarfs the cut", func(t *testing.T) {
		for _, gross := range []int64{100000, 400000, 1234567, 999999999} {
			cut, pool := SplitPool(gross, 2.5)
			if cut >= pool {
				t.Errorf("gross %d: the platform took %d and left the pool %d", gross, cut, pool)
			}
		}
	})

	// ₦4,000.00 of entry fees: 2.5% is ₦100.00, leaving ₦3,900.00 to be won.
	t.Run("takes 2.5 percent, not 10", func(t *testing.T) {
		cut, pool := SplitPool(400000, 2.5)
		if cut != 10000 || pool != 390000 {
			t.Errorf("got cut=%d pool=%d, want cut=10000 pool=390000", cut, pool)
		}
	})
}
