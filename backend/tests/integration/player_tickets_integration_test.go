package tests_integration

// Integration coverage for player tickets: saving a team sheet hands every player
// named on it a ticket, the codes stay put across re-saves, players taken off lose
// theirs, and the gate sees which player a code belongs to.
//
// Fixtures are ZZFIX-named teams, players and competitions with matches in 2090,
// removed before and after. Skipped when TEST_DB_DSN is unset.

import (
	"context"
	"sync"
	"testing"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	appErrors "showtime-backend/internal/errors"
	"showtime-backend/internal/ports"
	"showtime-backend/internal/services"

	"github.com/jackc/pgx/v5/pgxpool"
)

func cleanPlayerTicketFixtures(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	mustExec(t, pool, `DELETE FROM tickets WHERE team_id IN (SELECT id FROM teams WHERE name LIKE 'ZZFIX%')`)
	mustExec(t, pool, `DELETE FROM competitions WHERE name LIKE 'ZZFIX%'`)
	mustExec(t, pool, `DELETE FROM players WHERE team_id IN (SELECT id FROM teams WHERE name LIKE 'ZZFIX%')`)
	mustExec(t, pool, `DELETE FROM teams WHERE name LIKE 'ZZFIX%'`)
	mustExec(t, pool, `DELETE FROM users WHERE email LIKE '%@playerticketfixture.test'`)
	mustExec(t, pool, `DELETE FROM event_days WHERE date >= '2089-01-01' OR date <= '1990-12-31'`)
}

// sentTicket is one player ticket the fake notifier was asked to send.
type sentTicket struct {
	code, email, team string
}

type fakePlayerNotifier struct {
	mu   sync.Mutex
	sent []sentTicket
}

func (n *fakePlayerNotifier) SendPlayerTicket(_ context.Context, t *domain.Ticket, _ *ports.PlayerTicketMatch, team string) {
	n.mu.Lock()
	defer n.mu.Unlock()
	n.sent = append(n.sent, sentTicket{code: t.TicketCode, email: t.Email, team: team})
}

type playerTicketFixture struct {
	pool     *pgxpool.Pool
	repo     *ports.PostgresPlayerTicketRepository
	tickets  *ports.PostgresTicketRepository
	notifier *fakePlayerNotifier
	service  *services.PlayerTicketService
	matches  *services.MatchService
	home     string
	away     string
	match    string
	players  map[string]string // name -> id, home team
}

// newPlayerTicketFixture is a match on 2090-06-06 between two teams, the home team
// with four players: two with an email, one whose claimed account has one, and one
// with neither.
func newPlayerTicketFixture(t *testing.T) *playerTicketFixture {
	pool := ticketPool(t)
	cleanPlayerTicketFixtures(t, pool)
	t.Cleanup(func() { cleanPlayerTicketFixtures(t, pool) })

	f := &playerTicketFixture{
		pool:     pool,
		repo:     ports.NewPlayerTicketRepository(pool),
		tickets:  ports.NewTicketRepository(pool),
		notifier: &fakePlayerNotifier{},
		players:  map[string]string{},
	}
	f.service = services.NewPlayerTicketService(f.repo, f.tickets, f.notifier)
	ms := services.NewMatchService(ports.NewMatchRepository(pool), nil, nil).(*services.MatchService)
	f.matches = ms.WithPlayerTickets(f.service)

	f.home = mustScan(t, pool, `INSERT INTO teams (name) VALUES ('ZZFIX Home') RETURNING id::text`)
	f.away = mustScan(t, pool, `INSERT INTO teams (name) VALUES ('ZZFIX Away') RETURNING id::text`)
	comp := mustScan(t, pool, `INSERT INTO competitions (name) VALUES ('ZZFIX League') RETURNING id::text`)
	f.match = mustScan(t, pool, `
		INSERT INTO matches (competition_id, home_team_id, away_team_id, date, time, venue)
		VALUES ($1, $2, $3, '2090-06-06', '14:30', 'Fixture Arena') RETURNING id::text`, comp, f.home, f.away)

	userID := mustScan(t, pool, `
		INSERT INTO users (full_name, email) VALUES ('ZZFIX Chidi', 'chidi@playerticketfixture.test') RETURNING id::text`)

	for _, p := range []struct {
		name, email string
		jersey      int
		user        *string
	}{
		{"Ada", "ada@playerticketfixture.test", 7, nil},
		{"Bola", "bola@playerticketfixture.test", 11, nil},
		{"Chidi", "", 23, &userID},
		{"Dayo", "", 45, nil},
	} {
		f.players[p.name] = mustScan(t, pool, `
			INSERT INTO players (name, jersey_number, position, team_id, email, user_id)
			VALUES ($1, $2, 'WR', $3, $4, $5) RETURNING id::text`,
			"ZZFIX "+p.name, p.jersey, f.home, p.email, p.user)
	}
	return f
}

