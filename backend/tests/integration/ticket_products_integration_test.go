package tests_integration

// Integration coverage for tickets linked to competitions, Game Pass days and the
// scheduled email queue.
//
// The seat locking, per-day check-in and expiry rules live in hand-written SQL,
// so these run them against a real, fully-migrated schema. Fixtures are named
// ZZFIX* / *@ticketfixture.test and sit on dates in 1990 and 2090, and are
// deleted before and after, so the test is safe to point at a database that also
// holds real data.
//
// Skipped automatically when TEST_DB_DSN is unset; see
// fantasy_repo_integration_test.go for how to run.

import (
	"context"
	"fmt"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
	"showtime-backend/internal/services"

	"github.com/jackc/pgx/v5/pgxpool"
)

func ticketPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dsn := strings.TrimSpace(os.Getenv("TEST_DB_DSN"))
	if dsn == "" {
		t.Skip("TEST_DB_DSN not set")
	}
	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

func cleanTicketFixtures(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	mustExec(t, pool, `DELETE FROM tickets WHERE email LIKE '%@ticketfixture.test'`)
	mustExec(t, pool, `DELETE FROM ticket_products WHERE name LIKE 'ZZFIX%'`)
	mustExec(t, pool, `DELETE FROM competitions WHERE name LIKE 'ZZFIX%'`)
	// Fixture match days sit in 1990 or 2090, including any made automatically
	// for a fixture competition's matches.
	mustExec(t, pool, `DELETE FROM event_days WHERE title LIKE 'ZZFIX%' OR date <= '1990-12-31' OR date >= '2089-01-01'`)
}

type ticketFixture struct {
	pool     *pgxpool.Pool
	days     *ports.PostgresEventDayRepository
	products *ports.PostgresTicketProductRepository
	tickets  *ports.PostgresTicketRepository
	emails   *ports.PostgresScheduledEmailRepository
}

func newTicketFixture(t *testing.T) *ticketFixture {
	pool := ticketPool(t)
	cleanTicketFixtures(t, pool)
	t.Cleanup(func() { cleanTicketFixtures(t, pool) })
	return &ticketFixture{
		pool:     pool,
		days:     ports.NewEventDayRepository(pool),
		products: ports.NewTicketProductRepository(pool),
		tickets:  ports.NewTicketRepository(pool),
		emails:   ports.NewScheduledEmailRepository(pool),
	}
}

func (f *ticketFixture) eventDay(t *testing.T, title, date string) *domain.EventDay {
	t.Helper()
	d, err := time.Parse("2006-01-02", date)
	if err != nil {
		t.Fatal(err)
	}
	ed := &domain.EventDay{Title: "ZZFIX " + title, Date: d, Venue: "Fixture Arena", IsActive: true}
	if err := f.days.Create(context.Background(), ed); err != nil {
		t.Fatalf("create event day %s: %v", title, err)
	}
	return ed
}

// competition makes a competition with one match on each of the given dates.
func (f *ticketFixture) competition(t *testing.T, name string, dates ...string) string {
	t.Helper()
	var id string
	if err := f.pool.QueryRow(context.Background(),
		`INSERT INTO competitions (name) VALUES ($1) RETURNING id::text`, "ZZFIX "+name).Scan(&id); err != nil {
		t.Fatalf("create competition %s: %v", name, err)
	}
	for _, d := range dates {
		mustExec(t, f.pool,
			`INSERT INTO matches (competition_id, date, time, venue) VALUES ($1, $2::date, '12:00', 'Fixture Arena')`, id, d)
	}
	return id
}

// product makes a ticket with the given seats per day, linked to the competitions.
func (f *ticketFixture) product(t *testing.T, name string, price, capacity int, competitionIDs ...string) *domain.TicketProduct {
	t.Helper()
	p := &domain.TicketProduct{
		Name: "ZZFIX " + name, Slug: "zzfix-" + strings.ToLower(name) + "-" + fmt.Sprint(time.Now().UnixNano()),
		BasePrice: price, Capacity: capacity, IsActive: true,
	}
	if err := f.products.CreateProduct(context.Background(), p); err != nil {
		t.Fatalf("create product %s: %v", name, err)
	}
	if err := f.products.SetProductCompetitions(context.Background(), p.ID, competitionIDs); err != nil {
		t.Fatalf("link product %s: %v", name, err)
	}
	return p
}

// productDay is the seat-lock row for the ticket on a match day, as a purchase
// would resolve it. The day must be on sale for the ticket.
func (f *ticketFixture) productDay(t *testing.T, p *domain.TicketProduct, ed *domain.EventDay) *domain.TicketProductDay {
	t.Helper()
	days, err := f.products.ResolveProductDays(context.Background(), p.ID, []string{ed.ID})
	if err != nil || len(days) != 1 {
		t.Fatalf("resolve %s on %s: %d days, err=%v", p.Name, ed.Title, len(days), err)
	}
	return &days[0]
}

var ticketSeq int
var ticketSeqMu sync.Mutex

func nextCode() string {
	ticketSeqMu.Lock()
	defer ticketSeqMu.Unlock()
	ticketSeq++
	return fmt.Sprintf("ZZFX-%d-%d", time.Now().UnixNano()%1000000, ticketSeq)
}

func (f *ticketFixture) newTicket(p *domain.TicketProduct, qty int, status domain.TicketStatus, pds ...*domain.TicketProductDay) *domain.Ticket {
	productID := p.ID
	tk := &domain.Ticket{
		ProductID: &productID, ProductName: p.Name, PurchaseType: domain.PurchaseTypeGamePass,
		Email: nextCode() + "@ticketfixture.test", Name: "Fixture", Phone: "0800",
		Quantity: qty, UnitPrice: 1000, Subtotal: 1000 * qty, TotalAmount: 1000 * qty,
		Status: status, TicketCode: nextCode(),
	}
	for _, pd := range pds {
		tk.Days = append(tk.Days, domain.TicketDay{EventDayID: pd.EventDayID, ProductDayID: pd.ID, UnitPrice: 1000})
	}
	return tk
}

