package tests_integration

// Integration coverage for the cup schedule: dated slots for every round,
// record-based fills, the quarterfinal cut and winners moving up. The cup
// writes are hand-written SQL in transactions, so they run here against a
// real, fully-migrated schema.
//
// The main test replays the live 5v5 Cup as it stood on 3 Nov 2026 (Round 1
// played, Round 2 scheduled, nothing later dated) and plays it through to the
// semifinals. Fixtures are ZZCUP teams and competitions dated 2095 (2001 for
// the auto-fill test), deleted before and after.
//
// Skipped automatically when TEST_DB_DSN is unset; see
// fantasy_repo_integration_test.go for how to run.

import (
	"context"
	"os"
	"strings"
	"testing"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
	"showtime-backend/internal/services"

	"github.com/jackc/pgx/v5/pgxpool"
)

func cupPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dsn := strings.TrimSpace(os.Getenv("TEST_DB_DSN"))
	if dsn == "" {
		t.Skip("TEST_DB_DSN not set")
	}
	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	cleanCupFixtures(t, pool)
	t.Cleanup(func() {
		cleanCupFixtures(t, pool)
		pool.Close()
	})
	return pool
}

func cleanCupFixtures(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	ctx := context.Background()
	for _, q := range []string{
		`DELETE FROM matches WHERE competition_id IN (SELECT id FROM competitions WHERE name LIKE 'ZZCUP%')`,
		`DELETE FROM standings WHERE competition_id IN (SELECT id FROM competitions WHERE name LIKE 'ZZCUP%')`,
		`DELETE FROM competition_teams WHERE competition_id IN (SELECT id FROM competitions WHERE name LIKE 'ZZCUP%')`,
		`DELETE FROM competitions WHERE name LIKE 'ZZCUP%'`,
		`DELETE FROM teams WHERE name LIKE 'ZZCUP%'`,
	} {
		if _, err := pool.Exec(ctx, q); err != nil {
			t.Fatalf("clean cup fixtures: %v", err)
		}
	}
}

type cupFixture struct {
	pool   *pgxpool.Pool
	repo   *ports.PostgresMatchRepository
	ms     *services.MatchService
	compID string
	team   map[string]string // short name -> id
}

// newCupFixture creates a CUP competition with the 10 live cup teams.
func newCupFixture(t *testing.T, pool *pgxpool.Pool, name string) *cupFixture {
	t.Helper()
	ctx := context.Background()
	f := &cupFixture{pool: pool, repo: ports.NewMatchRepository(pool), team: map[string]string{}}
	f.ms = services.NewMatchService(f.repo, nil, nil).(*services.MatchService)

	names := []string{"ABIA", "CROSSRIVER", "RIVERS", "REBELS", "PANTHERS", "RAPTORS", "HORNS", "KNIGHTS", "GREENBACKS", "BRAVES"}
	ids := make([]string, 0, len(names))
	for _, n := range names {
		var id string
		if err := pool.QueryRow(ctx, `INSERT INTO teams (name, short_name, status) VALUES ($1, $2, 'active') RETURNING id::text`,
			"ZZCUP "+n+" "+name, n).Scan(&id); err != nil {
			t.Fatalf("insert team: %v", err)
		}
		f.team[n] = id
		ids = append(ids, id)
	}
	comp := &domain.Competition{Name: "ZZCUP " + name, Status: "active", Format: string(domain.CompetitionFormatCup), TeamIDs: ids}
	if err := f.repo.CreateCompetition(ctx, comp); err != nil {
		t.Fatalf("create competition: %v", err)
	}
	f.compID = comp.ID
	return f
}

// addMatch inserts a cup match directly, the way the live cup's were made.
func (f *cupFixture) addMatch(t *testing.T, round, date, kickoff, home, away string, hs, as *int) string {
	t.Helper()
	status := domain.MatchStatusScheduled
	if hs != nil {
		status = domain.MatchStatusFinished
	}
	var id string
	if err := f.pool.QueryRow(context.Background(),
		`INSERT INTO matches (competition_id, home_team_id, away_team_id, date, time, venue, status, home_score, away_score, round)
		 VALUES ($1, $2, $3, $4, $5, 'Showtime Arena', $6, $7, $8, $9) RETURNING id::text`,
		f.compID, f.team[home], f.team[away], date, kickoff, status, hs, as, round).Scan(&id); err != nil {
		t.Fatalf("insert match: %v", err)
	}
	return id
}

func (f *cupFixture) setCupRound(t *testing.T, round string) {
	t.Helper()
	if _, err := f.pool.Exec(context.Background(), `UPDATE competitions SET cup_round = $1 WHERE id = $2`, round, f.compID); err != nil {
		t.Fatalf("set cup_round: %v", err)
	}
}

