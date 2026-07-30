package domain

import "testing"

func TestTouchdownPoints(t *testing.T) {
	cases := []struct {
		name                       string
		passer, receiver           string
		thirdDown, defensive, isRun bool
		want                       int
	}{
		// Offensive pass TD (regular downs)
		{"off M→M", "M", "M", false, false, false, 6},
		{"off M→F", "M", "F", false, false, false, 7},
		{"off F→M", "F", "M", false, false, false, 8},
		{"off F→F", "F", "F", false, false, false, 9},
		// 3rd down (female-only): F→F is 7 (not 9)
		{"off 3rd F→F", "F", "F", true, false, false, 7},
		// Run TD by runner's gender
		{"run male", "M", "M", false, false, true, 6},
		{"run female", "F", "F", false, false, true, 7},
		{"run female 3rd down", "F", "F", true, false, true, 7},
		// Defensive TD (pick-six)
		{"def M→M", "M", "M", false, true, false, 6},
		{"def M→F", "M", "F", false, true, false, 7},
		{"def F→M", "F", "M", false, true, false, 7},
		{"def F→F", "F", "F", false, true, false, 8},
		{"def 3rd F→F", "F", "F", true, true, false, 7},
		// Missing/unknown gender → Male
		{"missing → male", "", "", false, false, false, 6},
		{"lowercase f", "f", "f", false, false, false, 9},
		{"junk → male", "x", "y", false, false, false, 6},
	}
	for _, c := range cases {
		if got := TouchdownPoints(c.passer, c.receiver, c.thirdDown, c.defensive, c.isRun); got != c.want {
			t.Errorf("%s: TouchdownPoints(%q,%q,3rd=%v,def=%v,run=%v) = %d, want %d",
				c.name, c.passer, c.receiver, c.thirdDown, c.defensive, c.isRun, got, c.want)
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