func TestTicketProducts_CapacityIsPerProductPerDay(t *testing.T) {
	f := newTicketFixture(t)
	ctx := context.Background()
	d1 := f.eventDay(t, "cap-1", "2090-03-01")
	comp := f.competition(t, "cap", "2090-03-01")
	vip := f.product(t, "VIP", 1000, 2, comp)
	reg := f.product(t, "REG", 500, 0, comp) // unlimited
	vipDay := f.productDay(t, vip, d1)
	regDay := f.productDay(t, reg, d1)

	if err := f.tickets.Create(ctx, f.newTicket(vip, 2, domain.TicketStatusPaid, vipDay)); err != nil {
		t.Fatalf("filling VIP should work: %v", err)
	}
	err := f.tickets.Create(ctx, f.newTicket(vip, 1, domain.TicketStatusPaid, vipDay))
	if err == nil || !strings.Contains(err.Error(), "only 0 remaining") {
		t.Fatalf("VIP should be sold out, got %v", err)
	}
	// A full VIP does not stop the other ticket on the same day.
	if err := f.tickets.Create(ctx, f.newTicket(reg, 5, domain.TicketStatusPaid, regDay)); err != nil {
		t.Fatalf("an unlimited ticket should still sell: %v", err)
	}
}

func TestTicketProducts_SeatLimitIsPerMatchDay(t *testing.T) {
	// One seat limit on the ticket applies to every day separately: filling one
	// day leaves the next one untouched.
	f := newTicketFixture(t)
	ctx := context.Background()
	d1 := f.eventDay(t, "perday-1", "2090-03-05")
	d2 := f.eventDay(t, "perday-2", "2090-03-06")
	comp := f.competition(t, "perday", "2090-03-05", "2090-03-06")
	vip := f.product(t, "VIPPERDAY", 1000, 1, comp)

	if err := f.tickets.Create(ctx, f.newTicket(vip, 1, domain.TicketStatusPaid, f.productDay(t, vip, d1))); err != nil {
		t.Fatal(err)
	}
	if err := f.tickets.Create(ctx, f.newTicket(vip, 1, domain.TicketStatusPaid, f.productDay(t, vip, d1))); err == nil {
		t.Fatal("day 1 should be full")
	}
	if err := f.tickets.Create(ctx, f.newTicket(vip, 1, domain.TicketStatusPaid, f.productDay(t, vip, d2))); err != nil {
		t.Fatalf("day 2 has its own seat: %v", err)
	}
}

func TestTicketProducts_PendingHoldsSeatsButAbandonedOnesRelease(t *testing.T) {
	f := newTicketFixture(t)
	ctx := context.Background()
	d1 := f.eventDay(t, "hold-1", "2090-03-02")
	comp := f.competition(t, "hold", "2090-03-02")
	vip := f.product(t, "VIPHOLD", 1000, 1, comp)
	pd := f.productDay(t, vip, d1)

	pending := f.newTicket(vip, 1, domain.TicketStatusPending, pd)
	if err := f.tickets.Create(ctx, pending); err != nil {
		t.Fatal(err)
	}
	if err := f.tickets.Create(ctx, f.newTicket(vip, 1, domain.TicketStatusPaid, pd)); err == nil {
		t.Fatal("a fresh PENDING ticket should hold the last seat")
	}
	// Age it past the reservation window: the seat comes back.
	mustExec(t, f.pool, `UPDATE tickets SET created_at = NOW() - INTERVAL '2 hours' WHERE id = $1`, pending.ID)
	if err := f.tickets.Create(ctx, f.newTicket(vip, 1, domain.TicketStatusPaid, pd)); err != nil {
		t.Fatalf("an abandoned PENDING ticket should release its seat: %v", err)
	}
}

func TestTicketProducts_GamePassIsAllOrNothing(t *testing.T) {
	f := newTicketFixture(t)
	ctx := context.Background()
	d1 := f.eventDay(t, "pass-1", "2090-03-03")
	d2 := f.eventDay(t, "pass-2", "2090-03-04")
	comp := f.competition(t, "pass", "2090-03-03", "2090-03-04")
	vip := f.product(t, "VIPPASS", 1000, 1, comp)
	pd1 := f.productDay(t, vip, d1)
	pd2 := f.productDay(t, vip, d2)

	if err := f.tickets.Create(ctx, f.newTicket(vip, 1, domain.TicketStatusPaid, pd2)); err != nil {
		t.Fatal(err)
	}
	// Day 2 is full, so a pass over both must fail and must not leave a ticket or
	// a day-1 seat behind.
	pass := f.newTicket(vip, 1, domain.TicketStatusPaid, pd1, pd2)
	err := f.tickets.Create(ctx, pass)
	if err == nil || !strings.Contains(err.Error(), "ZZFIX pass-2") {
		t.Fatalf("expected a sold-out error naming the full day, got %v", err)
	}
	var n int
	if err := f.pool.QueryRow(ctx, `SELECT COUNT(*) FROM ticket_days WHERE product_day_id = $1`, pd1.ID).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("a failed pass left %d day-1 row(s) behind", n)
	}
}

func TestTicketProducts_ConcurrentOverlappingPassesNeitherOversellNorDeadlock(t *testing.T) {
	f := newTicketFixture(t)
	ctx := context.Background()
	d1 := f.eventDay(t, "race-1", "2090-04-01")
	d2 := f.eventDay(t, "race-2", "2090-04-02")
	comp := f.competition(t, "race", "2090-04-01", "2090-04-02")
	vip := f.product(t, "VIPRACE", 1000, 5, comp)
	pd1 := f.productDay(t, vip, d1)
	pd2 := f.productDay(t, vip, d2)

	var wg sync.WaitGroup
	var mu sync.Mutex
	ok, failed := 0, 0
	var unexpected []error
	for i := 0; i < 14; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			// Alternate the order the days are listed in, to provoke a deadlock if
			// the locking order were not fixed.
			days := []*domain.TicketProductDay{pd1, pd2}
			if i%2 == 1 {
				days = []*domain.TicketProductDay{pd2, pd1}
			}
			err := f.tickets.Create(ctx, f.newTicket(vip, 1, domain.TicketStatusPaid, days...))
			mu.Lock()
			defer mu.Unlock()
			switch {
			case err == nil:
				ok++
			case strings.Contains(err.Error(), "remaining"):
				failed++
			default:
				unexpected = append(unexpected, err)
			}
		}(i)
	}
	wg.Wait()

	if len(unexpected) > 0 {
		t.Fatalf("unexpected errors (a deadlock would show here): %v", unexpected[0])
	}
	if ok != 5 || failed != 9 {
		t.Fatalf("expected exactly 5 passes to sell, got ok=%d failed=%d", ok, failed)
	}
}