func (f *cupFixture) matches(t *testing.T) map[string][]domain.Match {
	t.Helper()
	all, _, err := f.repo.GetMatches(context.Background(), f.compID, "", "", 1, 100, "")
	if err != nil {
		t.Fatalf("get matches: %v", err)
	}
	byRound := map[string][]domain.Match{}
	for _, m := range all {
		byRound[m.Round] = append(byRound[m.Round], m)
	}
	return byRound
}

// finish saves a result through the service, the way the admin form does.
func (f *cupFixture) finish(t *testing.T, matchID string, hs, as int) {
	t.Helper()
	ctx := context.Background()
	m, err := f.repo.GetMatchByID(ctx, matchID)
	if err != nil || m == nil {
		t.Fatalf("get match %s: %v", matchID, err)
	}
	m.Status = domain.MatchStatusFinished
	m.HomeScore, m.AwayScore = &hs, &as
	if err := f.ms.UpdateMatch(ctx, m); err != nil {
		t.Fatalf("finish match %s: %v", matchID, err)
	}
}

func (f *cupFixture) cupRound(t *testing.T) string {
	t.Helper()
	comp, err := f.repo.GetCompetitionByID(context.Background(), f.compID)
	if err != nil {
		t.Fatalf("get competition: %v", err)
	}
	if comp.CupRound == nil {
		return ""
	}
	return *comp.CupRound
}

func score(n int) *int { return &n }

