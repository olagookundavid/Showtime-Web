package domain

import (
	"errors"
	"fmt"
	"time"
)

// Lagos is West Africa Time. It has no daylight saving, so a fixed zone is exact
// and doesn't depend on the server having tz data installed.
var Lagos = time.FixedZone("WAT", 60*60)

// FixtureInput describes the league to schedule.
type FixtureInput struct {
	ClubIDs []string
	// FirstDate is the earliest the first matchweek may fall; it lands on the first
	// KickoffDay on or after this date.
	FirstDate time.Time
	// KickoffDay is 0 (Sunday) to 6 (Saturday), in Lagos.
	KickoffDay int
	// Slots are kick-off times ("20:00") used in turn within each matchweek.
	Slots []string
	// Legs is 1 (everyone plays everyone once) or 2 (home and away).
	Legs int
}

// Fixture is one scheduled league match.
type Fixture struct {
	Matchweek  int
	HomeClubID string
	AwayClubID string
	KickoffAt  time.Time
}

// ParseSlot reads "HH:MM".
func ParseSlot(s string) (hour, min int, err error) {
	if _, err = fmt.Sscanf(s, "%d:%d", &hour, &min); err != nil || hour < 0 || hour > 23 || min < 0 || min > 59 || len(s) != 5 {
		return 0, 0, fmt.Errorf("kick-off time %q must look like 20:00", s)
	}
	return hour, min, nil
}

// GenerateFixtures builds a round-robin with the circle method. With an odd number
// of clubs each matchweek one club rests. In a two-leg league the second half
// mirrors the first with home and away swapped, so every club plays exactly as
// many home games as away games.
func GenerateFixtures(in FixtureInput) ([]Fixture, error) {
	n := len(in.ClubIDs)
	if n < 2 {
		return nil, errors.New("a division needs at least 2 clubs to make fixtures")
	}
	if in.Legs != 1 && in.Legs != 2 {
		return nil, errors.New("legs must be 1 or 2")
	}
	if in.KickoffDay < 0 || in.KickoffDay > 6 {
		return nil, errors.New("kick-off day must be between 0 (Sunday) and 6 (Saturday)")
	}
	if len(in.Slots) == 0 {
		return nil, errors.New("add at least one kick-off time")
	}
	type hm struct{ h, m int }
	slots := make([]hm, len(in.Slots))
	for i, s := range in.Slots {
		h, m, err := ParseSlot(s)
		if err != nil {
			return nil, err
		}
		slots[i] = hm{h, m}
	}
	seen := make(map[string]bool, n)
	for _, id := range in.ClubIDs {
		if id == "" || seen[id] {
			return nil, errors.New("club list has an empty or repeated club")
		}
		seen[id] = true
	}

	// The circle method needs an even field: a nil entry is the bye.
	teams := append([]string(nil), in.ClubIDs...)
	if n%2 == 1 {
		teams = append(teams, "")
	}
	size := len(teams)
	rounds := size - 1

	type pair struct{ home, away string }
	first := make([][]pair, rounds)
	for r := 0; r < rounds; r++ {
		for i := 0; i < size/2; i++ {
			a, b := teams[i], teams[size-1-i]
			if a == "" || b == "" {
				continue
			}
			// Alternate who is at home so the fixed club and the others both
			// swing between home and away.
			if (r+i)%2 == 1 {
				a, b = b, a
			}
			first[r] = append(first[r], pair{a, b})
		}
		// Rotate everyone except teams[0].
		last := teams[size-1]
		copy(teams[2:], teams[1:size-1])
		teams[1] = last
	}

	day := in.FirstDate.In(Lagos)
	day = time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, Lagos)
	for int(day.Weekday()) != in.KickoffDay {
		day = day.AddDate(0, 0, 1)
	}

	var out []Fixture
	week := 0
	for leg := 0; leg < in.Legs; leg++ {
		for r := 0; r < rounds; r++ {
			week++
			date := day.AddDate(0, 0, 7*(week-1))
			for i, p := range first[r] {
				home, away := p.home, p.away
				if leg == 1 {
					home, away = away, home
				}
				s := slots[i%len(slots)]
				out = append(out, Fixture{
					Matchweek:  week,
					HomeClubID: home,
					AwayClubID: away,
					KickoffAt:  time.Date(date.Year(), date.Month(), date.Day(), s.h, s.m, 0, 0, Lagos),
				})
			}
		}
	}
	return out, nil
}