func TestTicketProducts_CheckinIsPerDay(t *testing.T) {
	f := newTicketFixture(t)
	ctx := context.Background()
	d1 := f.eventDay(t, "ci-1", "2090-05-01")
	d2 := f.eventDay(t, "ci-2", "2090-05-02")
	other := f.eventDay(t, "ci-3", "2090-05-03")
	comp := f.competition(t, "ci", "2090-05-01", "2090-05-02")
	vip := f.product(t, "VIPCI", 1000, 0, comp)
	pd1 := f.productDay(t, vip, d1)
	pd2 := f.productDay(t, vip, d2)

	tk := f.newTicket(vip, 1, domain.TicketStatusPaid, pd1, pd2)
	if err := f.tickets.Create(ctx, tk); err != nil {
		t.Fatal(err)
	}

	if err := f.tickets.CheckinDay(ctx, tk.ID, other.ID, "gate"); err == nil || !strings.Contains(err.Error(), "not valid for that day") {
		t.Fatalf("a day not on the ticket should be refused, got %v", err)
	}
	if err := f.tickets.CheckinDay(ctx, tk.ID, d1.ID, "gate"); err != nil {
		t.Fatalf("day 1 check-in: %v", err)
	}
	got, _ := f.tickets.GetByID(ctx, tk.ID)
	if got.Status != domain.TicketStatusPaid {
		t.Fatalf("a pass with a day left should stay PAID, got %s", got.Status)
	}
	if err := f.tickets.CheckinDay(ctx, tk.ID, d1.ID, "gate"); err == nil || !strings.Contains(err.Error(), "already checked in") {
		t.Fatalf("the same day twice should be refused, got %v", err)
	}
	if err := f.tickets.CheckinDay(ctx, tk.ID, d2.ID, "gate"); err != nil {
		t.Fatalf("day 2 check-in: %v", err)
	}
	got, _ = f.tickets.GetByID(ctx, tk.ID)
	if got.Status != domain.TicketStatusUsed {
		t.Fatalf("a fully attended pass should be USED, got %s", got.Status)
	}
	if len(got.Days) != 2 || got.Days[0].CheckedInAt == nil || got.Days[1].CheckedInAt == nil {
		t.Fatalf("both days should show attended: %+v", got.Days)
	}
	if got.Days[0].Date.After(got.Days[1].Date) {
		t.Fatal("days should come back in date order")
	}

	// An unpaid ticket cannot be checked in.
	pending := f.newTicket(vip, 1, domain.TicketStatusPending, pd1)
	if err := f.tickets.Create(ctx, pending); err != nil {
		t.Fatal(err)
	}
	if err := f.tickets.CheckinDay(ctx, pending.ID, d1.ID, "gate"); err == nil {
		t.Fatal("a PENDING ticket must not be admitted")
	}
}

func TestTicketProducts_ExpiryWaitsForTheLastDay(t *testing.T) {
	f := newTicketFixture(t)
	ctx := context.Background()
	past := f.eventDay(t, "exp-past", "1990-01-01")
	future := f.eventDay(t, "exp-future", "2090-06-01")
	comp := f.competition(t, "exp", "1990-01-01", "2090-06-01")
	vip := f.product(t, "VIPEXP", 1000, 0, comp)
	pdPast := f.productDay(t, vip, past)
	pdFuture := f.productDay(t, vip, future)

	// Direct inserts: Create would not stop us, but the service never sells past days.
	allPast := f.newTicket(vip, 1, domain.TicketStatusPaid, pdPast)
	passStillLive := f.newTicket(vip, 1, domain.TicketStatusPaid, pdPast, pdFuture)
	unpaidPast := f.newTicket(vip, 1, domain.TicketStatusPending, pdPast)
	for _, tk := range []*domain.Ticket{allPast, passStillLive, unpaidPast} {
		if err := f.tickets.Create(ctx, tk); err != nil {
			t.Fatal(err)
		}
	}

	if _, err := f.tickets.ExpirePastTickets(ctx); err != nil {
		t.Fatal(err)
	}
	status := func(id string) domain.TicketStatus {
		tk, err := f.tickets.GetByID(ctx, id)
		if err != nil {
			t.Fatal(err)
		}
		return tk.Status
	}
	if s := status(allPast.ID); s != domain.TicketStatusExpired {
		t.Errorf("a paid ticket whose only day has passed should be EXPIRED, got %s", s)
	}
	if s := status(passStillLive.ID); s != domain.TicketStatusPaid {
		t.Errorf("a pass with a day to come must stay PAID, got %s", s)
	}
	if s := status(unpaidPast.ID); s != domain.TicketStatusCancelled {
		t.Errorf("an unpaid ticket for a past day should be CANCELLED, got %s", s)
	}
}

func TestTicketProducts_SeatLimitCannotDropBelowCommitted(t *testing.T) {
	f := newTicketFixture(t)
	ctx := context.Background()
	d1 := f.eventDay(t, "shrink-1", "2090-07-01")
	comp := f.competition(t, "shrink", "2090-07-01")
	vip := f.product(t, "VIPSHRINK", 1000, 10, comp)
	pd := f.productDay(t, vip, d1)
	if err := f.tickets.Create(ctx, f.newTicket(vip, 4, domain.TicketStatusPaid, pd)); err != nil {
		t.Fatal(err)
	}

	vip.Capacity = 3
	if err := f.products.UpdateProduct(ctx, vip); err == nil || !strings.Contains(err.Error(), "cannot be less than") {
		t.Fatalf("shrinking below sold seats should be refused, got %v", err)
	}
	vip.Capacity = 4
	if err := f.products.UpdateProduct(ctx, vip); err != nil {
		t.Fatalf("shrinking to exactly the sold count is fine: %v", err)
	}
	vip.Capacity = 0 // unlimited is always allowed
	if err := f.products.UpdateProduct(ctx, vip); err != nil {
		t.Fatalf("making it unlimited is fine: %v", err)
	}
}

