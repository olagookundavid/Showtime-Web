package tests_integration

// Integration coverage for ticket products, Game Pass days and the scheduled
// email queue.
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
	"showtime-backend/internal/ports"

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
	mustExec(t, pool, `DELETE FROM event_days WHERE title LIKE 'ZZFIX%'`)
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

func (f *ticketFixture) product(t *testing.T, name string, price int) *domain.TicketProduct {
	t.Helper()
	p := &domain.TicketProduct{
		Name: "ZZFIX " + name, Slug: "zzfix-" + strings.ToLower(name) + "-" + fmt.Sprint(time.Now().UnixNano()),
		BasePrice: price, IsActive: true, AllowGamePass: true,
	}
	if err := f.products.CreateProduct(context.Background(), p); err != nil {
		t.Fatalf("create product %s: %v", name, err)
	}
	return p
}

func (f *ticketFixture) productDay(t *testing.T, p *domain.TicketProduct, ed *domain.EventDay, capacity int) *domain.TicketProductDay {
	t.Helper()
	d := &domain.TicketProductDay{ProductID: p.ID, EventDayID: ed.ID, Capacity: capacity, IsActive: true}
	if err := f.products.SaveProductDay(context.Background(), d); err != nil {
		t.Fatalf("save product day: %v", err)
	}
	return d
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
		ProductID: &productID, ProductName: p.Name, PurchaseType: domain.PurchaseTypeSingle,
		Email: nextCode() + "@ticketfixture.test", Name: "Fixture", Phone: "0800",
		Quantity: qty, UnitPrice: 1000, Subtotal: 1000 * qty, TotalAmount: 1000 * qty,
		Status: status, TicketCode: nextCode(),
	}
	if len(pds) > 1 {
		tk.PurchaseType = domain.PurchaseTypeGamePass
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
	vip := f.product(t, "VIP", 1000)
	reg := f.product(t, "REG", 500)
	vipDay := f.productDay(t, vip, d1, 2)
	regDay := f.productDay(t, reg, d1, 0) // unlimited

	if err := f.tickets.Create(ctx, f.newTicket(vip, 2, domain.TicketStatusPaid, vipDay)); err != nil {
		t.Fatalf("filling VIP should work: %v", err)
	}
	err := f.tickets.Create(ctx, f.newTicket(vip, 1, domain.TicketStatusPaid, vipDay))
	if err == nil || !strings.Contains(err.Error(), "only 0 remaining") {
		t.Fatalf("VIP should be sold out, got %v", err)
	}
	// A full VIP does not stop the other product on the same day.
	if err := f.tickets.Create(ctx, f.newTicket(reg, 5, domain.TicketStatusPaid, regDay)); err != nil {
		t.Fatalf("an unlimited product should still sell: %v", err)
	}
}

