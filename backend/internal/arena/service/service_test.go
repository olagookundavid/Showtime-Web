package service

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"showtime-backend/internal/arena/domain"
	"showtime-backend/internal/arena/store"
	"showtime-backend/internal/arena/testdb"

	"github.com/jackc/pgx/v5/pgxpool"
)

type fakeMail struct {
	mu   sync.Mutex
	sent []string
}

func (f *fakeMail) SendEmail(to, subject, body string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.sent = append(f.sent, to+"|"+subject)
	return nil
}

func (f *fakeMail) count(sub string) int {
	f.mu.Lock()
	defer f.mu.Unlock()
	n := 0
	for _, s := range f.sent {
		if strings.Contains(s, sub) {
			n++
		}
	}
	return n
}

func newUser(t *testing.T, pool *pgxpool.Pool, email string) string {
	t.Helper()
	var id string
	if err := pool.QueryRow(context.Background(), `INSERT INTO users (full_name, email) VALUES ($1, $2) RETURNING id::text`, email, email).Scan(&id); err != nil {
		t.Fatal(err)
	}
	return id
}

// status asserts err is a service Error with the given HTTP status.
func status(t *testing.T, err error, want int, what string) {
	t.Helper()
	var se *Error
	if !errors.As(err, &se) {
		t.Fatalf("%s: want a %d error, got %v", what, want, err)
	}
	if se.Status != want {
		t.Fatalf("%s: want status %d, got %d (%s)", what, want, se.Status, se.Message)
	}
}

// curT is the running test, so must can wrap a call that returns (value, error).
var curT *testing.T

func must[T any](v T, err error) T {
	curT.Helper()
	if err != nil {
		curT.Fatalf("unexpected error: %v", err)
	}
	return v
}