func TestTicketProducts_ListsEveryDayOfLinkedCompetitionsEarliestFirst(t *testing.T) {
	f := newTicketFixture(t)
	ctx := context.Background()
	// Created out of order on purpose: the order they are played is what counts.
	f.eventDay(t, "late", "2090-08-20")
	d1 := f.eventDay(t, "early", "2090-08-01")
	f.eventDay(t, "mid", "2090-08-10")
	league := f.competition(t, "league", "2090-08-20", "2090-08-01")
	cup := f.competition(t, "cup", "2090-08-10", "2090-08-01") // shares 1 Aug with the league
	unrelated := f.competition(t, "unrelated", "2090-08-30")
	_ = unrelated
	vip := f.product(t, "VIPLIST", 5000, 10, league, cup)

	pd := f.productDay(t, vip, d1)
	if err := f.tickets.Create(ctx, f.newTicket(vip, 3, domain.TicketStatusPaid, pd)); err != nil {
		t.Fatal(err)
	}
	if err := f.tickets.Create(ctx, f.newTicket(vip, 2, domain.TicketStatusPending, pd)); err != nil {
		t.Fatal(err)
	}

	products, err := f.products.ListProducts(ctx, false)
	if err != nil {
		t.Fatal(err)
	}
	var found *domain.TicketProduct
	for i := range products {
		if products[i].ID == vip.ID {
			found = &products[i]
		}
	}
	if found == nil {
		t.Fatal("ticket not listed")
	}
	if len(found.Competitions) != 2 {
		t.Fatalf("expected both linked competitions, got %+v", found.Competitions)
	}
	if len(found.Days) != 3 {
		t.Fatalf("expected 3 match days (1 Aug shared, 10 Aug, 20 Aug), got %d", len(found.Days))
	}
	var order []string
	for _, d := range found.Days {
		order = append(order, d.EventDay.Date.Format("2006-01-02"))
	}
	if strings.Join(order, ",") != "2090-08-01,2090-08-10,2090-08-20" {
		t.Fatalf("days should run by the date played, got %v", order)
	}
	first := found.Days[0]
	if first.Price != 5000 || first.SoldCount != 3 || first.HeldCount != 2 || first.Available() != 5 {
		t.Errorf("1 Aug: price=%d sold=%d held=%d available=%d", first.Price, first.SoldCount, first.HeldCount, first.Available())
	}
	if first.CompetitionName != "ZZFIX cup" {
		t.Errorf("a shared day should be labelled with the first competition by name, got %q", first.CompetitionName)
	}
	if found.Days[2].Available() != 10 {
		t.Errorf("an untouched day should show every seat, got %d", found.Days[2].Available())
	}
}

func TestTicketProducts_OnlyLinkedCompetitionsPutDaysOnSale(t *testing.T) {
	f := newTicketFixture(t)
	ctx := context.Background()
	d1 := f.eventDay(t, "link-1", "2090-08-05")
	d2 := f.eventDay(t, "link-2", "2090-08-06")
	linked := f.competition(t, "linked", "2090-08-05")
	f.competition(t, "notlinked", "2090-08-06")
	vip := f.product(t, "VIPLINK", 1000, 0, linked)

	days, err := f.products.ResolveProductDays(ctx, vip.ID, []string{d1.ID, d2.ID})
	if err != nil {
		t.Fatal(err)
	}
	if len(days) != 1 || days[0].EventDayID != d1.ID {
		t.Fatalf("only the linked competition's day should resolve, got %+v", days)
	}
	// Resolving again returns the same seat-lock row, not a new one.
	again, _ := f.products.ResolveProductDays(ctx, vip.ID, []string{d1.ID})
	if len(again) != 1 || again[0].ID == "" || again[0].ID != days[0].ID {
		t.Fatalf("the seat-lock row should be stable, got %q then %q", days[0].ID, again[0].ID)
	}

	// Linking the second competition puts its day on sale.
	other := f.competition(t, "second", "2090-08-06")
	if err := f.products.SetProductCompetitions(ctx, vip.ID, []string{linked, other}); err != nil {
		t.Fatal(err)
	}
	days, _ = f.products.ResolveProductDays(ctx, vip.ID, []string{d1.ID, d2.ID})
	if len(days) != 2 {
		t.Fatalf("both days should be on sale after linking, got %d", len(days))
	}
	// Unlinking everything takes everything off sale.
	if err := f.products.SetProductCompetitions(ctx, vip.ID, nil); err != nil {
		t.Fatal(err)
	}
	days, _ = f.products.ResolveProductDays(ctx, vip.ID, []string{d1.ID, d2.ID})
	if len(days) != 0 {
		t.Fatalf("an unlinked ticket should have no days on sale, got %d", len(days))
	}
}

func TestTicketProducts_EnsureEventDaysCreatesMissingMatchDays(t *testing.T) {
	f := newTicketFixture(t)
	ctx := context.Background()
	existing := f.eventDay(t, "have", "2090-09-01")
	comp := f.competition(t, "ensure", "2090-09-01", "2090-09-08")
	vip := f.product(t, "VIPENSURE", 1000, 0, comp)

	if err := f.products.EnsureEventDays(ctx); err != nil {
		t.Fatal(err)
	}
	if err := f.products.EnsureEventDays(ctx); err != nil { // idempotent
		t.Fatal(err)
	}

	var n int
	var title string
	if err := f.pool.QueryRow(ctx, `SELECT COUNT(*) FROM event_days WHERE date = '2090-09-01'`).Scan(&n); err != nil || n != 1 {
		t.Fatalf("an existing match day must not be duplicated, got %d err=%v", n, err)
	}
	if err := f.pool.QueryRow(ctx, `SELECT title FROM event_days WHERE id = $1`, existing.ID).Scan(&title); err != nil || title != existing.Title {
		t.Fatalf("an existing match day must be left alone, title=%q err=%v", title, err)
	}
	if err := f.pool.QueryRow(ctx, `SELECT COUNT(*) FROM event_days WHERE date = '2090-09-08'`).Scan(&n); err != nil || n != 1 {
		t.Fatalf("the missing match day should be created once, got %d err=%v", n, err)
	}

	products, _ := f.products.ListProducts(ctx, false)
	for _, p := range products {
		if p.ID == vip.ID && len(p.Days) != 2 {
			t.Fatalf("both match days should now be on sale, got %d", len(p.Days))
		}
	}
}

func TestTicketProducts_DeleteGuards(t *testing.T) {
	f := newTicketFixture(t)
	ctx := context.Background()
	d1 := f.eventDay(t, "del-1", "2090-09-15")
	comp := f.competition(t, "del", "2090-09-15")
	vip := f.product(t, "VIPDEL", 1000, 0, comp)
	pd := f.productDay(t, vip, d1)
	if err := f.tickets.Create(ctx, f.newTicket(vip, 1, domain.TicketStatusPaid, pd)); err != nil {
		t.Fatal(err)
	}

	if err := f.products.DeleteProduct(ctx, vip.ID); err == nil {
		t.Error("a ticket with paid purchases must not be deletable")
	}
	if err := f.days.Delete(ctx, d1.ID); err == nil {
		t.Error("a match day with paid tickets must not be deletable")
	}

	empty := f.eventDay(t, "del-2", "2090-09-16")
	f.competition(t, "del2", "2090-09-16")
	free := f.product(t, "VIPDEL2", 1000, 0)
	if err := f.days.Delete(ctx, empty.ID); err != nil {
		t.Errorf("an unsold match day should delete: %v", err)
	}
	if err := f.products.DeleteProduct(ctx, free.ID); err != nil {
		t.Errorf("an unsold ticket should delete: %v", err)
	}
}