func TestCupScheduleReplaysLiveCup(t *testing.T) {
	pool := cupPool(t)
	ctx := context.Background()
	f := newCupFixture(t, pool, "Live replay")

	// Round 1, as played on Sun 11 Oct 2026.
	r1 := [][4]any{
		{"13:20", "ABIA", "CROSSRIVER", [2]int{21, 12}},
		{"14:40", "RIVERS", "REBELS", [2]int{0, 56}},
		{"16:00", "PANTHERS", "RAPTORS", [2]int{22, 59}},
		{"17:20", "HORNS", "KNIGHTS", [2]int{18, 51}},
		{"18:40", "GREENBACKS", "BRAVES", [2]int{37, 7}},
	}
	for _, m := range r1 {
		s := m[3].([2]int)
		f.addMatch(t, domain.CupRound1, "2095-10-11", m[0].(string), m[1].(string), m[2].(string), score(s[0]), score(s[1]))
	}
	// Round 2, as scheduled for Sun 8 Nov 2026.
	r2 := [][3]string{
		{"13:20", "PANTHERS", "RIVERS"},
		{"14:40", "ABIA", "BRAVES"},
		{"16:00", "CROSSRIVER", "HORNS"},
		{"17:20", "REBELS", "RAPTORS"},
		{"18:40", "KNIGHTS", "GREENBACKS"},
	}
	r2IDs := map[string]string{}
	for _, m := range r2 {
		r2IDs[m[1]] = f.addMatch(t, domain.CupRound2, "2095-11-08", m[0], m[1], m[2], nil, nil)
	}
	f.setCupRound(t, domain.CupRound2)
	before := f.matches(t)

	// The live cup has nothing dated after Round 2.
	state, err := f.ms.GetCupState(ctx, f.compID)
	if err != nil {
		t.Fatalf("cup state: %v", err)
	}
	if strings.Join(state.MissingRounds, ",") != "ROUND_3,QUARTERFINAL,SEMIFINAL,FINAL" || state.CanAdvance {
		t.Fatalf("live cup state: missing %v, can_advance %v", state.MissingRounds, state.CanAdvance)
	}

	// Date the remaining rounds.
	setup := dto.SetupCupRequest{Venue: "Showtime Arena", Rounds: []dto.CupRoundDate{
		{Round: domain.CupRound3, Date: "2095-11-22", FirstKickoff: "13:20"},
		{Round: domain.CupRoundQF, Date: "2095-12-06", FirstKickoff: "13:20"},
		{Round: domain.CupRoundSF, Date: "2095-12-13", FirstKickoff: "15:00"},
		{Round: domain.CupRoundFinal, Date: "2095-12-20", FirstKickoff: "16:00"},
	}}
	if err := f.ms.SetupCup(ctx, f.compID, setup); err != nil {
		t.Fatalf("setup remaining rounds: %v", err)
	}
	after := f.matches(t)
	for round, n := range domain.CupRoundSlots {
		if len(after[round]) != n {
			t.Errorf("%s has %d slots, want %d", round, len(after[round]), n)
		}
	}
	for _, round := range []string{domain.CupRound1, domain.CupRound2} {
		ids := map[string]bool{}
		for _, m := range before[round] {
			ids[m.ID] = true
		}
		for _, m := range after[round] {
			if !ids[m.ID] {
				t.Errorf("%s match %s is new; the played and scheduled matches must be kept", round, m.ID)
			}
		}
	}
	kickoffs := map[string]bool{}
	for _, m := range after[domain.CupRound3] {
		if m.HomeTeamID != "" || m.AwayTeamID != "" {
			t.Errorf("Round 3 slots should be TBD")
		}
		kickoffs[m.StartTime.Format("15:04")] = true
	}
	for _, k := range []string{"13:20", "14:40", "16:00", "17:20", "18:40"} {
		if !kickoffs[k] {
			t.Errorf("no Round 3 slot at %s", k)
		}
	}
	if got := f.cupRound(t); got != domain.CupRound2 {
		t.Errorf("setup must not move the stage; cup_round = %s", got)
	}
	if err := f.ms.SetupCup(ctx, f.compID, setup); err == nil {
		t.Errorf("a second setup should be refused once every round has fixtures")
	}

	// Filling early is refused.
	if err := f.ms.FillCupRound(ctx, f.compID); err == nil {
		t.Errorf("Round 3 filled before Round 2 was played")
	}

	// Play Round 2 through the admin path. Winners: Panthers, Abia, Horns,
	// Raptors, Knights.
	f.finish(t, r2IDs["PANTHERS"], 20, 10)
	f.finish(t, r2IDs["ABIA"], 30, 14)
	f.finish(t, r2IDs["CROSSRIVER"], 7, 21)
	f.finish(t, r2IDs["REBELS"], 28, 35)
	f.finish(t, r2IDs["KNIGHTS"], 40, 12)
	for _, m := range f.matches(t)[domain.CupRound2] {
		if m.Round != domain.CupRound2 {
			t.Fatalf("saving a result dropped the round tag")
		}
	}

	state, _ = f.ms.GetCupState(ctx, f.compID)
	if !state.CanAdvance || state.NextRound != domain.CupRound3 || state.AutoFillOn != "2095-11-15" {
		t.Fatalf("after Round 2: can_advance %v next %s auto_fill_on %s", state.CanAdvance, state.NextRound, state.AutoFillOn)
	}

	if err := f.ms.FillCupRound(ctx, f.compID); err != nil {
		t.Fatalf("fill Round 3: %v", err)
	}
	if err := f.ms.FillCupRound(ctx, f.compID); err == nil {
		t.Errorf("a second fill should be refused")
	}

	// Round 3 pairs by record: 2-0 Abia, Raptors, Knights; 1-1 Rebels,
	// Greenbacks, Panthers, Horns; 0-2 Cross River, Rivers, Braves. With
	// groups of 3, 4 and 3, exactly two pairings must cross a record line.
	wins := map[string]int{}
	for _, round := range []string{domain.CupRound1, domain.CupRound2} {
		for _, m := range f.matches(t)[round] {
			if *m.HomeScore > *m.AwayScore {
				wins[m.HomeTeamID]++
			} else {
				wins[m.AwayTeamID]++
			}
		}
	}
	played := map[[2]string]bool{}
	for _, round := range []string{domain.CupRound1, domain.CupRound2} {
		for _, m := range f.matches(t)[round] {
			played[[2]string{m.HomeTeamID, m.AwayTeamID}] = true
			played[[2]string{m.AwayTeamID, m.HomeTeamID}] = true
		}
	}
	seen, crossed := map[string]bool{}, 0
	r3 := f.matches(t)[domain.CupRound3]
	for _, m := range r3 {
		if m.HomeTeamID == "" || m.AwayTeamID == "" {
			t.Fatalf("a Round 3 slot is still TBD after the fill")
		}
		if played[[2]string{m.HomeTeamID, m.AwayTeamID}] {
			t.Errorf("Round 3 rematch")
		}
		if wins[m.HomeTeamID] != wins[m.AwayTeamID] {
			crossed++
		}
		seen[m.HomeTeamID], seen[m.AwayTeamID] = true, true
	}
	if len(seen) != 10 || crossed != 2 {
		t.Errorf("Round 3: %d teams, %d cross-record pairings; want 10 and 2", len(seen), crossed)
	}
	if got := f.cupRound(t); got != domain.CupRound3 {
		t.Errorf("cup_round = %s, want ROUND_3", got)
	}

	// Play Round 3 (home side wins), then fill the quarterfinals.
	for _, m := range r3 {
		f.finish(t, m.ID, 24, 10)
	}
	if err := f.ms.FillCupRound(ctx, f.compID); err != nil {
		t.Fatalf("fill quarterfinals: %v", err)
	}
	st, err := f.repo.GetStandings(ctx, f.compID)
	if err != nil || len(st) < 10 {
		t.Fatalf("standings: %v (%d rows)", err, len(st))
	}
	want := map[int][2]string{
		1: {st[0].TeamID, st[4].TeamID}, // 1v5
		2: {st[3].TeamID, st[7].TeamID}, // 4v8
		3: {st[1].TeamID, st[5].TeamID}, // 2v6
		4: {st[2].TeamID, st[6].TeamID}, // 3v7
	}
	qfs := map[int]domain.Match{}
	for _, m := range f.matches(t)[domain.CupRoundQF] {
		qfs[*m.BracketPos] = m
		if w := want[*m.BracketPos]; m.HomeTeamID != w[0] || m.AwayTeamID != w[1] {
			t.Errorf("QF %d is %s v %s, want %s v %s", *m.BracketPos, m.HomeTeamID, m.AwayTeamID, w[0], w[1])
		}
	}
	if got := f.cupRound(t); got != domain.CupRoundQF {
		t.Errorf("cup_round = %s, want QUARTERFINAL", got)
	}

	// QF 1 and 2 feed SF 1; their winners move up without any click.
	f.finish(t, qfs[1].ID, 30, 20)
	f.finish(t, qfs[2].ID, 10, 17)
	var sf1 domain.Match
	for _, m := range f.matches(t)[domain.CupRoundSF] {
		if *m.BracketPos == 1 {
			sf1 = m
		}
	}
	if sf1.HomeTeamID != qfs[1].HomeTeamID || sf1.AwayTeamID != qfs[2].AwayTeamID {
		t.Errorf("SF 1 is %s v %s, want the QF 1 and QF 2 winners", sf1.HomeTeamID, sf1.AwayTeamID)
	}
	if err := f.ms.FillCupRound(ctx, f.compID); err == nil {
		t.Errorf("filling during the knockout should be refused")
	}
}

