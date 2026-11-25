package store

import (
	"context"
	"testing"

	"showtime-backend/internal/arena/domain"
	"showtime-backend/internal/arena/testdb"
)

// TestSchemaAndQueries is a smoke test: every query in this package runs against
// the real schema without a SQL error, and the main constraints hold.
func TestSchemaAndQueries(t *testing.T) {
	pool := testdb.New(t)
	ctx := context.Background()
	s := New(pool)

	season, err := s.CreateSeason(ctx, 4, "Season 04", nil, nil)
	if err != nil {
		t.Fatalf("create season: %v", err)
	}
	div, err := s.CreateDivision(ctx, season.ID, DivisionInput{Name: "Premier", PlayoffSpots: 4, KickoffDay: 0, KickoffSlots: []string{"20:00", "20:30"}})
	if err != nil {
		t.Fatalf("create division: %v", err)
	}

	var clubIDs []string
	for _, c := range []struct{ name, short string }{{"Lagos Legends", "LL"}, {"Royal Elite", "RE"}, {"Phantom FC", "PH"}, {"Atlas United", "AU"}} {
		id, err := s.CreateClub(ctx, ClubInput{Name: c.name, Short: c.short, Color: "#284d40"}, "club-"+c.short)
		if err != nil {
			t.Fatalf("create club %s: %v", c.name, err)
		}
		clubIDs = append(clubIDs, id)
	}
	if _, err := s.CreateClub(ctx, ClubInput{Name: "lagos legends", Short: "XX"}, "x"); err == nil {
		t.Error("club names are unique, ignoring case")
	}
	if _, err := s.CreateClub(ctx, ClubInput{Name: "Other", Short: "ll"}, "y"); err == nil {
		t.Error("short codes must be upper case")
	}
	// A second club with the same base slug gets a suffix instead of failing.
	if id, err := s.CreateClub(ctx, ClubInput{Name: "Lagos Legends B", Short: "LB"}, "club-LL"); err != nil || id == "" {
		t.Errorf("slug collision should be resolved: %v", err)
	}

	if err := s.SetDivisionClubs(ctx, div.ID, season.ID, clubIDs); err != nil {
		t.Fatalf("set division clubs: %v", err)
	}
	div, _ = s.GetDivision(ctx, div.ID)
	if div.ClubCount != 4 || div.Locked {
		t.Fatalf("division: %+v", div)
	}
	refs, err := s.DivisionClubRefs(ctx, div.ID)
	if err != nil || len(refs) != 4 {
		t.Fatalf("refs: %v %v", refs, err)
	}

	// A club is in one division per season.
	div2, err := s.CreateDivision(ctx, season.ID, DivisionInput{Name: "Championship", PlayoffSpots: 2, KickoffDay: 0, KickoffSlots: []string{"20:00"}})
	if err != nil {
		t.Fatal(err)
	}
	if err := s.SetDivisionClubs(ctx, div2.ID, season.ID, clubIDs[:1]); err != nil {
		t.Fatal(err)
	}
	d1, _ := s.GetDivision(ctx, div.ID)
	if d1.ClubCount != 3 {
		t.Errorf("moving a club out of its division should shrink it, got %d", d1.ClubCount)
	}
	if err := s.SetDivisionClubs(ctx, div.ID, season.ID, clubIDs); err != nil {
		t.Fatal(err)
	}

	// Fixtures, results, standings.
	fx, err := domain.GenerateFixtures(domain.FixtureInput{ClubIDs: clubIDs, FirstDate: refDate(), KickoffDay: 0, Slots: []string{"20:00", "20:30"}, Legs: 2})
	if err != nil {
		t.Fatal(err)
	}
	var firstMatch string
	for i, f := range fx {
		h, a, ko := f.HomeClubID, f.AwayClubID, f.KickoffAt
		id, err := s.InsertMatch(ctx, NewMatch{SeasonID: season.ID, DivisionID: div.ID, Stage: domain.StageLeague, Matchweek: f.Matchweek, HomeClubID: &h, AwayClubID: &a, KickoffAt: &ko})
		if err != nil {
			t.Fatalf("insert match: %v", err)
		}
		if i == 0 {
			firstMatch = id
		}
	}
	total, played, err := s.CountMatches(ctx, div.ID, domain.StageLeague)
	if err != nil || total != 12 || played != 0 {
		t.Fatalf("count: %d %d %v", total, played, err)
	}
	if err := s.SetResult(ctx, firstMatch, domain.MatchCompleted, 3, 1, nil); err != nil {
		t.Fatal(err)
	}
	m, err := s.GetMatch(ctx, firstMatch)
	if err != nil || !m.Played() || m.Home == nil || m.Away == nil {
		t.Fatalf("get match: %+v %v", m, err)
	}
	all, err := s.ListMatches(ctx, MatchFilter{DivisionID: div.ID})
	if err != nil || len(all) != 12 {
		t.Fatalf("list: %d %v", len(all), err)
	}
	results, _ := s.ListMatches(ctx, MatchFilter{DivisionID: div.ID, State: "results", Newest: true})
	upcoming, _ := s.ListMatches(ctx, MatchFilter{DivisionID: div.ID, State: "upcoming", Limit: 3})
	if len(results) != 1 || len(upcoming) != 3 {
		t.Errorf("results=%d upcoming=%d", len(results), len(upcoming))
	}
	forClub, _ := s.ListMatches(ctx, MatchFilter{ClubID: clubIDs[0]})
	if len(forClub) != 6 {
		t.Errorf("a club in a 4-club double round robin plays 6, got %d", len(forClub))
	}
	table := domain.ComputeStandings(refs, all)
	if table[0].Points != 3 || table[0].Club.ID != *m.HomeClubID {
		t.Errorf("table leader: %+v", table[0])
	}
	locked, _ := s.ClubsWithResults(ctx, div.ID)
	if !locked[*m.HomeClubID] || !locked[*m.AwayClubID] || len(locked) != 2 {
		t.Errorf("clubs with results: %v", locked)
	}

	// The result constraint: a completed match needs both scores.
	if _, err := pool.Exec(ctx, `UPDATE arena_matches SET status = 'completed', home_score = NULL WHERE id = $1`, forClub[0].ID); err == nil {
		t.Error("completed match without a score should be rejected")
	}

	// Players, registrations and shirt numbers.
	pid, err := s.CreatePlayer(ctx, PlayerInput{Gamertag: "Kaptain", Platform: "PS", PrimaryPosition: "CM"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.CreatePlayer(ctx, PlayerInput{Gamertag: "kaptain", Platform: "PS", PrimaryPosition: "ST"}); err == nil {
		t.Error("gamertags are unique ignoring case")
	}
	if err := s.CreateRegistration(ctx, pid, clubIDs[0], season.ID, 10, domain.RoleFirstTeam, nil); err != nil {
		t.Fatal(err)
	}
	pid2, _ := s.CreatePlayer(ctx, PlayerInput{Gamertag: "Rizo", Platform: "XBOX", PrimaryPosition: "ST"})
	if err := s.CreateRegistration(ctx, pid2, clubIDs[0], season.ID, 10, domain.RoleFirstTeam, nil); err == nil {
		t.Error("two players can't share a shirt number at a club")
	}
	if err := s.CreateRegistration(ctx, pid, clubIDs[1], season.ID, 7, domain.RoleFirstTeam, nil); err == nil {
		t.Error("a player can only be at one club")
	}
	roster, err := s.Roster(ctx, clubIDs[0])
	if err != nil || len(roster) != 1 || roster[0].Gamertag != "Kaptain" || roster[0].ShirtNumber == nil || *roster[0].ShirtNumber != 10 {
		t.Fatalf("roster: %+v %v", roster, err)
	}
	free, _ := s.ListPlayers(ctx, PlayerFilter{FreeAgents: true})
	if len(free) != 1 || free[0].Gamertag != "Rizo" {
		t.Errorf("free agents: %+v", free)
	}

	// Result stats feed the leaderboard.
	rating := 8.5
	if err := s.ReplaceMatchStats(ctx, firstMatch, []domain.PlayerStat{{PlayerID: pid, ClubID: clubIDs[0], Started: true, Goals: 2, Assists: 1, Rating: &rating, MOTM: true}}); err != nil {
		t.Fatalf("stats: %v", err)
	}
	stats, err := s.PlayerSeasonStats(ctx, PlayerStatsFilter{DivisionID: div.ID})
	if err != nil || len(stats) != 1 || stats[0].Goals != 2 || stats[0].Apps != 1 || stats[0].MOTMs != 1 || stats[0].AvgRating == nil || *stats[0].AvgRating != 8.5 {
		t.Fatalf("stats: %+v %v", stats, err)
	}

	// Contracts.
	season, _ = s.GetSeason(ctx, season.ID)
	cid, err := s.CreateContract(ctx, NewContract{SeasonID: season.ID, PlayerID: pid2, ClubID: clubIDs[0], SquadRole: domain.RoleFirstTeam,
		EndDate: refDate().AddDate(0, 1, 0), Terms: "Play.", Status: domain.ContractAwaitingPlayer})
	if err != nil {
		t.Fatalf("contract: %v", err)
	}
	if _, err := s.CreateContract(ctx, NewContract{SeasonID: season.ID, PlayerID: pid2, ClubID: clubIDs[0], SquadRole: domain.RoleFirstTeam,
		EndDate: refDate().AddDate(0, 1, 0), Terms: "Again.", Status: domain.ContractAwaitingPlayer}); err == nil {
		t.Error("a club can't have two open offers to one player")
	}
	if err := s.AddContractEvent(ctx, cid, "Offer sent", ""); err != nil {
		t.Fatal(err)
	}
	k, err := s.GetContract(ctx, cid)
	if err != nil || k.PlayerName != "Rizo" || len(k.Events) != 1 || k.EndDate == "" {
		t.Fatalf("contract: %+v %v", k, err)
	}
	if list, _ := s.ListContracts(ctx, ContractFilter{ClubID: clubIDs[0], Status: "open"}); len(list) != 1 {
		t.Errorf("open contracts: %d", len(list))
	}

	// Team sheets.
	rm, order, err := s.RosterMap(ctx, clubIDs[0])
	if err != nil || len(rm) != 1 {
		t.Fatal(err)
	}
	f, _ := domain.FormationByName("4-2-3-1")
	sheetID, err := s.LockSheet(ctx, forClub[1].ID, clubIDs[0])
	if err != nil {
		t.Fatalf("lock sheet: %v", err)
	}
	if err := s.SaveSheet(ctx, sheetID, domain.SheetInput{Formation: "4-2-3-1", Starters: map[int]string{0: order[0]}, Captain: order[0]}, f, domain.SheetSubmitted, true, ""); err != nil {
		t.Fatalf("save sheet: %v", err)
	}
	sh, err := s.GetSheet(ctx, forClub[1].ID, clubIDs[0])
	if err != nil || sh.Status != domain.SheetSubmitted || sh.Revision != 1 || len(sh.Starters) != 1 || sh.Starters[0].Position != "ST" {
		t.Fatalf("sheet: %+v %v", sh, err)
	}
	n, err := s.ReopenSheets(ctx, clubIDs[0], order[0], "squad changed")
	if err != nil || n != 1 {
		t.Errorf("reopen: %d %v", n, err)
	}
	if err := s.DropPlayerFromSheets(ctx, clubIDs[0], order[0]); err != nil {
		t.Fatal(err)
	}

	// Follows and listing queries.
	uid := insertUser(t, pool, "fan@example.com")
	if err := s.SetFollow(ctx, uid, clubIDs[2]); err != nil {
		t.Fatal(err)
	}
	if got, _ := s.GetFollow(ctx, uid); got != clubIDs[2] {
		t.Errorf("follow = %q", got)
	}
	if err := s.SetClubManager(ctx, clubIDs[0], &uid); err != nil {
		t.Fatal(err)
	}
	if err := s.SetClubManager(ctx, clubIDs[1], &uid); err == nil {
		t.Error("a user can manage only one club")
	}
	mc, err := s.GetClubByManager(ctx, uid, &season.ID)
	if err != nil || mc.ID != clubIDs[0] || mc.SquadSize != 1 || mc.DivisionName != "Premier" || !mc.HasPlayed {
		t.Fatalf("managed club: %+v %v", mc, err)
	}
	clubs, err := s.ListClubs(ctx, ClubFilter{SeasonID: &season.ID, DivisionID: div.ID})
	if err != nil || len(clubs) != 4 {
		t.Fatalf("clubs: %d %v", len(clubs), err)
	}
	if u, err := s.FindUserByEmail(ctx, "FAN@example.com"); err != nil || u.ID != uid {
		t.Errorf("find user: %+v %v", u, err)
	}
	cur, err := s.CurrentSeason(ctx)
	if err != nil || cur.ID != season.ID {
		t.Errorf("current season: %+v %v", cur, err)
	}
	if err := s.SetSeasonStatus(ctx, season.ID, domain.SeasonActive); err != nil {
		t.Fatal(err)
	}
	s2, err := s.CreateSeason(ctx, 5, "Season 05", nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := s.SetSeasonStatus(ctx, s2.ID, domain.SeasonActive); err == nil {
		t.Error("only one season can be live at a time")
	}

	// Deleting a division's matches.
	if _, err := s.db.Exec(ctx, `UPDATE arena_matches SET status = 'scheduled', home_score = NULL, away_score = NULL`); err != nil {
		t.Fatal(err)
	}
	if err := s.DeleteMatches(ctx, div.ID, domain.StageLeague); err != nil {
		t.Fatal(err)
	}
	if total, _, _ := s.CountMatches(ctx, div.ID, domain.StageLeague); total != 0 {
		t.Errorf("matches left: %d", total)
	}
}