func TestScheduledEmails_QueueLifecycle(t *testing.T) {
	f := newTicketFixture(t)
	ctx := context.Background()
	d1 := f.eventDay(t, "mail-1", "2090-10-01")
	comp := f.competition(t, "mail", "2090-10-01")
	vip := f.product(t, "VIPMAIL", 1000, 0, comp)
	pd := f.productDay(t, vip, d1)
	tk := f.newTicket(vip, 1, domain.TicketStatusPaid, pd)
	if err := f.tickets.Create(ctx, tk); err != nil {
		t.Fatal(err)
	}
	dayID := tk.Days[0].ID

	mail := func(key string, sendAt time.Time) *domain.ScheduledEmail {
		return &domain.ScheduledEmail{
			Kind: domain.ScheduledEmailDayReminder, TicketID: tk.ID, TicketDayID: &dayID,
			ToEmail: tk.Email, SendAt: sendAt, DedupeKey: key,
		}
	}

	due := mail("ZZFIX:due", time.Now().Add(-time.Minute))
	future := mail("ZZFIX:future", time.Now().Add(24*time.Hour))
	for _, e := range []*domain.ScheduledEmail{due, future} {
		if err := f.emails.Schedule(ctx, e); err != nil {
			t.Fatal(err)
		}
	}
	// Scheduling the same key again is a no-op, not an error or a duplicate.
	if err := f.emails.Schedule(ctx, mail("ZZFIX:due", time.Now())); err != nil {
		t.Fatalf("re-scheduling should be a no-op: %v", err)
	}
	var n int
	_ = f.pool.QueryRow(ctx, `SELECT COUNT(*) FROM scheduled_emails WHERE ticket_id = $1`, tk.ID).Scan(&n)
	if n != 2 {
		t.Fatalf("expected 2 rows after a repeated schedule, got %d", n)
	}

	claimed, err := f.emails.ClaimDue(ctx, 10)
	if err != nil {
		t.Fatal(err)
	}
	mine := 0
	var claimedID string
	for _, c := range claimed {
		if c.TicketID == tk.ID {
			mine++
			claimedID = c.ID
			if c.Status != domain.ScheduledEmailSending || c.Attempts != 1 {
				t.Errorf("claimed row should be SENDING with 1 attempt, got %s/%d", c.Status, c.Attempts)
			}
		}
	}
	if mine != 1 {
		t.Fatalf("only the due row should be claimed, got %d", mine)
	}
	// A second worker finds nothing left to claim for this ticket.
	again, _ := f.emails.ClaimDue(ctx, 10)
	for _, c := range again {
		if c.TicketID == tk.ID {
			t.Fatal("an already-claimed row must not be claimed twice")
		}
	}

	// Failure with a retry time returns it to the queue; with none, it stays failed.
	retry := time.Now().Add(-time.Second)
	if err := f.emails.MarkFailed(ctx, claimedID, "smtp down", &retry); err != nil {
		t.Fatal(err)
	}
	again, _ = f.emails.ClaimDue(ctx, 10)
	reclaimed := false
	for _, c := range again {
		if c.ID == claimedID {
			reclaimed = true
			if c.Attempts != 2 {
				t.Errorf("a retried row should be on attempt 2, got %d", c.Attempts)
			}
		}
	}
	if !reclaimed {
		t.Fatal("a failed row with a retry time should be claimable again")
	}
	if err := f.emails.MarkSent(ctx, claimedID); err != nil {
		t.Fatal(err)
	}

	// A worker that died mid-send leaves SENDING rows; they are recovered.
	mustExec(t, f.pool, `UPDATE scheduled_emails SET status='SENDING', updated_at = NOW() - INTERVAL '1 hour' WHERE id = $1`, claimedID)
	if rec, err := f.emails.RecoverStuck(ctx, 15*time.Minute); err != nil || rec < 1 {
		t.Fatalf("expected the stuck row to be recovered, got %d err=%v", rec, err)
	}

	// Cancelling a ticket cancels what has not gone out.
	if err := f.emails.CancelForTicket(ctx, tk.ID); err != nil {
		t.Fatal(err)
	}
	var pending int
	_ = f.pool.QueryRow(ctx, `SELECT COUNT(*) FROM scheduled_emails WHERE ticket_id = $1 AND status IN ('PENDING','SENDING')`, tk.ID).Scan(&pending)
	if pending != 0 {
		t.Fatalf("expected nothing left pending after cancelling, got %d", pending)
	}
}

func TestScheduledEmails_MovingAMatchDayMovesItsReminders(t *testing.T) {
	f := newTicketFixture(t)
	ctx := context.Background()
	d1 := f.eventDay(t, "move-1", "2090-11-10")
	comp := f.competition(t, "move", "2090-11-10")
	vip := f.product(t, "VIPMOVE", 1000, 0, comp)
	pd := f.productDay(t, vip, d1)
	tk := f.newTicket(vip, 1, domain.TicketStatusPaid, pd)
	if err := f.tickets.Create(ctx, tk); err != nil {
		t.Fatal(err)
	}
	dayID := tk.Days[0].ID
	if err := f.emails.Schedule(ctx, &domain.ScheduledEmail{
		Kind: domain.ScheduledEmailDayReminder, TicketID: tk.ID, TicketDayID: &dayID,
		ToEmail: tk.Email, SendAt: time.Now().Add(time.Hour), DedupeKey: "ZZFIX:move",
	}); err != nil {
		t.Fatal(err)
	}

	newDate := time.Date(2090, 11, 20, 0, 0, 0, 0, time.UTC)
	if err := f.days.Update(ctx, d1.ID, nil, &newDate, nil, nil); err != nil {
		t.Fatal(err)
	}
	if err := f.emails.RescheduleForEventDay(ctx, d1.ID, 1, 9); err != nil {
		t.Fatal(err)
	}

	var sendAt time.Time
	if err := f.pool.QueryRow(ctx, `SELECT send_at FROM scheduled_emails WHERE dedupe_key = 'ZZFIX:move'`).Scan(&sendAt); err != nil {
		t.Fatal(err)
	}
	want := time.Date(2090, 11, 19, 9, 0, 0, 0, time.FixedZone("WAT", 3600))
	if !sendAt.Equal(want) {
		t.Fatalf("reminder should be 09:00 Lagos on 19 Nov, got %v", sendAt)
	}
}