func (f *playerTicketFixture) saveSheet(t *testing.T, names ...string) {
	t.Helper()
	ids := make([]string, len(names))
	for i, n := range names {
		ids[i] = f.players[n]
	}
	if err := f.matches.SaveTeamSheet(context.Background(), f.match, dto.SaveTeamSheetRequest{TeamID: f.home, PlayerIDs: ids}); err != nil {
		t.Fatalf("save sheet: %v", err)
	}
}

func (f *playerTicketFixture) sheet(t *testing.T) *dto.PlayerTicketSheetResponse {
	t.Helper()
	s, err := f.service.Sheet(context.Background(), f.match, f.home)
	if err != nil {
		t.Fatalf("sheet: %v", err)
	}
	return s
}

func codesByName(s *dto.PlayerTicketSheetResponse) map[string]string {
	out := map[string]string{}
	for _, p := range s.Players {
		out[p.Name] = p.TicketCode
	}
	return out
}

func TestPlayerTickets_SavingASheetIssuesEveryPlayerATicket(t *testing.T) {
	f := newPlayerTicketFixture(t)
	f.saveSheet(t, "Ada", "Bola", "Chidi", "Dayo")

	s := f.sheet(t)
	if s.Named != 4 || s.Issued != 4 || !s.CanIssue {
		t.Fatalf("named %d issued %d canIssue %v, want 4 4 true", s.Named, s.Issued, s.CanIssue)
	}
	if s.TeamName != "ZZFIX Home" || s.Opponent != "ZZFIX Away" || s.Match.Kickoff != "14:30" {
		t.Errorf("sheet heading = %q vs %q at %q", s.TeamName, s.Opponent, s.Match.Kickoff)
	}
	seen := map[string]bool{}
	for _, p := range s.Players {
		if p.TicketCode == "" || seen[p.TicketCode] {
			t.Errorf("%s has code %q (blank or repeated)", p.Name, p.TicketCode)
		}
		seen[p.TicketCode] = true
		if p.Status != "PAID" {
			t.Errorf("%s ticket is %s, want PAID", p.Name, p.Status)
		}
	}

	// Everyone with somewhere to send it is emailed: their own address, or the
	// one on the account that claimed them. Dayo has neither.
	if len(f.notifier.sent) != 3 {
		t.Fatalf("emailed %d players, want 3: %+v", len(f.notifier.sent), f.notifier.sent)
	}
	for _, p := range s.Players {
		if p.Name == "ZZFIX Dayo" && p.HasEmail {
			t.Error("Dayo has no email but the sheet says he has")
		}
		if p.Name == "ZZFIX Chidi" && !p.HasEmail {
			t.Error("Chidi's claimed account email should count")
		}
	}

	// The ticket is a real one for the match's game day, which was created for it,
	// and is not drawn from any ticket product.
	var dayDate string
	var productID *string
	if err := f.pool.QueryRow(context.Background(), `
		SELECT to_char(td.day_date, 'YYYY-MM-DD'), t.product_id::text FROM tickets t
		JOIN ticket_days td ON td.ticket_id = t.id
		WHERE t.player_id = $1 AND t.purchase_type = 'PLAYER'`, f.players["Ada"]).Scan(&dayDate, &productID); err != nil {
		t.Fatalf("read Ada's ticket: %v", err)
	}
	if dayDate != "2090-06-06" || productID != nil {
		t.Errorf("Ada's ticket is for %s on product %v, want 2090-06-06 and no product", dayDate, productID)
	}
}

func TestPlayerTickets_ReSavingKeepsCodesAndCancelsDroppedPlayers(t *testing.T) {
	f := newPlayerTicketFixture(t)
	ctx := context.Background()
	f.saveSheet(t, "Ada", "Bola", "Dayo")
	first := codesByName(f.sheet(t))
	f.notifier.sent = nil

	// Bola is dropped and Chidi comes in.
	f.saveSheet(t, "Ada", "Chidi", "Dayo")
	second := codesByName(f.sheet(t))
	for _, n := range []string{"ZZFIX Ada", "ZZFIX Dayo"} {
		if second[n] != first[n] {
			t.Errorf("%s's code changed from %s to %s", n, first[n], second[n])
		}
	}
	if len(f.notifier.sent) != 1 {
		t.Errorf("re-save emailed %d players, want only the new one", len(f.notifier.sent))
	}

	bola, err := f.tickets.GetByCode(ctx, first["ZZFIX Bola"])
	if err != nil {
		t.Fatal(err)
	}
	if bola.Status != domain.TicketStatusCancelled {
		t.Errorf("dropped player's ticket is %s, want CANCELLED", bola.Status)
	}

	// Put back, Bola gets a fresh ticket.
	f.saveSheet(t, "Ada", "Bola", "Chidi", "Dayo")
	third := codesByName(f.sheet(t))
	if third["ZZFIX Bola"] == "" || third["ZZFIX Bola"] == first["ZZFIX Bola"] {
		t.Errorf("Bola put back has code %q, want a new one", third["ZZFIX Bola"])
	}
}

