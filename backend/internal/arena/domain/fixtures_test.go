package domain

import (
	"fmt"
	"testing"
	"time"
)

func ids(n int) []string {
	out := make([]string, n)
	for i := range out {
		out[i] = fmt.Sprintf("c%02d", i)
	}
	return out
}

func input(n, legs int) FixtureInput {
	return FixtureInput{
		ClubIDs:    ids(n),
		FirstDate:  time.Date(2026, 10, 12, 9, 0, 0, 0, Lagos), // a Monday
		KickoffDay: 0,
		Slots:      []string{"20:00", "20:30"},
		Legs:       legs,
	}
}

func TestGenerateFixturesDoubleRoundRobin(t *testing.T) {
	for _, n := range []int{2, 3, 4, 5, 8, 9} {
		fx, err := GenerateFixtures(input(n, 2))
		if err != nil {
			t.Fatalf("n=%d: %v", n, err)
		}

		// Every ordered pair (home, away) appears exactly once.
		pairs := map[string]int{}
		home := map[string]int{}
		away := map[string]int{}
		perWeek := map[int]map[string]int{}
		for _, f := range fx {
			if f.HomeClubID == f.AwayClubID {
				t.Fatalf("n=%d: club plays itself", n)
			}
			pairs[f.HomeClubID+">"+f.AwayClubID]++
			home[f.HomeClubID]++
			away[f.AwayClubID]++
			if perWeek[f.Matchweek] == nil {
				perWeek[f.Matchweek] = map[string]int{}
			}
			perWeek[f.Matchweek][f.HomeClubID]++
			perWeek[f.Matchweek][f.AwayClubID]++
		}
		if want := n * (n - 1); len(fx) != want {
			t.Errorf("n=%d: %d fixtures, want %d", n, len(fx), want)
		}
		for p, c := range pairs {
			if c != 1 {
				t.Errorf("n=%d: pairing %s appears %d times", n, p, c)
			}
		}
		for _, id := range ids(n) {
			if home[id] != n-1 || away[id] != n-1 {
				t.Errorf("n=%d: %s has %d home and %d away, want %d each", n, id, home[id], away[id], n-1)
			}
		}
		// No club plays twice in a matchweek.
		for w, m := range perWeek {
			for id, c := range m {
				if c > 1 {
					t.Errorf("n=%d week %d: %s plays %d times", n, w, id, c)
				}
			}
		}
		// Week count: n-1 per leg for even n, n per leg for odd n.
		weeks := n - 1
		if n%2 == 1 {
			weeks = n
		}
		if got := len(perWeek); got != weeks*2 {
			t.Errorf("n=%d: %d matchweeks, want %d", n, got, weeks*2)
		}
	}
}

func TestGenerateFixturesSingleLeg(t *testing.T) {
	fx, err := GenerateFixtures(input(6, 1))
	if err != nil {
		t.Fatal(err)
	}
	if len(fx) != 15 {
		t.Errorf("%d fixtures, want 15", len(fx))
	}
	meet := map[string]int{}
	for _, f := range fx {
		a, b := f.HomeClubID, f.AwayClubID
		if a > b {
			a, b = b, a
		}
		meet[a+b]++
	}
	for k, c := range meet {
		if c != 1 {
			t.Errorf("%s meet %d times", k, c)
		}
	}
}

func TestGenerateFixturesDatesAndSlots(t *testing.T) {
	fx, err := GenerateFixtures(input(4, 2))
	if err != nil {
		t.Fatal(err)
	}
	// First Sunday on or after Mon 12 Oct 2026 is 18 Oct; weeks are 7 days apart.
	first := fx[0].KickoffAt.In(Lagos)
	if first.Weekday() != time.Sunday || first.Day() != 18 || first.Month() != time.October {
		t.Errorf("first match at %v, want Sunday 18 Oct", first)
	}
	if first.Hour() != 20 || first.Minute() != 0 {
		t.Errorf("first slot %02d:%02d, want 20:00", first.Hour(), first.Minute())
	}
	second := fx[1].KickoffAt.In(Lagos)
	if second.Hour() != 20 || second.Minute() != 30 || fx[1].Matchweek != 1 {
		t.Errorf("second match should be 20:30 in the same matchweek, got %v (week %d)", second, fx[1].Matchweek)
	}
	last := fx[len(fx)-1]
	if last.Matchweek != 6 {
		t.Errorf("last matchweek %d, want 6", last.Matchweek)
	}
	if got := last.KickoffAt.In(Lagos); got.Day() != 18+7*5-31 || got.Month() != time.November {
		t.Errorf("week 6 should be 22 Nov, got %v", got)
	}
}

func TestGenerateFixturesErrors(t *testing.T) {
	cases := map[string]func(*FixtureInput){
		"one club":    func(i *FixtureInput) { i.ClubIDs = []string{"a"} },
		"duplicate":   func(i *FixtureInput) { i.ClubIDs = []string{"a", "a"} },
		"bad legs":    func(i *FixtureInput) { i.Legs = 3 },
		"bad day":     func(i *FixtureInput) { i.KickoffDay = 7 },
		"no slots":    func(i *FixtureInput) { i.Slots = nil },
		"bad slot":    func(i *FixtureInput) { i.Slots = []string{"8pm"} },
		"bad minutes": func(i *FixtureInput) { i.Slots = []string{"20:75"} },
	}
	for name, mutate := range cases {
		in := input(4, 2)
		mutate(&in)
		if _, err := GenerateFixtures(in); err == nil {
			t.Errorf("%s: expected an error", name)
		}
	}
}