// ─── Season passes ────────────────────────────────────────────────────────────

func (f *ticketFixture) seasonService() *services.TicketService {
	return services.NewTicketService(
		f.days, f.products, f.tickets, f.emails, ports.NewSeasonPassRepository(f.pool),
		nil, nil, nil, nil, nil,
	)
}

func (f *ticketFixture) seasonPass(t *testing.T, name string, price int, endsOn string) *domain.SeasonPass {
	t.Helper()
	d, err := time.Parse("2006-01-02", endsOn)
	if err != nil {
		t.Fatal(err)
	}
	pass := &domain.SeasonPass{Name: "ZZFIX " + name, Price: price, EndsOn: d, IsActive: true}
	if err := ports.NewSeasonPassRepository(f.pool).Create(context.Background(), pass); err != nil {
		t.Fatalf("create season pass: %v", err)
	}
	t.Cleanup(func() {
		mustExec(t, f.pool, `DELETE FROM tickets WHERE season_pass_id = $1`, pass.ID)
		mustExec(t, f.pool, `DELETE FROM season_passes WHERE id = $1`, pass.ID)
	})
	return pass
}

func TestSeasonPass_RepositoryRoundTripsPriceAndEndDate(t *testing.T) {
	f := newTicketFixture(t)
	ctx := context.Background()
	repo := ports.NewSeasonPassRepository(f.pool)
	pass := f.seasonPass(t, "RT", 75000, "2092-05-31")

	got, err := repo.GetByID(ctx, pass.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Price != 75000 || got.EndsOn.Format("2006-01-02") != "2092-05-31" || !got.IsActive {
		t.Fatalf("unexpected pass: %+v", got)
	}

	got.Price, got.IsActive = 60000, false
	got.EndsOn = time.Date(2092, 6, 30, 0, 0, 0, 0, time.UTC)
	if err := repo.Update(ctx, got); err != nil {
		t.Fatal(err)
	}
	again, _ := repo.GetByID(ctx, pass.ID)
	if again.Price != 60000 || again.IsActive || again.EndsOn.Format("2006-01-02") != "2092-06-30" {
		t.Fatalf("update not saved: %+v", again)
	}

	active, _ := repo.List(ctx, true)
	for _, p := range active {
		if p.ID == pass.ID {
			t.Error("a switched-off pass must not be in the active list")
		}
	}
}

func TestSeasonPass_PurchaseIsOneTicketWithNoMatchDays(t *testing.T) {
	f := newTicketFixture(t)
	ctx := context.Background()
	pass := f.seasonPass(t, "BUY", 0, "2092-05-31") // free, so no payment provider is needed

	res, err := f.seasonService().PurchaseSeasonPass(ctx, dto.PurchaseSeasonPassRequest{
		SeasonPassID: pass.ID, Email: "season@ticketfixture.test", Name: "Season Buyer", Phone: "0800", Quantity: 2,
	}, "http://localhost/tickets/confirm", nil)
	if err != nil {
		t.Fatal(err)
	}

	if res.Status != "PAID" || res.PurchaseType != "SEASON_PASS" || res.SeasonPassID != pass.ID {
		t.Fatalf("unexpected ticket: status=%s type=%s pass=%s", res.Status, res.PurchaseType, res.SeasonPassID)
	}
	if res.ProductID != "" {
		t.Errorf("a season pass is not made from a ticket, got product %q", res.ProductID)
	}
	if res.ProductName != pass.Name || res.Quantity != 2 {
		t.Errorf("the receipt should carry the pass name and quantity, got %q x%d", res.ProductName, res.Quantity)
	}
	if res.ValidUntil != "2092-05-31" {
		t.Errorf("the ticket should say when the pass ends, got %q", res.ValidUntil)
	}
	if len(res.Days) != 0 {
		t.Errorf("a season pass has no match days, got %d", len(res.Days))
	}
	if res.TicketCode == "" {
		t.Error("a paid pass should come with its code")
	}

	// No seats and no per-day reminders.
	var rows int
	_ = f.pool.QueryRow(ctx, `SELECT COUNT(*) FROM scheduled_emails se JOIN tickets t ON t.id = se.ticket_id WHERE t.email = 'season@ticketfixture.test'`).Scan(&rows)
	if rows != 0 {
		t.Errorf("a season pass sends no match day reminders, got %d", rows)
	}

	// Looking the code up at the gate shows what it is and when it ends.
	byCode, err := f.tickets.GetByCode(ctx, res.TicketCode)
	if err != nil {
		t.Fatal(err)
	}
	if byCode.PurchaseType != domain.PurchaseTypeSeasonPass || byCode.ValidUntil == nil || *byCode.ValidUntil != "2092-05-31" {
		t.Fatalf("the code lookup should identify a season pass valid until its end date, got %+v", byCode)
	}
}

func TestSeasonPass_GateLetsItInEveryDayUntilItEnds(t *testing.T) {
	f := newTicketFixture(t)
	ctx := context.Background()
	live := f.seasonPass(t, "GATE", 0, "2092-05-31")
	ended := f.seasonPass(t, "ENDED", 0, "1990-05-31")

	paid := func(pass *domain.SeasonPass, email string, status domain.TicketStatus) *domain.Ticket {
		id := pass.ID
		tk := &domain.Ticket{
			ProductName: pass.Name, PurchaseType: domain.PurchaseTypeSeasonPass, SeasonPassID: &id,
			Email: email, Name: "Fan", Phone: "0800", Quantity: 1, Status: status, TicketCode: nextCode(),
		}
		if err := f.tickets.Create(ctx, tk); err != nil {
			t.Fatalf("create season ticket: %v", err)
		}
		return tk
	}

	holder := paid(live, "holder@ticketfixture.test", domain.TicketStatusPaid)

	first, err := f.tickets.CheckinSeasonPass(ctx, holder.ID, "gate")
	if err != nil || !first {
		t.Fatalf("the first scan of the day should be let in and recorded, first=%v err=%v", first, err)
	}
	again, err := f.tickets.CheckinSeasonPass(ctx, holder.ID, "gate")
	if err != nil {
		t.Fatalf("a second scan the same day must still be let in, got %v", err)
	}
	if again {
		t.Error("a second scan the same day must not be recorded again")
	}
	var entries int
	_ = f.pool.QueryRow(ctx, `SELECT COUNT(*) FROM season_pass_entries WHERE ticket_id = $1`, holder.ID).Scan(&entries)
	if entries != 1 {
		t.Errorf("one entry per day, got %d", entries)
	}
	// It stays a valid pass: it is never "used up".
	got, _ := f.tickets.GetByID(ctx, holder.ID)
	if got.Status != domain.TicketStatusPaid {
		t.Errorf("a season pass stays PAID, got %s", got.Status)
	}
	// Another day is another entry.
	mustExec(t, f.pool, `UPDATE season_pass_entries SET entry_date = entry_date - 1 WHERE ticket_id = $1`, holder.ID)
	if first, err := f.tickets.CheckinSeasonPass(ctx, holder.ID, "gate"); err != nil || !first {
		t.Errorf("the next day is a new entry, first=%v err=%v", first, err)
	}

	// An ended pass, an unpaid one, and a ticket that is not a season pass.
	if _, err := f.tickets.CheckinSeasonPass(ctx, paid(ended, "ended@ticketfixture.test", domain.TicketStatusPaid).ID, "gate"); err == nil || !strings.Contains(err.Error(), "ended on 1990-05-31") {
		t.Errorf("an ended pass should be refused and say when it ended, got %v", err)
	}
	if _, err := f.tickets.CheckinSeasonPass(ctx, paid(live, "pending@ticketfixture.test", domain.TicketStatusPending).ID, "gate"); err == nil {
		t.Error("an unpaid pass must not be let in")
	}
	d1 := f.eventDay(t, "sg-1", "2092-06-01")
	comp := f.competition(t, "sg", "2092-06-01")
	vip := f.product(t, "SPGATE", 0, 0, comp)
	gp := f.newTicket(vip, 1, domain.TicketStatusPaid, f.productDay(t, vip, d1))
	if err := f.tickets.Create(ctx, gp); err != nil {
		t.Fatal(err)
	}
	if _, err := f.tickets.CheckinSeasonPass(ctx, gp.ID, "gate"); err == nil || !strings.Contains(err.Error(), "not a season pass") {
		t.Errorf("a Game Pass is not a season pass, got %v", err)
	}
}

func TestSeasonPass_EndsOnItsEndDate(t *testing.T) {
	f := newTicketFixture(t)
	ctx := context.Background()
	ended := f.seasonPass(t, "EXPIRE-OLD", 0, "1990-05-31")
	live := f.seasonPass(t, "EXPIRE-LIVE", 0, "2092-05-31")

	mk := func(pass *domain.SeasonPass, email string) *domain.Ticket {
		id := pass.ID
		tk := &domain.Ticket{
			ProductName: pass.Name, PurchaseType: domain.PurchaseTypeSeasonPass, SeasonPassID: &id,
			Email: email, Name: "Fan", Phone: "0800", Quantity: 1, Status: domain.TicketStatusPaid, TicketCode: nextCode(),
		}
		if err := f.tickets.Create(ctx, tk); err != nil {
			t.Fatal(err)
		}
		return tk
	}
	old, current := mk(ended, "old@ticketfixture.test"), mk(live, "current@ticketfixture.test")

	if _, err := f.tickets.ExpirePastTickets(ctx); err != nil {
		t.Fatal(err)
	}
	if got, _ := f.tickets.GetByID(ctx, old.ID); got.Status != domain.TicketStatusExpired {
		t.Errorf("a pass past its end date should be EXPIRED, got %s", got.Status)
	}
	if got, _ := f.tickets.GetByID(ctx, current.ID); got.Status != domain.TicketStatusPaid {
		t.Errorf("a pass still running must stay PAID, got %s", got.Status)
	}
}

func TestSeasonPass_DeleteGuard(t *testing.T) {
	f := newTicketFixture(t)
	ctx := context.Background()
	repo := ports.NewSeasonPassRepository(f.pool)
	pass := f.seasonPass(t, "DEL", 0, "2092-05-31")
	if _, err := f.seasonService().PurchaseSeasonPass(ctx, dto.PurchaseSeasonPassRequest{
		SeasonPassID: pass.ID, Email: "del@ticketfixture.test", Name: "D", Phone: "1", Quantity: 1,
	}, "http://localhost/tickets/confirm", nil); err != nil {
		t.Fatal(err)
	}
	if err := repo.Delete(ctx, pass.ID); err == nil {
		t.Error("a season pass with a paid purchase must not be deletable")
	}
	unsold := f.seasonPass(t, "DEL2", 0, "2092-05-31")
	if err := repo.Delete(ctx, unsold.ID); err != nil {
		t.Errorf("an unsold pass should delete: %v", err)
	}
}

// ─── Remembering a buyer's phone ──────────────────────────────────────────────

func TestSetPhoneIfEmptyOnlyFillsABlank(t *testing.T) {
	pool := ticketPool(t)
	ctx := context.Background()
	mustExec(t, pool, `DELETE FROM users WHERE email LIKE '%@ticketfixture.test'`)
	t.Cleanup(func() { mustExec(t, pool, `DELETE FROM users WHERE email LIKE '%@ticketfixture.test'`) })

	var blankID, setID, nullID string
	if err := pool.QueryRow(ctx, `INSERT INTO users (full_name, email, phone) VALUES ('Blank', 'blank@ticketfixture.test', '') RETURNING id::text`).Scan(&blankID); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO users (full_name, email, phone) VALUES ('Has Phone', 'has@ticketfixture.test', '0800 111 1111') RETURNING id::text`).Scan(&setID); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO users (full_name, email, phone) VALUES ('Null Phone', 'null@ticketfixture.test', NULL) RETURNING id::text`).Scan(&nullID); err != nil {
		t.Fatal(err)
	}

	repo := ports.NewAuthRepository(pool)
	phoneOf := func(id string) string {
		var p *string
		if err := pool.QueryRow(ctx, `SELECT phone FROM users WHERE id = $1`, id).Scan(&p); err != nil {
			t.Fatal(err)
		}
		if p == nil {
			return "<null>"
		}
		return *p
	}

	for _, id := range []string{blankID, nullID} {
		if err := repo.SetPhoneIfEmpty(ctx, id, "0801 234 5678"); err != nil {
			t.Fatal(err)
		}
		if got := phoneOf(id); got != "0801 234 5678" {
			t.Errorf("a blank profile should take the number, got %q", got)
		}
	}
	if err := repo.SetPhoneIfEmpty(ctx, setID, "0999 999 9999"); err != nil {
		t.Fatal(err)
	}
	if got := phoneOf(setID); got != "0800 111 1111" {
		t.Errorf("a number already on the profile must never be replaced, got %q", got)
	}
	// A second checkout with a different number leaves the first one alone.
	if err := repo.SetPhoneIfEmpty(ctx, blankID, "0702 222 2222"); err != nil {
		t.Fatal(err)
	}
	if got := phoneOf(blankID); got != "0801 234 5678" {
		t.Errorf("the first number saved should stay, got %q", got)
	}
	// An unknown user is not an error: this follows a purchase and must not fail it.
	if err := repo.SetPhoneIfEmpty(ctx, "00000000-0000-0000-0000-000000000000", "0801"); err != nil {
		t.Errorf("an unknown user should be quietly ignored, got %v", err)
	}
}