func TestPlayerTickets_APlayerAlreadyInKeepsTheirTicketWhenDropped(t *testing.T) {
	f := newPlayerTicketFixture(t)
	ctx := context.Background()
	f.saveSheet(t, "Ada", "Bola")
	codes := codesByName(f.sheet(t))

	ada, _ := f.tickets.GetByCode(ctx, codes["ZZFIX Ada"])
	if err := f.tickets.CheckinDay(ctx, ada.ID, ada.Days[0].EventDayID, "gate"); err != nil {
		t.Fatalf("check in: %v", err)
	}
	f.saveSheet(t, "Bola")

	ada, _ = f.tickets.GetByCode(ctx, codes["ZZFIX Ada"])
	if ada.Status != domain.TicketStatusUsed {
		t.Errorf("checked-in player's ticket is %s after being dropped, want USED kept", ada.Status)
	}
}

func TestPlayerTickets_NoTicketsForAPlayedMatch(t *testing.T) {
	f := newPlayerTicketFixture(t)
	mustExec(t, f.pool, `UPDATE matches SET status = 'FINISHED' WHERE id = $1`, f.match)
	f.saveSheet(t, "Ada", "Bola")

	s := f.sheet(t)
	if s.Issued != 0 || s.CanIssue {
		t.Errorf("finished match: issued %d canIssue %v, want 0 false", s.Issued, s.CanIssue)
	}
}

func TestPlayerTickets_ConcurrentIssuesGiveOneTicketEach(t *testing.T) {
	f := newPlayerTicketFixture(t)
	mustExec(t, f.pool, `
		INSERT INTO match_team_sheets (match_id, team_id, player_id)
		SELECT $1, $2, unnest($3::uuid[])`, f.match, f.home,
		[]string{f.players["Ada"], f.players["Bola"], f.players["Chidi"], f.players["Dayo"]})

	var wg sync.WaitGroup
	for i := 0; i < 4; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, err := f.service.SyncSheet(context.Background(), f.match, f.home); err != nil {
				t.Errorf("sync: %v", err)
			}
		}()
	}
	wg.Wait()

	var live int
	if err := f.pool.QueryRow(context.Background(), `
		SELECT COUNT(*) FROM tickets WHERE match_id = $1 AND purchase_type = 'PLAYER' AND status <> 'CANCELLED'`,
		f.match).Scan(&live); err != nil {
		t.Fatal(err)
	}
	if live != 4 {
		t.Errorf("%d live tickets after concurrent issues, want 4", live)
	}
}

func TestPlayerTickets_GateSeesThePlayer(t *testing.T) {
	f := newPlayerTicketFixture(t)
	f.saveSheet(t, "Ada")
	code := codesByName(f.sheet(t))["ZZFIX Ada"]

	ticketService := services.NewTicketService(
		ports.NewEventDayRepository(f.pool), ports.NewTicketProductRepository(f.pool), f.tickets,
		ports.NewScheduledEmailRepository(f.pool), ports.NewSeasonPassRepository(f.pool),
		nil, nil, nil, nil, nil,
	).WithPlayerHolders(f.repo)

	res, err := ticketService.GetByCode(context.Background(), code)
	if err != nil {
		t.Fatal(err)
	}
	if res.PurchaseType != "PLAYER" || res.Player == nil {
		t.Fatalf("lookup = %s with player %+v", res.PurchaseType, res.Player)
	}
	p := res.Player
	if p.Name != "ZZFIX Ada" || p.JerseyNumber != 7 || p.TeamName != "ZZFIX Home" ||
		p.HomeTeam != "ZZFIX Home" || p.AwayTeam != "ZZFIX Away" || p.MatchDate != "2090-06-06" || p.Kickoff != "14:30" {
		t.Errorf("gate shows %+v", p)
	}
	if len(res.Days) != 1 || res.Days[0].Date != "2090-06-06" {
		t.Errorf("days = %+v, want the match's day", res.Days)
	}
}