func TestTicketProducts_PendingHoldsSeatsButAbandonedOnesRelease(t *testing.T) {
	f := newTicketFixture(t)
	ctx := context.Background()
	d1 := f.eventDay(t, "hold-1", "2090-03-02")
	vip := f.product(t, "VIPHOLD", 1000)
	pd := f.productDay(t, vip, d1, 1)

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
	vip := f.product(t, "VIPPASS", 1000)
	pd1 := f.productDay(t, vip, d1, 0)
	pd2 := f.productDay(t, vip, d2, 1)

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
	vip := f.product(t, "VIPRACE", 1000)
	pd1 := f.productDay(t, vip, d1, 5)
	pd2 := f.productDay(t, vip, d2, 5)

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
	vip := f.product(t, "VIPCI", 1000)
	pd1 := f.productDay(t, vip, d1, 0)
	pd2 := f.productDay(t, vip, d2, 0)

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
	vip := f.product(t, "VIPEXP", 1000)
	pdPast := f.productDay(t, vip, past, 0)
	pdFuture := f.productDay(t, vip, future, 0)

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

func TestTicketProducts_CapacityCannotDropBelowCommitted(t *testing.T) {
	f := newTicketFixture(t)
	ctx := context.Background()
	d1 := f.eventDay(t, "shrink-1", "2090-07-01")
	vip := f.product(t, "VIPSHRINK", 1000)
	pd := f.productDay(t, vip, d1, 10)
	if err := f.tickets.Create(ctx, f.newTicket(vip, 4, domain.TicketStatusPaid, pd)); err != nil {
		t.Fatal(err)
	}

	small := &domain.TicketProductDay{ProductID: vip.ID, EventDayID: d1.ID, Capacity: 3, IsActive: true}
	if err := f.products.SaveProductDay(ctx, small); err == nil || !strings.Contains(err.Error(), "cannot be less than") {
		t.Fatalf("shrinking below sold seats should be refused, got %v", err)
	}
	ok := &domain.TicketProductDay{ProductID: vip.ID, EventDayID: d1.ID, Capacity: 4, IsActive: true}
	if err := f.products.SaveProductDay(ctx, ok); err != nil {
		t.Fatalf("shrinking to exactly the sold count is fine: %v", err)
	}
}

func TestTicketProducts_ListShowsEffectivePriceAndSeatCounts(t *testing.T) {
	f := newTicketFixture(t)
	ctx := context.Background()
	d1 := f.eventDay(t, "list-1", "2090-08-01")
	d2 := f.eventDay(t, "list-2", "2090-08-02")
	vip := f.product(t, "VIPLIST", 5000)
	f.productDay(t, vip, d1, 10)
	override := 7500
	pd2 := &domain.TicketProductDay{ProductID: vip.ID, EventDayID: d2.ID, PriceOverride: &override, Capacity: 0, IsActive: true}
	if err := f.products.SaveProductDay(ctx, pd2); err != nil {
		t.Fatal(err)
	}
	pd1 := &domain.TicketProductDay{ProductID: vip.ID, EventDayID: d1.ID, Capacity: 10, IsActive: true}
	_ = f.products.SaveProductDay(ctx, pd1)
	if err := f.tickets.Create(ctx, f.newTicket(vip, 3, domain.TicketStatusPaid, pd1)); err != nil {
		t.Fatal(err)
	}
	if err := f.tickets.Create(ctx, f.newTicket(vip, 2, domain.TicketStatusPending, pd1)); err != nil {
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
	if found == nil || len(found.Days) != 2 {
		t.Fatalf("expected the product with two days, got %+v", found)
	}
	byDay := map[string]domain.TicketProductDay{}
	for _, d := range found.Days {
		byDay[d.EventDayID] = d
	}
	if got := byDay[d1.ID]; got.Price != 5000 || got.SoldCount != 3 || got.HeldCount != 2 || got.Available() != 5 {
		t.Errorf("day 1: price=%d sold=%d held=%d available=%d", got.Price, got.SoldCount, got.HeldCount, got.Available())
	}
	if got := byDay[d2.ID]; got.Price != 7500 || got.Available() != -1 {
		t.Errorf("day 2: price=%d available=%d (want 7500, unlimited)", got.Price, got.Available())
	}
	if found.Days[0].EventDay == nil || found.Days[0].EventDay.Title == "" {
		t.Error("days should carry their event day")
	}
}

func TestTicketProducts_DeleteGuards(t *testing.T) {
	f := newTicketFixture(t)
	ctx := context.Background()
	d1 := f.eventDay(t, "del-1", "2090-09-01")
	vip := f.product(t, "VIPDEL", 1000)
	pd := f.productDay(t, vip, d1, 0)
	if err := f.tickets.Create(ctx, f.newTicket(vip, 1, domain.TicketStatusPaid, pd)); err != nil {
		t.Fatal(err)
	}

	if err := f.products.DeleteProduct(ctx, vip.ID); err == nil {
		t.Error("a product with paid tickets must not be deletable")
	}
	if err := f.products.DeleteProductDay(ctx, vip.ID, d1.ID); err == nil {
		t.Error("a product day with paid tickets must not be removable")
	}
	if err := f.days.Delete(ctx, d1.ID); err == nil {
		t.Error("a match day with paid tickets must not be deletable")
	}

	empty := f.eventDay(t, "del-2", "2090-09-02")
	free := f.product(t, "VIPDEL2", 1000)
	f.productDay(t, free, empty, 0)
	if err := f.days.Delete(ctx, empty.ID); err != nil {
		t.Errorf("an unsold match day should delete, taking its product days with it: %v", err)
	}
	if err := f.products.DeleteProduct(ctx, free.ID); err != nil {
		t.Errorf("an unsold product should delete: %v", err)
	}
}

func TestScheduledEmails_QueueLifecycle(t *testing.T) {
	f := newTicketFixture(t)
	ctx := context.Background()
	d1 := f.eventDay(t, "mail-1", "2090-10-01")
	vip := f.product(t, "VIPMAIL", 1000)
	pd := f.productDay(t, vip, d1, 0)
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
	vip := f.product(t, "VIPMOVE", 1000)
	pd := f.productDay(t, vip, d1, 0)
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