func TestPayingForATicketKeepsTheSignedInBuyersPhone(t *testing.T) {
	f := newTicketFixture(t)
	ctx := context.Background()
	mustExec(t, f.pool, `DELETE FROM users WHERE email LIKE '%@ticketfixture.test'`)
	t.Cleanup(func() { mustExec(t, f.pool, `DELETE FROM users WHERE email LIKE '%@ticketfixture.test'`) })

	var blankID, setID string
	if err := f.pool.QueryRow(ctx, `INSERT INTO users (full_name, email, phone) VALUES ('Blank', 'buyer-blank@ticketfixture.test', '') RETURNING id::text`).Scan(&blankID); err != nil {
		t.Fatal(err)
	}
	if err := f.pool.QueryRow(ctx, `INSERT INTO users (full_name, email, phone) VALUES ('Has', 'buyer-has@ticketfixture.test', '0800 111 1111') RETURNING id::text`).Scan(&setID); err != nil {
		t.Fatal(err)
	}

	d1 := f.eventDay(t, "ph-1", "2092-03-01")
	comp := f.competition(t, "ph", "2092-03-01")
	free := f.product(t, "FREEPH", 0, 0, comp) // free, so no payment provider is needed
	svc := f.seasonService().WithUserPhoneSaver(ports.NewAuthRepository(f.pool))

	buy := func(email string, userID *string, phone string) {
		t.Helper()
		if _, err := svc.Purchase(ctx, dto.PurchaseTicketRequest{
			ProductID: free.ID, EventDayIDs: []string{d1.ID}, Email: email, Name: "Buyer", Phone: phone, Quantity: 1,
		}, "http://localhost/tickets/confirm", userID); err != nil {
			t.Fatalf("purchase for %s: %v", email, err)
		}
	}
	phoneOf := func(id string) string {
		var p string
		if err := f.pool.QueryRow(ctx, `SELECT COALESCE(phone, '') FROM users WHERE id = $1`, id).Scan(&p); err != nil {
			t.Fatal(err)
		}
		return p
	}

	buy("buyer-blank@ticketfixture.test", &blankID, "0803 000 0001")
	if got := phoneOf(blankID); got != "0803 000 0001" {
		t.Errorf("a signed-in buyer's phone should be kept on their profile, got %q", got)
	}
	buy("buyer-has@ticketfixture.test", &setID, "0900 999 9999")
	if got := phoneOf(setID); got != "0800 111 1111" {
		t.Errorf("a phone already on the profile must not be replaced, got %q", got)
	}
	// A guest has no profile to update, and buying still works.
	buy("guest@ticketfixture.test", nil, "0805 555 5555")
	var n int
	_ = f.pool.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE phone = '0805 555 5555'`).Scan(&n)
	if n != 0 {
		t.Errorf("a guest's phone must not appear on any profile, found %d", n)
	}
}

func TestTickets_MarkPaidHappensOnce(t *testing.T) {
	f := newTicketFixture(t)
	ctx := context.Background()
	d := f.eventDay(t, "markpaid", "2090-08-01")
	comp := f.competition(t, "markpaid", "2090-08-01")
	p := f.product(t, "MarkPaid", 1000, 0, comp)
	tk := f.newTicket(p, 1, domain.TicketStatusPending, f.productDay(t, p, d))
	if err := f.tickets.Create(ctx, tk); err != nil {
		t.Fatal(err)
	}

	// The webhook and the buyer's page race to confirm it: only one wins.
	var wg sync.WaitGroup
	var mu sync.Mutex
	won := 0
	for i := 0; i < 6; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			changed, err := f.tickets.MarkPaid(ctx, tk.ID)
			if err != nil {
				t.Error(err)
			}
			if changed {
				mu.Lock()
				won++
				mu.Unlock()
			}
		}()
	}
	wg.Wait()
	if won != 1 {
		t.Errorf("%d callers marked it paid, want 1", won)
	}
	got, _ := f.tickets.GetByID(ctx, tk.ID)
	if got.Status != domain.TicketStatusPaid {
		t.Errorf("status = %s, want PAID", got.Status)
	}

	// A failed payment later paid is accepted; a used ticket is never touched.
	mustExec(t, f.pool, `UPDATE tickets SET status = 'FAILED' WHERE id = $1`, tk.ID)
	if changed, _ := f.tickets.MarkPaid(ctx, tk.ID); !changed {
		t.Error("a FAILED ticket later paid was not marked PAID")
	}
	mustExec(t, f.pool, `UPDATE tickets SET status = 'USED' WHERE id = $1`, tk.ID)
	if changed, _ := f.tickets.MarkPaid(ctx, tk.ID); changed {
		t.Error("a USED ticket was moved back to PAID")
	}
}

func TestTickets_TheGateFindsATicketByItsPaystackReference(t *testing.T) {
	f := newTicketFixture(t)
	ctx := context.Background()
	d := f.eventDay(t, "byref", "2090-08-02")
	comp := f.competition(t, "byref", "2090-08-02")
	p := f.product(t, "ByRef", 1000, 0, comp)
	tk := f.newTicket(p, 1, domain.TicketStatusPaid, f.productDay(t, p, d))
	ref := "sffl-" + strings.ToLower(nextCode())
	tk.PaystackReference = &ref
	if err := f.tickets.Create(ctx, tk); err != nil {
		t.Fatal(err)
	}
	svc := f.seasonService()

	byCode, err := svc.GetByCode(ctx, tk.TicketCode)
	if err != nil || byCode.ID != tk.ID {
		t.Fatalf("by code: %v", err)
	}
	// The buyer reads the reference off their Paystack receipt, often in capitals.
	byRef, err := svc.GetByCode(ctx, strings.ToUpper(ref))
	if err != nil || byRef.ID != tk.ID {
		t.Errorf("by Paystack reference: %v", err)
	}
	if _, err := svc.GetByCode(ctx, "SFFL-NOPE0000"); err == nil {
		t.Error("an unknown code was found")
	}
}
