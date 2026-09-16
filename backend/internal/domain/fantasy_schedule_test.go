package domain

import (
	"strings"
	"testing"
	"time"
)

func kickoff(date string) *time.Time {
	t, err := time.Parse("2006-01-02T15:04:05Z", date+"T12:00:00Z")
	if err != nil {
		panic(err)
	}
	return &t
}

func day(date string, matches int) MatchDay {
	return MatchDay{Date: date, EarliestKickoff: kickoff(date), MatchCount: matches}
}

func gwOn(id string, number int, date string, status GameweekStatus, lockMins int) ScheduledGameweek {
	d, _ := DeadlineFor(day(date, 1), lockMins)
	return ScheduledGameweek{ID: id, Number: number, Date: date, Status: status, Deadline: d}
}

const lockMins = 720 // 12 hours

func numbersByDate(t *testing.T, plan SchedulePlan) map[string]int {
	t.Helper()
	out := map[string]int{}
	for _, c := range plan.Create {
		out[c.Date] = c.Number
	}
	for _, u := range plan.Update {
		out[u.Date] = u.Number
	}
	return out
}

func TestPlanGameweeksFromScratch(t *testing.T) {
	days := []MatchDay{day("2026-10-08", 12), day("2026-10-18", 12), day("2026-10-25", 12)}

	plan, err := PlanGameweeks(nil, days, lockMins)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(plan.Create) != 3 || len(plan.Update) != 0 || len(plan.Delete) != 0 {
		t.Fatalf("expected 3 creates and nothing else, got %+v", plan)
	}
	for i, want := range []struct {
		date   string
		number int
	}{{"2026-10-08", 1}, {"2026-10-18", 2}, {"2026-10-25", 3}} {
		if plan.Create[i].Date != want.date || plan.Create[i].Number != want.number {
			t.Errorf("create[%d] = %s/GW%d, want %s/GW%d",
				i, plan.Create[i].Date, plan.Create[i].Number, want.date, want.number)
		}
	}

	// The deadline is the day's first kickoff less the lock window.
	wantDeadline := kickoff("2026-10-08").Add(-12 * time.Hour)
	if !plan.Create[0].Deadline.Equal(wantDeadline) {
		t.Errorf("deadline = %s, want %s", plan.Create[0].Deadline, wantDeadline)
	}
}

// Running the sync twice must be a no-op. Without this the "automatic on every
// fixture change" trigger would rewrite the whole schedule on every save.
func TestPlanGameweeksIsIdempotent(t *testing.T) {
	days := []MatchDay{day("2026-10-08", 12), day("2026-10-18", 12)}

	first, err := PlanGameweeks(nil, days, lockMins)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Apply it: the creates become the existing gameweeks.
	var existing []ScheduledGameweek
	for i, c := range first.Create {
		existing = append(existing, ScheduledGameweek{
			ID: string(rune('a' + i)), Number: c.Number, Date: c.Date,
			Status: GameweekScheduled, Deadline: c.Deadline,
		})
	}

	second, err := PlanGameweeks(existing, days, lockMins)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !second.Empty() {
		t.Errorf("a second plan over the same fixtures must change nothing, got %+v", second)
	}
}

func TestPlanGameweeksTracksFixtureChanges(t *testing.T) {
	existing := []ScheduledGameweek{
		gwOn("a", 1, "2026-10-08", GameweekScheduled, lockMins),
		gwOn("b", 2, "2026-10-18", GameweekScheduled, lockMins),
	}

	t.Run("a new match day is added", func(t *testing.T) {
		days := []MatchDay{day("2026-10-08", 12), day("2026-10-18", 12), day("2026-10-25", 12)}
		plan, _ := PlanGameweeks(existing, days, lockMins)
		if len(plan.Create) != 1 || plan.Create[0].Date != "2026-10-25" || plan.Create[0].Number != 3 {
			t.Errorf("expected a new GW3 on 2026-10-25, got %+v", plan.Create)
		}
		if len(plan.Delete) != 0 {
			t.Errorf("nothing should be deleted, got %v", plan.Delete)
		}
	})

	t.Run("a match day loses all its fixtures", func(t *testing.T) {
		days := []MatchDay{day("2026-10-08", 12)}
		plan, _ := PlanGameweeks(existing, days, lockMins)
		if len(plan.Delete) != 1 || plan.Delete[0] != "b" {
			t.Errorf("expected the emptied gameweek to be dropped, got %v", plan.Delete)
		}
	})

	// The whole point of "feeding off each other": move a fixture and the
	// deadline follows it.
	t.Run("a kickoff moves, so the deadline moves", func(t *testing.T) {
		later := kickoff("2026-10-18").Add(3 * time.Hour)
		days := []MatchDay{
			day("2026-10-08", 12),
			{Date: "2026-10-18", EarliestKickoff: &later, MatchCount: 12},
		}
		plan, _ := PlanGameweeks(existing, days, lockMins)
		if len(plan.Update) != 1 || plan.Update[0].ID != "b" {
			t.Fatalf("expected the moved day's gameweek to be updated, got %+v", plan.Update)
		}
		if !plan.Update[0].Deadline.Equal(later.Add(-12 * time.Hour)) {
			t.Errorf("deadline did not follow the kickoff: %s", plan.Update[0].Deadline)
		}
	})

	// A day the whole season slid forward: same fixtures, new date.
	t.Run("a match day is rescheduled to a different date", func(t *testing.T) {
		days := []MatchDay{day("2026-10-08", 12), day("2026-10-20", 12)}
		plan, _ := PlanGameweeks(existing, days, lockMins)
		if len(plan.Delete) != 1 || plan.Delete[0] != "b" {
			t.Errorf("expected the old date's gameweek to go, got %v", plan.Delete)
		}
		if len(plan.Create) != 1 || plan.Create[0].Date != "2026-10-20" || plan.Create[0].Number != 2 {
			t.Errorf("expected a GW2 on the new date, got %+v", plan.Create)
		}
	})
}

