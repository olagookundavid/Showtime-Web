package domain

import (
	"testing"
	"time"
)

func TestTouchdownPoints(t *testing.T) {
	pastDate := time.Date(2026, 9, 15, 0, 0, 0, 0, time.UTC)
	effectiveDate := time.Date(2026, 9, 20, 0, 0, 0, 0, time.UTC)
	futureDate := time.Date(2026, 9, 21, 0, 0, 0, 0, time.UTC)

	cases := []struct {
		name                        string
		passer, receiver            string
		thirdDown, defensive, isRun bool
		matchDate                   time.Time
		want                        int
	}{
		// Offensive pass TD (regular downs)
		{"off M→M", "M", "M", false, false, false, time.Time{}, 6},
		{"off M→F", "M", "F", false, false, false, time.Time{}, 7},
		{"off F→M", "F", "M", false, false, false, time.Time{}, 8},
		{"off F→F", "F", "F", false, false, false, time.Time{}, 9},
		// 3rd down (female-only): Historical (< Sept 20, 2026) is 7
		{"off 3rd F→F past", "F", "F", true, false, false, pastDate, 7},
		// 3rd down (female-only): New rule (>= Sept 20, 2026) is 6
		{"off 3rd F→F effective date", "F", "F", true, false, false, effectiveDate, 6},
		{"off 3rd F→F future", "F", "F", true, false, false, futureDate, 6},
		// Run TD by runner's gender
		{"run male", "M", "M", false, false, true, time.Time{}, 6},
		{"run female", "F", "F", false, false, true, time.Time{}, 7},
		{"run female 3rd down past", "F", "F", true, false, true, pastDate, 7},
		{"run female 3rd down future", "F", "F", true, false, true, futureDate, 6},
		// Defensive TD (pick-six)
		{"def M→M", "M", "M", false, true, false, time.Time{}, 6},
		{"def M→F", "M", "F", false, true, false, time.Time{}, 7},
		{"def F→M", "F", "M", false, true, false, time.Time{}, 7},
		{"def F→F", "F", "F", false, true, false, time.Time{}, 8},
		{"def 3rd F→F past", "F", "F", true, true, false, pastDate, 7},
		{"def 3rd F→F future", "F", "F", true, true, false, futureDate, 6},
		// Missing/unknown gender → Male
		{"missing → male", "", "", false, false, false, time.Time{}, 6},
		{"lowercase f", "f", "f", false, false, false, time.Time{}, 9},
		{"junk → male", "x", "y", false, false, false, time.Time{}, 6},
	}
	for _, c := range cases {
		if got := TouchdownPoints(c.passer, c.receiver, c.thirdDown, c.defensive, c.isRun, c.matchDate); got != c.want {
			t.Errorf("%s: TouchdownPoints(%q,%q,3rd=%v,def=%v,run=%v,date=%v) = %d, want %d",
				c.name, c.passer, c.receiver, c.thirdDown, c.defensive, c.isRun, c.matchDate, got, c.want)
		}
	}
}

func TestExtraPointPoints(t *testing.T) {
	cases := []struct {
		name             string
		passer, receiver string
		defensive, isRun bool
		want             int
	}{
		// Offensive XP
		{"off M→M", "M", "M", false, false, 1},
		{"off M→F", "M", "F", false, false, 2},
		{"off F→M", "F", "M", false, false, 2},
		{"off F→F", "F", "F", false, false, 3},
		// Run XP (assumed)
		{"run male", "M", "M", false, true, 1},
		{"run female", "F", "F", false, true, 2},
		// Defensive XP
		{"def M→M", "M", "M", true, false, 1},
		{"def M→F", "M", "F", true, false, 2},
		{"def F→M", "F", "M", true, false, 1},
		{"def F→F", "F", "F", true, false, 2},
		// Missing → Male
		{"missing → male", "", "", false, false, 1},
	}
	for _, c := range cases {
		if got := ExtraPointPoints(c.passer, c.receiver, c.defensive, c.isRun); got != c.want {
			t.Errorf("%s: ExtraPointPoints(%q,%q,def=%v,run=%v) = %d, want %d",
				c.name, c.passer, c.receiver, c.defensive, c.isRun, got, c.want)
		}
	}
}