func TestCupAutoFillsAWeekAfterTheRound(t *testing.T) {
	pool := cupPool(t)
	ctx := context.Background()

	// AutoFillCupRounds looks at every active cup; don't run it against a
	// database that holds real ones.
	var others int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM competitions WHERE format = 'CUP' AND status = 'active' AND name NOT LIKE 'ZZCUP%'`).Scan(&others); err != nil {
		t.Fatalf("count cups: %v", err)
	}
	if others > 0 {
		t.Skip("database has real active cups")
	}

	f := newCupFixture(t, pool, "Auto fill")
	ms := [][2]string{{"ABIA", "CROSSRIVER"}, {"RIVERS", "REBELS"}, {"PANTHERS", "RAPTORS"}, {"HORNS", "KNIGHTS"}, {"GREENBACKS", "BRAVES"}}
	for i, m := range ms {
		f.addMatch(t, domain.CupRound1, "2001-01-07", []string{"13:20", "14:40", "16:00", "17:20", "18:40"}[i], m[0], m[1], score(20), score(10))
	}
	f.setCupRound(t, domain.CupRound1)
	if err := f.ms.SetupCup(ctx, f.compID, dto.SetupCupRequest{Rounds: []dto.CupRoundDate{
		{Round: domain.CupRound2, Date: "2001-01-14"},
		{Round: domain.CupRound3, Date: "2001-01-21"},
		{Round: domain.CupRoundQF, Date: "2001-01-28"},
		{Round: domain.CupRoundSF, Date: "2001-02-04"},
		{Round: domain.CupRoundFinal, Date: "2001-02-11"},
	}}); err != nil {
		t.Fatalf("setup: %v", err)
	}

	if err := f.ms.AutoFillCupRounds(ctx); err != nil {
		t.Fatalf("auto fill: %v", err)
	}
	if got := f.cupRound(t); got != domain.CupRound2 {
		t.Fatalf("a round finished long ago should have filled Round 2; cup_round = %s", got)
	}
	for _, m := range f.matches(t)[domain.CupRound2] {
		if m.HomeTeamID == "" || m.AwayTeamID == "" {
			t.Errorf("Round 2 slot still TBD after the auto fill")
		}
	}
	// Round 2 isn't played yet, so a second run changes nothing.
	if err := f.ms.AutoFillCupRounds(ctx); err != nil {
		t.Fatalf("second auto fill: %v", err)
	}
	if got := f.cupRound(t); got != domain.CupRound2 {
		t.Errorf("cup_round moved to %s with Round 2 unplayed", got)
	}
}