// A played gameweek is history: points have been awarded against its number.
func TestPlanGameweeksNeverDisturbsPlayedGameweeks(t *testing.T) {
	for _, status := range []GameweekStatus{GameweekLocked, GameweekLive, GameweekFinalized} {
		t.Run(string(status)+" is frozen", func(t *testing.T) {
			existing := []ScheduledGameweek{
				gwOn("played", 1, "2026-10-08", status, lockMins),
				gwOn("open", 2, "2026-10-18", GameweekScheduled, lockMins),
			}
			// Its fixtures vanish, and its kickoff would have moved.
			days := []MatchDay{day("2026-10-18", 12)}

			plan, _ := PlanGameweeks(existing, days, lockMins)
			for _, id := range plan.Delete {
				if id == "played" {
					t.Error("a played gameweek must never be deleted")
				}
			}
			for _, u := range plan.Update {
				if u.ID == "played" {
					t.Error("a played gameweek must never be renumbered or re-timed")
				}
			}
			if len(plan.Frozen) != 1 || plan.Frozen[0] != "played" {
				t.Errorf("expected the played gameweek to be reported frozen, got %v", plan.Frozen)
			}
			if len(plan.Notices) == 0 {
				t.Error("expected a notice that a played gameweek has lost its fixtures")
			}
		})
	}
}

// The case that drove the design: a fixture appears earlier in the calendar than
// a gameweek that has already been played. It cannot be numbered in order
// without shifting history, so it takes the next free number and says so.
func TestPlanGameweeksHandlesADayAddedBeforePlayedOnes(t *testing.T) {
	existing := []ScheduledGameweek{
		gwOn("gw1", 1, "2026-10-08", GameweekFinalized, lockMins),
		gwOn("gw2", 2, "2026-10-18", GameweekFinalized, lockMins),
		gwOn("gw3", 3, "2026-10-25", GameweekScheduled, lockMins),
	}
	days := []MatchDay{
		day("2026-10-08", 12),
		day("2026-10-12", 4), // the newcomer, between two finalised gameweeks
		day("2026-10-18", 12),
		day("2026-10-25", 12),
	}

	plan, err := PlanGameweeks(existing, days, lockMins)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Numbers 1 and 2 are locked down by the finalised gameweeks, so the two
	// days still in play take 3 and 4 — and they take them in calendar order, so
	// the part of the schedule still to come reads correctly even though the new
	// day sits behind an already-played Gameweek 2.
	//
	// The alternative, pinning 2026-10-25 at its existing GW3 and giving the
	// newcomer GW4, would put Gameweek 4 *before* Gameweek 3 in the calendar.
	// Renumbering a scheduled gameweek is cheap — lineups hang off gameweek_id,
	// not the number — so the coherent ordering wins.
	byDate := numbersByDate(t, plan)
	if byDate["2026-10-12"] != 3 {
		t.Errorf("the new day should take the first free number 3, got %d", byDate["2026-10-12"])
	}
	if byDate["2026-10-25"] != 4 {
		t.Errorf("the later day should follow it at 4, got %d", byDate["2026-10-25"])
	}
	if byDate["2026-10-12"] >= byDate["2026-10-25"] {
		t.Error("the days still to be played must be numbered in calendar order among themselves")
	}

	// Nothing finalised moved.
	for _, u := range plan.Update {
		if u.Date == "2026-10-08" || u.Date == "2026-10-18" {
			t.Errorf("a finalised gameweek was rewritten: %+v", u)
		}
	}
	if len(plan.Delete) != 0 {
		t.Errorf("nothing should be deleted, got %v", plan.Delete)
	}

	var told bool
	for _, n := range plan.Notices {
		if strings.Contains(n, "2026-10-12") && strings.Contains(n, "Gameweek 3") {
			told = true
		}
	}
	if !told {
		t.Errorf("expected a notice explaining the out-of-order number, got %v", plan.Notices)
	}
}

func TestDeadlineFor(t *testing.T) {
	t.Run("subtracts the lock window from the first kickoff", func(t *testing.T) {
		got, err := DeadlineFor(day("2026-10-08", 1), 720)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if want := kickoff("2026-10-08").Add(-12 * time.Hour); !got.Equal(want) {
			t.Errorf("got %s, want %s", got, want)
		}
	})

	// No kickoff on file must lock early, never leave a match day unlocked.
	t.Run("falls back to the start of the day when no kickoff is known", func(t *testing.T) {
		got, err := DeadlineFor(MatchDay{Date: "2026-10-08"}, 720)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.After(*kickoff("2026-10-08")) {
			t.Errorf("fallback deadline %s is after kickoff", got)
		}
	})

	t.Run("refuses a date it cannot parse", func(t *testing.T) {
		if _, err := DeadlineFor(MatchDay{Date: "not-a-date"}, 720); err == nil {
			t.Error("expected an unparseable date to be rejected")
		}
	})
}