func TestTournamentLifecycle(t *testing.T) {
	curT = t
	pool := testdb.New(t)
	ctx := context.Background()
	mail := &fakeMail{}
	svc := New(store.New(pool), mail, "https://arena.example")
	// Pin "now" so kick-off locks and contract dates are deterministic.
	svc.now = func() time.Time { return time.Date(2026, 10, 14, 12, 0, 0, 0, domain.Lagos) }

	// ---- setup -----------------------------------------------------------
	sea := must(svc.CreateSeason(ctx, SeasonInput{Number: 4, Name: "Season 04", StartsOn: "2026-10-12", EndsOn: "2026-12-31"}))
	if _, err := svc.CreateSeason(ctx, SeasonInput{Number: 4, Name: "Dup"}); err == nil {
		t.Fatal("duplicate season number should fail")
	} else {
		status(t, err, http.StatusConflict, "duplicate season")
	}
	div := must(svc.CreateDivision(ctx, sea.ID, DivisionInput{Name: "Premier Division", PlayoffSpots: 4, KickoffDay: 0, KickoffSlots: []string{"20:00", "20:30"}}))
	if _, err := svc.CreateDivision(ctx, sea.ID, DivisionInput{Name: "x", PlayoffSpots: 3, KickoffSlots: []string{"20:00"}}); err == nil {
		t.Fatal("bad division should fail")
	}

	names := []string{"Lagos Legends", "Royal Elite", "Phantom FC", "Atlas United"}
	shorts := []string{"LL", "RE", "PH", "AU"}
	var clubs []*domain.Club
	managers := map[string]string{} // club id -> manager user id
	for i, n := range names {
		email := fmt.Sprintf("manager%d@example.com", i)
		uid := newUser(t, pool, email)
		c := must(svc.CreateClub(ctx, ClubInput{Name: n, Short: strings.ToLower(shorts[i]), Color: "#284D40", DivisionID: div.ID, ManagerEmail: email}))
		if c.Short != shorts[i] || c.Color != "#284d40" || c.ManagerUserID == nil || *c.ManagerUserID != uid || c.DivisionID == nil {
			t.Fatalf("club not set up as expected: %+v", c)
		}
		clubs = append(clubs, c)
		managers[c.ID] = uid
	}
	if _, err := svc.CreateClub(ctx, ClubInput{Name: "Bad", Short: "TOOLONG"}); err == nil {
		t.Fatal("bad abbreviation should fail")
	}
	if _, err := svc.CreateClub(ctx, ClubInput{Name: "Ghost FC", Short: "GH", ManagerEmail: "nobody@example.com"}); err == nil {
		t.Fatal("manager with no account should fail")
	} else {
		status(t, err, http.StatusBadRequest, "unknown manager")
	}
	if _, err := svc.CreateClub(ctx, ClubInput{Name: "Copycat", Short: "CC", ManagerEmail: "manager0@example.com"}); err == nil {
		t.Fatal("a person can't manage two clubs")
	} else {
		status(t, err, http.StatusConflict, "second club for one manager")
	}

	// Each club gets 13 players: a GK plus twelve outfielders.
	positions := []string{"GK", "CB", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST", "ST", "CB"}
	players := map[string][]*domain.Player{}
	for ci, c := range clubs {
		for pi, pos := range positions {
			p := must(svc.CreatePlayer(ctx, PlayerInput{
				Gamertag: fmt.Sprintf("%s_%02d", shorts[ci], pi), Platform: "PS", PrimaryPosition: pos, ClubID: c.ID, Shirt: pi + 1,
			}))
			players[c.ID] = append(players[c.ID], p)
		}
	}
	if _, err := svc.CreatePlayer(ctx, PlayerInput{Gamertag: "LL_00", PrimaryPosition: "ST"}); err == nil {
		t.Fatal("duplicate gamertag should fail")
	}

	// ---- fixtures ---------------------------------------------------------
	preview := must(svc.PreviewFixtures(ctx, div.ID, FixtureRequest{FirstDate: "2026-10-12"}))
	if len(preview.Fixtures) != 12 || preview.Matchweeks != 6 {
		t.Fatalf("preview: %d fixtures over %d weeks", len(preview.Fixtures), preview.Matchweeks)
	}
	plan := must(svc.GenerateFixtures(ctx, div.ID, FixtureRequest{FirstDate: "2026-10-12"}))
	if len(plan.Fixtures) != 12 {
		t.Fatalf("generated %d", len(plan.Fixtures))
	}
	if _, err := svc.GenerateFixtures(ctx, div.ID, FixtureRequest{}); err == nil {
		t.Fatal("generating twice should fail")
	} else {
		status(t, err, http.StatusConflict, "second generation")
	}
	if _, err := svc.SetDivisionClubs(ctx, div.ID, []string{clubs[0].ID}); err == nil {
		t.Fatal("clubs can't change once fixtures exist")
	} else {
		status(t, err, http.StatusConflict, "club change after fixtures")
	}

	// Starting a season needs a division with clubs; ours has them.
	must(svc.SetSeasonStatus(ctx, sea.ID, domain.SeasonActive))
	if _, err := svc.GeneratePlayoffs(ctx, div.ID); err == nil {
		t.Fatal("playoffs before the league is finished should fail")
	}

	// ---- results ----------------------------------------------------------
	all := must(svc.Matches(ctx, div.ID, "", ""))
	if len(all.Matches) != 12 {
		t.Fatalf("matches: %d", len(all.Matches))
	}
	first := all.Matches[0]

	// Stats must add up to the score, name squad members and have one MOTM.
	home := players[*first.HomeClubID]
	away := players[*first.AwayClubID]
	rating := 8.4
	bad := ResultInput{HomeScore: 2, AwayScore: 1, Stats: []StatLine{
		{PlayerID: home[10].ID, ClubID: *first.HomeClubID, Started: true, Goals: 1, Rating: &rating},
	}}
	if _, err := svc.RecordResult(ctx, first.ID, bad); err == nil || !strings.Contains(err.Error(), "add up") {
		t.Fatalf("goals that don't add up should be refused, got %v", err)
	}
	bad.Stats = []StatLine{{PlayerID: away[10].ID, ClubID: *first.HomeClubID, Goals: 2}}
	if _, err := svc.RecordResult(ctx, first.ID, bad); err == nil || !strings.Contains(err.Error(), "squad") {
		t.Fatalf("a player from the other club should be refused, got %v", err)
	}
	bad.Stats = []StatLine{{PlayerID: home[10].ID, ClubID: *first.HomeClubID, Goals: 2, MOTM: true}, {PlayerID: home[11].ID, ClubID: *first.HomeClubID, MOTM: true}}
	if _, err := svc.RecordResult(ctx, first.ID, bad); err == nil || !strings.Contains(err.Error(), "man of the match") {
		t.Fatalf("two MOTMs should be refused, got %v", err)
	}
	good := ResultInput{HomeScore: 2, AwayScore: 1, Stats: []StatLine{
		{PlayerID: home[10].ID, ClubID: *first.HomeClubID, Started: true, Goals: 1, Assists: 0, Rating: &rating, MOTM: true},
		{PlayerID: home[11].ID, ClubID: *first.HomeClubID, Started: true, Goals: 1, Assists: 1},
		{PlayerID: away[10].ID, ClubID: *first.AwayClubID, Started: true, Goals: 1},
	}}
	m := must(svc.RecordResult(ctx, first.ID, good))
	if !m.Played() || *m.HomeScore != 2 {
		t.Fatalf("result not saved: %+v", m)
	}
	// Re-recording replaces the stats rather than doubling them.
	good.Stats[0].Goals, good.Stats[1].Goals = 2, 0
	must(svc.RecordResult(ctx, first.ID, good))
	detail := must(svc.MatchDetail(ctx, first.ID))
	goals := 0
	for _, st := range detail.Stats {
		goals += st.Goals
	}
	if len(detail.Stats) != 3 || goals != 3 {
		t.Fatalf("stats after edit: %d rows, %d goals", len(detail.Stats), goals)
	}
	if err := svc.DeleteFixtures(ctx, div.ID); err == nil {
		t.Fatal("fixtures can't be deleted once a result is in")
	}

	// The form shows what was entered.
	form := must(svc.ResultForm(ctx, first.ID))
	included := 0
	for _, p := range form.Home.Players {
		if p.Included {
			included++
		}
	}
	if included != 2 || len(form.Home.Players) != 13 {
		t.Fatalf("result form: %d included of %d", included, len(form.Home.Players))
	}

	// Forfeit: 3-0 to the winner, stats dropped.
	forfeit := must(svc.RecordResult(ctx, all.Matches[1].ID, ResultInput{ForfeitWinner: "away", Stats: []StatLine{{PlayerID: "ignored", ClubID: "ignored"}}}))
	if forfeit.Status != domain.MatchForfeit || *forfeit.AwayScore != 3 || *forfeit.HomeScore != 0 {
		t.Fatalf("forfeit: %+v", forfeit)
	}

	// Everything else gets a score: home wins 1-0 so the table is easy to predict.
	for _, mm := range all.Matches[2:] {
		must(svc.RecordResult(ctx, mm.ID, ResultInput{HomeScore: 1, AwayScore: 0}))
	}

	// ---- standings, overview, profile ------------------------------------
	st := must(svc.Standings(ctx, div.ID))
	if len(st.Rows) != 4 || st.Metrics.MatchesPlayed != 12 || st.Metrics.LastMatchweek != 6 {
		t.Fatalf("standings: %d rows, %+v", len(st.Rows), st.Metrics)
	}
	for i, r := range st.Rows {
		if r.Played != 6 || r.Rank != i+1 {
			t.Errorf("row %d: %+v", i, r)
		}
	}
	ov := must(svc.Overview(ctx, ""))
	if ov.Scope.Division == nil || len(ov.Latest) != 5 || len(ov.Upcoming) != 0 || ov.Metrics.Clubs != 4 || ov.Metrics.Players != 52 {
		t.Fatalf("overview: latest=%d upcoming=%d metrics=%+v", len(ov.Latest), len(ov.Upcoming), ov.Metrics)
	}
	if len(ov.TopScorers) == 0 || ov.TopScorers[0].Goals != 2 {
		t.Fatalf("top scorers: %+v", ov.TopScorers)
	}
	prof := must(svc.ClubProfile(ctx, clubs[0].Slug))
	if prof.Standing == nil || len(prof.Squad) != 13 {
		t.Fatalf("club profile: standing=%v squad=%d", prof.Standing, len(prof.Squad))
	}
	pp := must(svc.PlayerProfile(ctx, home[10].ID))
	if pp.Season == nil || pp.Season.Goals != 2 || len(pp.Recent) != 1 {
		t.Fatalf("player profile: %+v", pp)
	}

	// ---- playoffs ---------------------------------------------------------
	semis := must(svc.GeneratePlayoffs(ctx, div.ID))
	if len(semis) != 3 {
		t.Fatalf("bracket: %d matches", len(semis))
	}
	if _, err := svc.GeneratePlayoffs(ctx, div.ID); err == nil {
		t.Fatal("a second bracket should fail")
	}
	cur := must(svc.store.GetSeason(ctx, sea.ID))
	if cur.Status != domain.SeasonPlayoffs {
		t.Fatalf("season should be in the playoffs, is %s", cur.Status)
	}
	br := must(svc.Bracket(ctx, div.ID))
	if len(br.Semis) != 2 || br.Final == nil || br.Final.Home != nil {
		t.Fatalf("bracket view: %+v", br)
	}
	rank := st.Rows
	if *br.Semis[0].HomeClubID != rank[0].Club.ID || *br.Semis[0].AwayClubID != rank[3].Club.ID {
		t.Fatalf("semi 1 should be 1st v 4th: %+v", br.Semis[0])
	}
	// A knockout can't end level without penalties.
	if _, err := svc.RecordResult(ctx, br.Semis[0].ID, ResultInput{HomeScore: 1, AwayScore: 1}); err == nil {
		t.Fatal("a level knockout needs penalties")
	}
	must(svc.RecordResult(ctx, br.Semis[0].ID, ResultInput{HomeScore: 1, AwayScore: 1, PenaltyWinner: "away"}))
	must(svc.RecordResult(ctx, br.Semis[1].ID, ResultInput{HomeScore: 3, AwayScore: 2}))
	br = must(svc.Bracket(ctx, div.ID))
	if br.Final.Home == nil || br.Final.Away == nil ||
		br.Final.Home.ID != rank[3].Club.ID || br.Final.Away.ID != rank[1].Club.ID {
		t.Fatalf("final should be 4th v 2nd after the semis: %+v / %+v", br.Final.Home, br.Final.Away)
	}
	must(svc.RecordResult(ctx, br.Final.ID, ResultInput{HomeScore: 2, AwayScore: 0}))
	if _, err := svc.RecordResult(ctx, br.Semis[0].ID, ResultInput{HomeScore: 5, AwayScore: 0}); err == nil {
		t.Fatal("a semi can't change after the final was played")
	} else {
		status(t, err, http.StatusConflict, "locked semi")
	}
	br = must(svc.Bracket(ctx, div.ID))
	if br.Champion == nil || br.Champion.ID != rank[3].Club.ID {
		t.Fatalf("champion: %+v", br.Champion)
	}
	must(svc.SetSeasonStatus(ctx, sea.ID, domain.SeasonCompleted))
	if _, err := svc.SetSeasonStatus(ctx, sea.ID, domain.SeasonActive); err == nil {
		t.Fatal("a completed season can't restart")
	}
}

func TestTransfersAndTeamSheets(t *testing.T) {
	curT = t
	pool := testdb.New(t)
	ctx := context.Background()
	mail := &fakeMail{}
	svc := New(store.New(pool), mail, "https://arena.example")
	now := time.Date(2026, 10, 14, 12, 0, 0, 0, domain.Lagos)
	svc.now = func() time.Time { return now }

	sea := must(svc.CreateSeason(ctx, SeasonInput{Number: 4, Name: "Season 04", EndsOn: "2026-12-31"}))
	div := must(svc.CreateDivision(ctx, sea.ID, DivisionInput{Name: "Premier", PlayoffSpots: 2, KickoffSlots: []string{"20:00"}}))

	mgrA, mgrB := newUser(t, pool, "a@example.com"), newUser(t, pool, "b@example.com")
	clubA := must(svc.CreateClub(ctx, ClubInput{Name: "Alpha FC", Short: "AL", DivisionID: div.ID, ManagerEmail: "a@example.com"}))
	clubB := must(svc.CreateClub(ctx, ClubInput{Name: "Bravo FC", Short: "BR", DivisionID: div.ID, ManagerEmail: "b@example.com"}))

	squad := func(c *domain.Club, tag string) []*domain.Player {
		pos := []string{"GK", "CB", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST", "ST", "CM", "CB"}
		var out []*domain.Player
		for i, p := range pos {
			out = append(out, must(svc.CreatePlayer(ctx, PlayerInput{Gamertag: fmt.Sprintf("%s%02d", tag, i), PrimaryPosition: p, ClubID: c.ID, Shirt: i + 1})))
		}
		return out
	}
	sa, sb := squad(clubA, "A"), squad(clubB, "B")
	must(svc.GenerateFixtures(ctx, div.ID, FixtureRequest{FirstDate: "2026-10-18"}))
	must(svc.SetSeasonStatus(ctx, sea.ID, domain.SeasonActive))

	// ---- the window gates offers ------------------------------------------
	endDate := "2026-12-01"
	offer := OfferInput{PlayerID: sb[10].ID, SquadRole: "first_team", EndDate: endDate, FeeNGN: 5000, Terms: "Play on match nights."}
	if _, err := svc.MakeOffer(ctx, mgrA, offer); err == nil || !strings.Contains(err.Error(), "window") {
		t.Fatalf("an offer with the window closed should fail, got %v", err)
	}
	must(svc.SetTransferWindow(ctx, sea.ID, true))

	if _, err := svc.MakeOffer(ctx, newUser(t, pool, "nobody@example.com"), offer); err == nil {
		t.Fatal("only a club manager can make an offer")
	} else {
		status(t, err, http.StatusForbidden, "non-manager offer")
	}
	own := offer
	own.PlayerID = sa[3].ID
	if _, err := svc.MakeOffer(ctx, mgrA, own); err == nil {
		t.Fatal("offering to your own player should fail")
	}
	late := offer
	late.EndDate = "2027-02-01"
	if _, err := svc.MakeOffer(ctx, mgrA, late); err == nil {
		t.Fatal("a contract can't outlast the season")
	}

	// ---- free agent: straight to the player ---------------------------------
	pUser := newUser(t, pool, "free@example.com")
	free := must(svc.CreateMyPlayer(ctx, pUser, MyPlayerInput{Gamertag: "FreeBird", Platform: "XBOX", PrimaryPosition: "ST"}))
	if free.ClubID != nil {
		t.Fatal("a self-made profile starts as a free agent")
	}
	if _, err := svc.CreateMyPlayer(ctx, pUser, MyPlayerInput{Gamertag: "Second", PrimaryPosition: "ST"}); err == nil {
		t.Fatal("one profile per account")
	}
	k1 := must(svc.MakeOffer(ctx, mgrA, OfferInput{PlayerID: free.ID, SquadRole: "rotation", EndDate: endDate, FeeNGN: 0, Terms: "Welcome."}))
	if k1.Status != domain.ContractAwaitingPlayer || len(k1.Events) != 1 {
		t.Fatalf("free agent offer: %+v", k1)
	}
	k2 := must(svc.MakeOffer(ctx, mgrB, OfferInput{PlayerID: free.ID, SquadRole: "first_team", EndDate: endDate, Terms: "Join us."}))
	if _, err := svc.MakeOffer(ctx, mgrB, OfferInput{PlayerID: free.ID, EndDate: endDate, Terms: "Again."}); err == nil {
		t.Fatal("a second open offer from the same club should fail")
	} else {
		status(t, err, http.StatusConflict, "duplicate offer")
	}
	time.Sleep(50 * time.Millisecond)
	if mail.count("free@example.com") != 2 {
		t.Errorf("the player should be emailed about both offers, got %d", mail.count("free@example.com"))
	}

	// Someone else can't sign or reject it, and a wrong signature fails.
	other := newUser(t, pool, "other@example.com")
	must(svc.CreateMyPlayer(ctx, other, MyPlayerInput{Gamertag: "Other", PrimaryPosition: "CM"}))
	if _, err := svc.SignContract(ctx, other, k1.ID, SignInput{Signature: "FreeBird", Consent: true}); err == nil {
		t.Fatal("another player can't sign my offer")
	} else {
		status(t, err, http.StatusForbidden, "someone else signing")
	}
	if _, err := svc.SignContract(ctx, pUser, k1.ID, SignInput{Signature: "wrong", Consent: true}); err == nil {
		t.Fatal("wrong signature should fail")
	}
	if _, err := svc.SignContract(ctx, pUser, k1.ID, SignInput{Signature: "freebird", Consent: false}); err == nil {
		t.Fatal("consent is required")
	}
	signed := must(svc.SignContract(ctx, pUser, k1.ID, SignInput{Signature: "freebird", Consent: true}))
	if signed.Status != domain.ContractSigned || signed.Signature != "freebird" {
		t.Fatalf("signed: %+v", signed)
	}
	me := must(svc.GetPlayer(ctx, free.ID))
	if me.ClubID == nil || *me.ClubID != clubA.ID || me.ShirtNumber == nil || *me.ShirtNumber != 15 {
		t.Fatalf("after signing: %+v shirt=%v", me, me.ShirtNumber)
	}
	k2after := must(svc.store.GetContract(ctx, k2.ID))
	if k2after.Status != domain.ContractWithdrawn {
		t.Fatalf("the other offer should be withdrawn, is %s", k2after.Status)
	}
	if _, err := svc.SignContract(ctx, pUser, k1.ID, SignInput{Signature: "freebird", Consent: true}); err == nil {
		t.Fatal("signing twice should fail")
	}

	// ---- a registered player needs a release -------------------------------
	star := sb[10]
	k3 := must(svc.MakeOffer(ctx, mgrA, OfferInput{PlayerID: star.ID, SquadRole: "first_team", EndDate: endDate, Terms: "Come over."}))
	if k3.Status != domain.ContractAwaitingRelease || k3.FromClubID == nil || *k3.FromClubID != clubB.ID {
		t.Fatalf("registered player offer: %+v", k3)
	}
	starUser := newUser(t, pool, "star@example.com")
	must(svc.LinkPlayerUser(ctx, star.ID, "star@example.com"))
	if _, err := svc.SignContract(ctx, starUser, k3.ID, SignInput{Signature: star.Gamertag, Consent: true}); err == nil {
		t.Fatal("the player can't sign before their club releases them")
	}
	if _, err := svc.ApproveRelease(ctx, mgrA, k3.ID); err == nil {
		t.Fatal("only the current club can approve the release")
	} else {
		status(t, err, http.StatusForbidden, "wrong club approving")
	}

	// Team sheets: B submits one that names the star, then loses him.
	fixB := must(svc.ClubFixtures(ctx, clubB.ID))
	if len(fixB) != 2 {
		t.Fatalf("club B fixtures: %d", len(fixB))
	}
	ed := must(svc.GetSheetEditor(ctx, clubB.ID, fixB[0].ID, false))
	if ed.Locked || len(ed.Errors) != 0 || len(ed.Sheet.Starters) != 11 || ed.Sheet.Status != domain.SheetDraft {
		t.Fatalf("default editor: locked=%v errors=%v starters=%d", ed.Locked, ed.Errors, len(ed.Sheet.Starters))
	}
	starters := map[int]string{}
	for _, s := range ed.Sheet.Starters {
		starters[s.Index] = s.PlayerID
	}
	submit := SheetSave{Formation: ed.Sheet.Formation, Starters: starters, Bench: ed.Sheet.Bench, Captain: *ed.Sheet.CaptainPlayerID, Submit: true}
	namesStar := false
	for _, id := range starters {
		if id == star.ID {
			namesStar = true
		}
	}
	if !namesStar {
		t.Fatal("test setup: the auto-picked XI should include the striker")
	}
	subbed := must(svc.SaveSheet(ctx, clubB.ID, fixB[0].ID, submit, false))
	if subbed.Sheet.Status != domain.SheetSubmitted || subbed.Sheet.Revision != 1 {
		t.Fatalf("submitted: %+v", subbed.Sheet)
	}
	// The other club's manager can't touch it.
	if _, err := svc.SaveSheet(ctx, clubA.ID, fixB[0].ID, submit, false); err == nil {
		t.Fatal("a club can't save a sheet for a match it isn't in... with another club's players")
	}
	bad := submit
	bad.Starters = map[int]string{0: sa[0].ID}
	if _, err := svc.SaveSheet(ctx, clubB.ID, fixB[0].ID, bad, false); err == nil {
		t.Fatal("incomplete sheets can't be submitted")
	}
	draft := must(svc.SaveSheet(ctx, clubB.ID, fixB[0].ID, SheetSave{Formation: "4-3-3", Starters: map[int]string{0: sb[8].ID}}, false))
	if draft.Sheet.Status != domain.SheetDraft || draft.Sheet.Formation != "4-3-3" || len(draft.Sheet.Starters) != 1 {
		t.Fatalf("draft: %+v", draft.Sheet)
	}
	must(svc.SaveSheet(ctx, clubB.ID, fixB[0].ID, submit, false))

	// B approves the release; the player signs.
	if _, err := svc.ApproveRelease(ctx, mgrB, k3.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.SignContract(ctx, starUser, k3.ID, SignInput{Signature: star.Gamertag, Consent: true}); err != nil {
		t.Fatal(err)
	}
	moved := must(svc.GetPlayer(ctx, star.ID))
	if *moved.ClubID != clubA.ID || *moved.ShirtNumber != 11 && *moved.ShirtNumber == 0 {
		t.Fatalf("moved: %+v", moved)
	}
	after := must(svc.GetSheetEditor(ctx, clubB.ID, fixB[0].ID, false))
	if after.Sheet.Status != domain.SheetDraft || len(after.Sheet.Starters) != 10 {
		t.Fatalf("B's sheet should be reopened without the star: status=%s starters=%d", after.Sheet.Status, len(after.Sheet.Starters))
	}
	if !strings.Contains(after.Sheet.ReviewReason, "moved") {
		t.Errorf("review reason: %q", after.Sheet.ReviewReason)
	}
	if mail.count("left your club") != 1 {
		t.Errorf("B's manager should be told about the transfer, got %d", mail.count("left your club"))
	}

	// The shirt number clash is resolved: A already had #11 (ST).
	taken := must(svc.store.TakenShirts(ctx, clubA.ID))
	if len(taken) != 16 {
		t.Errorf("A's squad should have 16 distinct shirts, has %d", len(taken))
	}

	// ---- decline, reject, withdraw ------------------------------------------
	k4 := must(svc.MakeOffer(ctx, mgrB, OfferInput{PlayerID: sa[2].ID, EndDate: endDate, Terms: "Please."}))
	declined := must(svc.DeclineRelease(ctx, mgrA, k4.ID, "Not this year"))
	if declined.Status != domain.ContractReleaseDeclined || declined.Reason != "Not this year" {
		t.Fatalf("declined: %+v", declined)
	}
	k5 := must(svc.MakeOffer(ctx, mgrB, OfferInput{PlayerID: sa[3].ID, EndDate: endDate, Terms: "Please."}))
	if w := must(svc.WithdrawOffer(ctx, mgrB, k5.ID)); w.Status != domain.ContractWithdrawn {
		t.Fatalf("withdrawn: %+v", w)
	}
	if _, err := svc.WithdrawOffer(ctx, mgrB, k5.ID); err == nil {
		t.Fatal("withdrawing twice should fail")
	}
	// Reject: the free-agent path.
	fa2User := newUser(t, pool, "fa2@example.com")
	fa2 := must(svc.CreateMyPlayer(ctx, fa2User, MyPlayerInput{Gamertag: "Wanderer", PrimaryPosition: "CM"}))
	k6 := must(svc.MakeOffer(ctx, mgrB, OfferInput{PlayerID: fa2.ID, EndDate: endDate, Terms: "Join."}))
	if r := must(svc.RejectOffer(ctx, fa2User, k6.ID, "No thanks")); r.Status != domain.ContractRejected {
		t.Fatalf("rejected: %+v", r)
	}
	// Staff can close a stuck offer.
	k7 := must(svc.MakeOffer(ctx, mgrB, OfferInput{PlayerID: fa2.ID, EndDate: endDate, Terms: "Join."}))
	if w := must(svc.AdminWithdrawOffer(ctx, mgrA, k7.ID)); w.Status != domain.ContractWithdrawn {
		t.Fatalf("admin withdraw: %+v", w)
	}

	// Closing the window stops signing.
	k8 := must(svc.MakeOffer(ctx, mgrB, OfferInput{PlayerID: fa2.ID, EndDate: endDate, Terms: "Join."}))
	must(svc.SetTransferWindow(ctx, sea.ID, false))
	if _, err := svc.SignContract(ctx, fa2User, k8.ID, SignInput{Signature: "Wanderer", Consent: true}); err == nil || !strings.Contains(err.Error(), "window") {
		t.Fatalf("signing with the window closed should fail, got %v", err)
	}

	// ---- team sheet lock at kick-off ------------------------------------------
	ko := fixB[0].KickoffAt
	now = ko.Add(time.Minute)
	if _, err := svc.SaveSheet(ctx, clubB.ID, fixB[0].ID, submit, false); err == nil {
		t.Fatal("sheets lock at kick-off")
	} else {
		status(t, err, http.StatusConflict, "sheet after kick-off")
	}
	if _, err := svc.GetSheetEditor(ctx, clubB.ID, fixB[0].ID, true); err != nil {
		t.Fatal(err)
	}
	locked := must(svc.GetSheetEditor(ctx, clubB.ID, fixB[0].ID, false))
	if !locked.Locked {
		t.Fatal("the editor should report the lock")
	}
	staffEdit := must(svc.GetSheetEditor(ctx, clubB.ID, fixB[0].ID, true))
	if staffEdit.Locked {
		t.Fatal("staff can still edit at kick-off")
	}
}

func TestAdminRegistrationRules(t *testing.T) {
	curT = t
	pool := testdb.New(t)
	ctx := context.Background()
	svc := New(store.New(pool), nil, "")

	if _, err := svc.CreatePlayer(ctx, PlayerInput{Gamertag: "Early", PrimaryPosition: "ST", ClubID: "x"}); err == nil {
		t.Fatal("registering before a season exists should fail")
	}
	sea := must(svc.CreateSeason(ctx, SeasonInput{Number: 1, Name: "Season 01"}))
	div := must(svc.CreateDivision(ctx, sea.ID, DivisionInput{Name: "Div", PlayoffSpots: 0, KickoffSlots: []string{"19:00"}}))
	a := must(svc.CreateClub(ctx, ClubInput{Name: "A Club", Short: "AC", DivisionID: div.ID}))
	b := must(svc.CreateClub(ctx, ClubInput{Name: "B Club", Short: "BC", DivisionID: div.ID}))

	p := must(svc.CreatePlayer(ctx, PlayerInput{Gamertag: "Solo", PrimaryPosition: "GK", ClubID: a.ID, Shirt: 1}))
	if *p.ShirtNumber != 1 || p.ClubID == nil || *p.ClubID != a.ID {
		t.Fatalf("registered: %+v", p)
	}
	if _, err := svc.CreatePlayer(ctx, PlayerInput{Gamertag: "Duo", PrimaryPosition: "ST", ClubID: a.ID, Shirt: 1}); err == nil {
		t.Fatal("a shirt number can't be shared")
	} else {
		status(t, err, http.StatusConflict, "shared shirt")
	}
	// The failed creation must not leave a half-made player behind.
	if list := must(svc.ListPlayers(ctx, store.PlayerFilter{Query: "Duo"})); len(list) != 0 {
		t.Fatalf("a failed registration left a player behind: %+v", list)
	}
	auto := must(svc.CreatePlayer(ctx, PlayerInput{Gamertag: "Auto", PrimaryPosition: "ST", ClubID: a.ID}))
	if *auto.ShirtNumber != 2 {
		t.Fatalf("no preference should take the first free number, got %d", *auto.ShirtNumber)
	}
	if _, err := svc.RegisterPlayer(ctx, p.ID, b.ID, 5, ""); err == nil {
		t.Fatal("a registered player must be released before joining another club")
	} else {
		status(t, err, http.StatusConflict, "double registration")
	}
	released := must(svc.ReleasePlayer(ctx, p.ID))
	if released.ClubID != nil {
		t.Fatal("released players are free agents")
	}
	moved := must(svc.RegisterPlayer(ctx, p.ID, b.ID, 1, "reserve"))
	if *moved.ClubID != b.ID || moved.SquadRole != "reserve" {
		t.Fatalf("moved: %+v", moved)
	}
	if _, err := svc.RegisterPlayer(ctx, p.ID, b.ID, 100, ""); err == nil {
		t.Fatal("shirt numbers stop at 99")
	}

	// A club with players can't be deleted; an empty one can, and a played one can't.
	if err := svc.DeleteClub(ctx, a.ID); err == nil {
		t.Fatal("a club with players can't be deleted")
	}
	empty := must(svc.CreateClub(ctx, ClubInput{Name: "Empty FC", Short: "EF"}))
	if err := svc.DeleteClub(ctx, empty.ID); err != nil {
		t.Fatalf("an unused club can be deleted: %v", err)
	}
	if err := svc.DeletePlayer(ctx, auto.ID); err != nil {
		t.Fatalf("a player with no history can be deleted: %v", err)
	}

	// Manager and account linking.
	newUser(t, pool, "boss@example.com")
	c := must(svc.SetClubManager(ctx, a.ID, "boss@example.com"))
	if c.ManagerEmail != "boss@example.com" {
		t.Fatalf("manager: %+v", c)
	}
	c = must(svc.SetClubManager(ctx, a.ID, ""))
	if c.ManagerUserID != nil {
		t.Fatal("an empty email removes the manager")
	}
	if _, err := svc.LinkPlayerUser(ctx, p.ID, "ghost@example.com"); err == nil {
		t.Fatal("linking to an unknown account should fail")
	}

	// Season rules.
	if _, err := svc.SetSeasonStatus(ctx, sea.ID, domain.SeasonPlayoffs); err == nil {
		t.Fatal("a season in setup can't jump to playoffs")
	}
	bare := must(svc.CreateSeason(ctx, SeasonInput{Number: 9, Name: "Bare"}))
	must(svc.CreateDivision(ctx, bare.ID, DivisionInput{Name: "Empty", PlayoffSpots: 0, KickoffSlots: []string{"19:00"}}))
	if _, err := svc.SetSeasonStatus(ctx, bare.ID, domain.SeasonActive); err == nil {
		t.Fatal("a season needs a division with 2 clubs to start")
	}
	must(svc.SetSeasonStatus(ctx, sea.ID, domain.SeasonActive))
	s2 := must(svc.CreateSeason(ctx, SeasonInput{Number: 2, Name: "Season 02"}))
	d2 := must(svc.CreateDivision(ctx, s2.ID, DivisionInput{Name: "Div", PlayoffSpots: 2, KickoffSlots: []string{"19:00"}}))
	must(svc.SetDivisionClubs(ctx, d2.ID, []string{a.ID, b.ID}))
	if _, err := svc.SetSeasonStatus(ctx, s2.ID, domain.SeasonActive); err == nil {
		t.Fatal("two seasons can't be live at once")
	}
}
