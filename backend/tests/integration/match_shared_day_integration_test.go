package tests_integration

// Integration coverage for the "another tournament plays that day" lookup, which
// is hand-written SQL. Fixtures are ZZSHARED competitions with matches in 2095,
// removed before and after, so it is safe against a database holding real data.
//
// Skipped automatically when TEST_DB_DSN is unset.

import (
	"context"
	"testing"

	"showtime-backend/internal/ports"
)

func TestFindMatchesInOtherCompetitions(t *testing.T) {
	pool := siteEventsPool(t)
	ctx := context.Background()
	clean := func() {
		mustExec(t, pool, `DELETE FROM competitions WHERE name LIKE 'ZZSHARED%'`)
		mustExec(t, pool, `DELETE FROM teams WHERE name LIKE 'ZZSHARED%'`)
	}
	clean()
	t.Cleanup(clean)

	var season, cup, third, home string
	for name, dest := range map[string]*string{"ZZSHARED Season": &season, "ZZSHARED Cup": &cup, "ZZSHARED Third": &third} {
		if err := pool.QueryRow(ctx, `INSERT INTO competitions (name) VALUES ($1) RETURNING id::text`, name).Scan(dest); err != nil {
			t.Fatal(err)
		}
	}
	if err := pool.QueryRow(ctx, `INSERT INTO teams (name) VALUES ('ZZSHARED Rebels') RETURNING id::text`).Scan(&home); err != nil {
		t.Fatal(err)
	}

	var cupMatchID, postponedID string
	// The Cup plays 14 Nov at 15:00 with a named team; a TBD slot the same day;
	// a postponed one; and another day entirely.
	if err := pool.QueryRow(ctx, `INSERT INTO matches (competition_id, home_team_id, date, time, venue, status)
		VALUES ($1, $2, '2095-11-14', '15:00', 'Cup Ground', 'SCHEDULED') RETURNING id::text`, cup, home).Scan(&cupMatchID); err != nil {
		t.Fatal(err)
	}
	mustExec(t, pool, `INSERT INTO matches (competition_id, date, time, status) VALUES ($1, '2095-11-14', '13:00', 'SCHEDULED')`, cup)
	if err := pool.QueryRow(ctx, `INSERT INTO matches (competition_id, date, time, status)
		VALUES ($1, '2095-11-14', '09:00', 'POSTPONED') RETURNING id::text`, cup).Scan(&postponedID); err != nil {
		t.Fatal(err)
	}
	mustExec(t, pool, `INSERT INTO matches (competition_id, date, time, status) VALUES ($1, '2095-11-21', '15:00', 'SCHEDULED')`, cup)
	// The Season's own match on the day must never count against the Season.
	mustExec(t, pool, `INSERT INTO matches (competition_id, date, time, status) VALUES ($1, '2095-11-14', '11:00', 'SCHEDULED')`, season)

	repo := ports.NewMatchRepository(pool)

	got, err := repo.FindMatchesInOtherCompetitions(ctx, "2095-11-14", season, "")
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 {
		t.Fatalf("expected the Cup's 2 live matches (not the postponed one, not the Season's own), got %d: %+v", len(got), got)
	}
	// Earliest first, within the tournament; tournament name carried for display.
	if got[0].StartTime != "13:00" || got[0].HomeTeam != "TBD" || got[0].CompetitionName != "ZZSHARED Cup" {
		t.Errorf("first match: %+v", got[0])
	}
	if got[1].StartTime != "15:00" || got[1].HomeTeam != "ZZSHARED Rebels" || got[1].Venue != "Cup Ground" || got[1].MatchID != cupMatchID {
		t.Errorf("second match: %+v", got[1])
	}
	for _, m := range got {
		if m.MatchID == postponedID {
			t.Error("a postponed match is not being played that day and must not be listed")
		}
	}

	// Moving a match: it must not be flagged against itself.
	got, _ = repo.FindMatchesInOtherCompetitions(ctx, "2095-11-14", season, cupMatchID)
	if len(got) != 1 || got[0].MatchID == cupMatchID {
		t.Errorf("the match being moved should be left out, got %+v", got)
	}

	// The Cup looking at the same day sees the Season's match instead.
	got, _ = repo.FindMatchesInOtherCompetitions(ctx, "2095-11-14", cup, "")
	if len(got) != 1 || got[0].CompetitionName != "ZZSHARED Season" {
		t.Errorf("from the Cup's side expected the Season's match, got %+v", got)
	}

	// A day nobody else plays on is clear.
	got, _ = repo.FindMatchesInOtherCompetitions(ctx, "2095-12-25", season, "")
	if len(got) != 0 {
		t.Errorf("an empty day should return nothing, got %+v", got)
	}
	got, _ = repo.FindMatchesInOtherCompetitions(ctx, "2095-11-14", third, "")
	if len(got) != 3 {
		t.Errorf("a third tournament sees the Cup's 2 and the Season's 1, got %d", len(got))
	}
}
