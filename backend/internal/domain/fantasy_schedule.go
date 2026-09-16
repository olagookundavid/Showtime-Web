package domain

import (
	"fmt"
	"sort"
	"time"
)

// Gameweek scheduling: keeping a fantasy season's match days in step with its
// competition's fixtures.
//
// The planning is pure so the numbering rules can be exercised without a
// database. They are the part worth being careful about: a gameweek's number is
// not decoration. Rollover finds a manager's last squad with `number <` the one
// being locked, every listing orders by it, and it is what managers see as
// "Match Day N". Renumbering a gameweek that has already been played therefore
// moves points around under people who have already been paid on them.
//
// So the rule is: a gameweek that has locked, gone live or been finalised is
// frozen — its number, its day and its existence. Only the scheduled tail is
// re-planned.

// MatchDay is one date a competition has fixtures on.
type MatchDay struct {
	Date            string // YYYY-MM-DD
	EarliestKickoff *time.Time
	MatchCount      int
}

// ScheduledGameweek is a gameweek as it currently stands in the season.
type ScheduledGameweek struct {
	ID       string
	Number   int
	Date     string // the date of the event day it is bound to
	Status   GameweekStatus
	Deadline time.Time
}

// PlannedGameweek is one gameweek the plan wants written. A blank ID means it
// does not exist yet.
type PlannedGameweek struct {
	ID       string
	Number   int
	Date     string
	Deadline time.Time
}

// SchedulePlan is the whole diff between a season's gameweeks and its fixtures.
// Applying it is idempotent: planning again against the result yields nothing.
type SchedulePlan struct {
	Create []PlannedGameweek
	Update []PlannedGameweek
	Delete []string // gameweek IDs
	// Frozen are the gameweeks left untouched because they have been played.
	Frozen []string
	// Notices are things an admin should know but which do not stop the sync —
	// chiefly a new match day that could not be numbered in calendar order.
	Notices []string
}

// Empty reports whether the plan would change anything.
func (p SchedulePlan) Empty() bool {
	return len(p.Create) == 0 && len(p.Update) == 0 && len(p.Delete) == 0
}

// gameweekIsPlayed reports whether a gameweek is past the point of being
// re-planned. LIVE counts: it is mid-match-day and about to be scored.
func gameweekIsPlayed(s GameweekStatus) bool {
	return s == GameweekLocked || s == GameweekLive || s == GameweekFinalized
}

// DeadlineFor is when a gameweek locks: the day's first kickoff less the
// season's lock window. With no kickoff on file it falls back to the start of
// the day, which locks early rather than letting a match day run unlocked.
func DeadlineFor(day MatchDay, lockMinsBefore int) (time.Time, error) {
	if day.EarliestKickoff != nil {
		return day.EarliestKickoff.Add(-time.Duration(lockMinsBefore) * time.Minute), nil
	}
	d, err := time.Parse("2006-01-02", day.Date)
	if err != nil {
		return time.Time{}, fmt.Errorf("match day %q is not a date: %w", day.Date, err)
	}
	return d, nil
}

// PlanGameweeks works out what a season's gameweeks should be, given the days
// its competition actually has fixtures on.
//
// Days already covered by a played gameweek are left alone. Everything else is
// matched up by date: a day with no gameweek gets one, a scheduled gameweek
// whose day has lost all its fixtures is dropped, and the rest are renumbered in
// calendar order around the numbers the played gameweeks have locked down.
func PlanGameweeks(existing []ScheduledGameweek, days []MatchDay, lockMinsBefore int) (SchedulePlan, error) {
	var plan SchedulePlan

	frozenByDate := make(map[string]ScheduledGameweek)
	openByDate := make(map[string]ScheduledGameweek)
	usedNumbers := make(map[int]bool)

	for _, gw := range existing {
		if gameweekIsPlayed(gw.Status) {
			frozenByDate[gw.Date] = gw
			usedNumbers[gw.Number] = true
			plan.Frozen = append(plan.Frozen, gw.ID)
			continue
		}
		openByDate[gw.Date] = gw
	}

	dayByDate := make(map[string]MatchDay, len(days))
	sorted := append([]MatchDay(nil), days...)
	sort.SliceStable(sorted, func(a, b int) bool { return sorted[a].Date < sorted[b].Date })
	for _, d := range sorted {
		dayByDate[d.Date] = d
	}

	// A scheduled gameweek whose day no longer has a fixture has nothing left to
	// score, so it goes. A played one in the same position is kept and flagged:
	// its points are already banked and deleting it would take them with it.
	for date, gw := range openByDate {
		if _, stillPlayed := dayByDate[date]; !stillPlayed {
			plan.Delete = append(plan.Delete, gw.ID)
		}
	}
	sort.Strings(plan.Delete)

	for date, gw := range frozenByDate {
		if _, stillPlayed := dayByDate[date]; !stillPlayed {
			plan.Notices = append(plan.Notices, fmt.Sprintf(
				"Gameweek %d (%s) no longer has any fixtures, but it has already been played so it has been kept.",
				gw.Number, date))
		}
	}

	// Number the days that are still in play. Walking in date order and taking
	// the lowest free number keeps numbering chronological whenever the played
	// gameweeks leave room for it.
	next := 1
	takeNumber := func() int {
		for usedNumbers[next] {
			next++
		}
		usedNumbers[next] = true
		return next
	}

	for _, day := range sorted {
		if _, frozen := frozenByDate[day.Date]; frozen {
			continue // its number and deadline are settled
		}

		deadline, err := DeadlineFor(day, lockMinsBefore)
		if err != nil {
			return SchedulePlan{}, err
		}
		number := takeNumber()

		// A day that sits earlier in the calendar than an already-played
		// gameweek cannot be numbered in order without renumbering history, so
		// it takes a later number and the admin is told rather than left to
		// notice that Match Day 4 comes before Match Day 3.
		for _, f := range frozenByDate {
			if f.Date > day.Date && f.Number < number {
				plan.Notices = append(plan.Notices, fmt.Sprintf(
					"%s was added before Gameweek %d (%s), which has already been played. "+
						"It has been scheduled as Gameweek %d, so numbering no longer follows calendar order.",
					day.Date, f.Number, f.Date, number))
				break
			}
		}

		gw, exists := openByDate[day.Date]
		if !exists {
			plan.Create = append(plan.Create, PlannedGameweek{
				Number: number, Date: day.Date, Deadline: deadline,
			})
			continue
		}
		// Only write when something actually differs, so a no-op sync stays a
		// no-op and Empty() means what it says.
		if gw.Number != number || !gw.Deadline.Equal(deadline) {
			plan.Update = append(plan.Update, PlannedGameweek{
				ID: gw.ID, Number: number, Date: day.Date, Deadline: deadline,
			})
		}
	}

	sort.Strings(plan.Notices)
	return plan, nil
}