func TestPlayerTickets_AreNotSalesAndDoNotUseTheGuestAllocation(t *testing.T) {
	f := newPlayerTicketFixture(t)
	ctx := context.Background()
	before, err := f.tickets.GetTotalTicketsSold(ctx)
	if err != nil {
		t.Fatal(err)
	}
	f.saveSheet(t, "Ada", "Bola")

	after, _ := f.tickets.GetTotalTicketsSold(ctx)
	if after != before {
		t.Errorf("tickets sold went from %d to %d; player tickets are not sales", before, after)
	}
	dayID, err := f.repo.EnsureGameDay(ctx, f.match)
	if err != nil {
		t.Fatal(err)
	}
	if n, _ := f.tickets.CountByTeamAndEventDay(ctx, f.home, dayID); n != 0 {
		t.Errorf("team allocation shows %d used, want 0", n)
	}
}

func TestPlayerTickets_AdminSeesEverySheetOnTheDay(t *testing.T) {
	f := newPlayerTicketFixture(t)
	ctx := context.Background()
	awayPlayer := mustScan(t, f.pool, `
		INSERT INTO players (name, jersey_number, team_id) VALUES ('ZZFIX Eze', 9, $1) RETURNING id::text`, f.away)
	f.saveSheet(t, "Ada", "Bola")
	if err := f.matches.SaveTeamSheet(ctx, f.match, dto.SaveTeamSheetRequest{TeamID: f.away, PlayerIDs: []string{awayPlayer}}); err != nil {
		t.Fatal(err)
	}

	days, err := f.service.SheetDays(ctx)
	if err != nil {
		t.Fatal(err)
	}
	var dayID string
	for _, d := range days {
		if d.Date == "2090-06-06" {
			dayID = d.ID
		}
	}
	if dayID == "" {
		t.Fatalf("2090-06-06 not among the days with sheets: %+v", days)
	}
	res, err := f.service.DaySheets(ctx, dayID)
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Sheets) != 2 || res.Sheets[0].TeamName != "ZZFIX Home" || res.Sheets[1].TeamName != "ZZFIX Away" {
		t.Fatalf("sheets = %+v, want home then away", res.Sheets)
	}
	if res.Sheets[0].Issued != 2 || res.Sheets[1].Issued != 1 {
		t.Errorf("issued %d and %d, want 2 and 1", res.Sheets[0].Issued, res.Sheets[1].Issued)
	}

	// The team manager's list has the match, without the player rows.
	list, err := f.service.TeamSheets(ctx, f.home)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 || list[0].Match.ID != f.match || list[0].Players != nil || list[0].Issued != 2 {
		t.Errorf("team list = %+v", list)
	}

	// A team not in the match cannot read its sheet.
	if _, err := f.service.Sheet(ctx, f.match, awayPlayer); err != services.ErrTeamNotInMatch {
		t.Errorf("sheet for a team not playing: err = %v", err)
	}
}

func TestPlayerTickets_APlayerSeesTheirOwnCodes(t *testing.T) {
	f := newPlayerTicketFixture(t)
	ctx := context.Background()
	f.saveSheet(t, "Ada", "Chidi")
	codes := codesByName(f.sheet(t))

	// Chidi's account is the one that claimed the player; Ada has no account.
	var chidiUser string
	if err := f.pool.QueryRow(ctx, `SELECT user_id::text FROM players WHERE id = $1`, f.players["Chidi"]).Scan(&chidiUser); err != nil {
		t.Fatal(err)
	}

	got, err := f.service.MyTickets(ctx, chidiUser)
	if err != nil {
		t.Fatalf("my tickets: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("Chidi sees %d tickets, want 1: %+v", len(got), got)
	}
	g := got[0]
	if g.TicketCode != codes["ZZFIX Chidi"] || g.TeamName != "ZZFIX Home" || g.Opponent != "ZZFIX Away" ||
		g.Match.Date != "2090-06-06" || g.Match.Kickoff != "14:30" || g.CheckedInAt != nil {
		t.Errorf("ticket = %+v", g)
	}

	// A dropped player no longer sees a code; one who was let in sees when.
	f.saveSheet(t, "Ada")
	if got, _ := f.service.MyTickets(ctx, chidiUser); len(got) != 0 {
		t.Errorf("dropped player still sees %d tickets", len(got))
	}

	// An account with no player behind it is told so, not shown an empty list.
	other := mustScan(t, f.pool, `INSERT INTO users (full_name, email) VALUES ('ZZFIX Nobody', 'nobody@playerticketfixture.test') RETURNING id::text`)
	if _, err := f.service.MyTickets(ctx, other); err != appErrors.ErrPlayerNotLinked {
		t.Errorf("unlinked account: err = %v, want ErrPlayerNotLinked", err)
	}
}
