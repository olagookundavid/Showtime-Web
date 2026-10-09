package tests_integration

// Integration coverage for the Game Pass repositories: the checkout
// reservation, payment settlement and the band constraints are hand-written,
// transactional SQL that only a real, fully-migrated schema can exercise.
//
// Run as described in fantasy_repo_integration_test.go (TEST_DB_DSN); skipped
// when it is unset.

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"showtime-backend/internal/domain"
	appErrors "showtime-backend/internal/errors"
	"showtime-backend/internal/ports"
	"showtime-backend/internal/services"

	"github.com/jackc/pgx/v5/pgxpool"
)

type gamePassFixture struct {
	pool      *pgxpool.Pool
	tag       string
	dayIDs    []string
	tierIDs   []string // ticket tier per day, same order as dayIDs
	seasonID  string
	orderRepo ports.GamePassOrderRepository
}

func setupGamePassFixture(t *testing.T, capacity int) *gamePassFixture {
	t.Helper()
	dsn := os.Getenv("TEST_DB_DSN")
	if dsn == "" {
		t.Skip("Skipping game pass integration tests: TEST_DB_DSN not set")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatalf("failed to connect to the test database: %v", err)
	}

	seed := time.Now().UnixNano() % 1000000
	f := &gamePassFixture{pool: pool, tag: fmt.Sprintf("GPTest%d", seed), orderRepo: ports.NewGamePassOrderRepository(pool)}

	// event_days.date is UNIQUE: spread this run's days out by the seed.
	base := 5000 + int(seed%20000)*3
	for i := 0; i < 2; i++ {
		dayID := mustScan(t, pool,
			`INSERT INTO event_days (title, date) VALUES ($1, CURRENT_DATE + $2::int) RETURNING id`,
			fmt.Sprintf("%s Day %d", f.tag, i+1), base+i)
		tierID := mustScan(t, pool,
			`INSERT INTO ticket_tiers (event_day_id, name, price, capacity) VALUES ($1, 'Regular', 2500, $2) RETURNING id`,
			dayID, capacity)
		f.dayIDs = append(f.dayIDs, dayID)
		f.tierIDs = append(f.tierIDs, tierID)
	}
	f.seasonID = mustScan(t, pool,
		`INSERT INTO season_admission_tiers (name, price) VALUES ($1, 2000) RETURNING id`, f.tag+" Regular")

	t.Cleanup(func() {
		// Tickets reference both the order and the tiers; clear them first.
		mustExec(t, pool, `DELETE FROM tickets WHERE event_day_id = ANY($1::uuid[])`, f.dayIDs)
		mustExec(t, pool, `DELETE FROM game_pass_orders WHERE name LIKE $1`, f.tag+"%")
		mustExec(t, pool, `DELETE FROM game_pass_leads WHERE name LIKE $1`, f.tag+"%")
		mustExec(t, pool, `DELETE FROM ticket_tiers WHERE event_day_id = ANY($1::uuid[])`, f.dayIDs)
		mustExec(t, pool, `DELETE FROM event_days WHERE id = ANY($1::uuid[])`, f.dayIDs)
		mustExec(t, pool, `DELETE FROM season_admission_tiers WHERE id = $1`, f.seasonID)
		pool.Close()
	})
	return f
}

func (f *gamePassFixture) newOrder(holders int) (*domain.GamePassOrder, []domain.GamePassOrderLine) {
	ref := domain.GamePassReferencePrefix + strings.ToUpper(fmt.Sprintf("%d", time.Now().UnixNano()))
	price := domain.PriceGamePass(2000, len(f.dayIDs), holders, []domain.GamePassDiscountBand{
		{MinGamedays: 2, MaxGamedays: nil, DiscountPercent: 5, IsActive: true},
	})
	seasonID := f.seasonID
	o := &domain.GamePassOrder{
		Name: f.tag + " Buyer", Email: "buyer@example.invalid", Phone: "080",
		SeasonTierID: &seasonID, TierName: "Regular", Price: price, PaystackReference: &ref,
	}
	lines := make([]domain.GamePassOrderLine, len(f.dayIDs))
	for i := range f.dayIDs {
		lines[i] = domain.GamePassOrderLine{EventDayID: f.dayIDs[i], TicketTierID: f.tierIDs[i]}
	}
	return o, lines
}

func codes(n int) []string {
	out := make([]string, n)
	for i := range out {
		out[i] = services.GenerateTicketCode()
	}
	return out
}

func soldCount(t *testing.T, pool *pgxpool.Pool, tierID string) int {
	t.Helper()
	var n int
	if err := pool.QueryRow(context.Background(), `SELECT sold_count FROM ticket_tiers WHERE id = $1`, tierID).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func TestGamePassOrderLifecycle(t *testing.T) {
	f := setupGamePassFixture(t, 3)
	ctx := context.Background()

	// 2 holders x 2 gamedays: 4 pending tickets, each one seat.
	order, lines := f.newOrder(2)
	if err := f.orderRepo.Create(ctx, order, lines, codes(4)); err != nil {
		t.Fatalf("create: %v", err)
	}
	got, err := f.orderRepo.GetByReference(ctx, *order.PaystackReference)
	if err != nil {
		t.Fatalf("get by reference: %v", err)
	}
	if got.PaymentStatus != domain.GamePassOrderPending || len(got.Gamedays) != 2 || len(got.Tickets) != 4 {
		t.Fatalf("got status=%s gamedays=%d tickets=%d, want pending/2/4", got.PaymentStatus, len(got.Gamedays), len(got.Tickets))
	}
	sum := 0
	for _, tk := range got.Tickets {
		if tk.Status != domain.TicketStatusPending || tk.Quantity != 1 {
			t.Fatalf("ticket %s: status=%s quantity=%d", tk.TicketCode, tk.Status, tk.Quantity)
		}
		sum += tk.TotalAmount
	}
	if sum != order.Price.Total {
		t.Fatalf("ticket totals sum to %d, order total is %d", sum, order.Price.Total)
	}

	// Capacity 3, 2 pending held: a second bundle for 2 holders must not fit.
	second, lines2 := f.newOrder(2)
	err = f.orderRepo.Create(ctx, second, lines2, codes(4))
	if !errors.Is(err, appErrors.ErrInvalidGamePassConfig) || !strings.Contains(err.Error(), "only 1") {
		t.Fatalf("expected a capacity error naming 1 place left, got %v", err)
	}

	// A single-ticket purchase sees the bundle's pending seats too.
	ticketRepo := ports.NewTicketRepository(f.pool)
	single := &domain.Ticket{EventDayID: f.dayIDs[0], TierID: f.tierIDs[0], Email: "x@example.invalid",
		Quantity: 2, UnitPrice: 2500, TotalAmount: 5000, Status: domain.TicketStatusPending, TicketCode: services.GenerateTicketCode()}
	if err := ticketRepo.Create(ctx, single); err == nil || !strings.Contains(err.Error(), "only 1 remaining") {
		t.Fatalf("expected single purchase to be refused, got %v", err)
	}

	// Paying settles once: tickets paid, sold counts up by the holders.
	changed, err := f.orderRepo.MarkPaid(ctx, order.ID)
	if err != nil || !changed {
		t.Fatalf("first MarkPaid: changed=%v err=%v", changed, err)
	}
	changed, err = f.orderRepo.MarkPaid(ctx, order.ID)
	if err != nil || changed {
		t.Fatalf("repeat MarkPaid should be a no-op: changed=%v err=%v", changed, err)
	}
	for _, tierID := range f.tierIDs {
		if n := soldCount(t, f.pool, tierID); n != 2 {
			t.Fatalf("sold_count = %d, want 2", n)
		}
	}
	got, _ = f.orderRepo.GetByID(ctx, order.ID)
	for _, tk := range got.Tickets {
		if tk.Status != domain.TicketStatusPaid {
			t.Fatalf("ticket %s still %s after payment", tk.TicketCode, tk.Status)
		}
	}

	// A paid order can't be failed afterwards.
	if err := f.orderRepo.MarkFailed(ctx, order.ID); err != nil {
		t.Fatal(err)
	}
	if got, _ = f.orderRepo.GetByID(ctx, order.ID); got.PaymentStatus != domain.GamePassOrderPaid {
		t.Fatalf("paid order became %s", got.PaymentStatus)
	}
}

func TestGamePassOrderFailureReleasesSeats(t *testing.T) {
	f := setupGamePassFixture(t, 2)
	ctx := context.Background()

	order, lines := f.newOrder(2)
	if err := f.orderRepo.Create(ctx, order, lines, codes(4)); err != nil {
		t.Fatalf("create: %v", err)
	}
	if err := f.orderRepo.MarkFailed(ctx, order.ID); err != nil {
		t.Fatalf("mark failed: %v", err)
	}
	got, _ := f.orderRepo.GetByID(ctx, order.ID)
	if got.PaymentStatus != domain.GamePassOrderFailed || got.Tickets[0].Status != domain.TicketStatusFailed {
		t.Fatalf("got order=%s ticket=%s, want failed/FAILED", got.PaymentStatus, got.Tickets[0].Status)
	}

	// The failed order no longer holds the seats.
	again, lines2 := f.newOrder(2)
	if err := f.orderRepo.Create(ctx, again, lines2, codes(4)); err != nil {
		t.Fatalf("seats should be free again after a failed order: %v", err)
	}
}

func TestGamePassOrderTicketCodeCollision(t *testing.T) {
	f := setupGamePassFixture(t, 0)
	ctx := context.Background()

	first, lines := f.newOrder(1)
	c := codes(2)
	if err := f.orderRepo.Create(ctx, first, lines, c); err != nil {
		t.Fatalf("create: %v", err)
	}
	second, lines2 := f.newOrder(1)
	if err := f.orderRepo.Create(ctx, second, lines2, []string{c[0], services.GenerateTicketCode()}); !errors.Is(err, ports.ErrTicketCodeTaken) {
		t.Fatalf("expected ErrTicketCodeTaken, got %v", err)
	}
	if _, err := f.orderRepo.GetByReference(ctx, *second.PaystackReference); !errors.Is(err, appErrors.ErrNotFound) {
		t.Fatalf("a collided order must leave nothing behind, got %v", err)
	}
}

func TestGamePassLeadsAndBands(t *testing.T) {
	f := setupGamePassFixture(t, 0)
	ctx := context.Background()

	leads := ports.NewGamePassLeadRepository(f.pool)
	lead := &domain.GamePassLead{
		Name: f.tag + " Lead", Email: f.tag + "@Example.invalid", Phone: "080", TierName: "Regular",
		GamedayIDs: f.dayIDs, Price: domain.PriceGamePass(2000, 2, 1, nil),
	}
	if err := leads.Create(ctx, lead); err != nil {
		t.Fatalf("create lead: %v", err)
	}
	list, total, err := leads.List(ctx, "new", strings.ToUpper(f.tag), 1, 10)
	if err != nil || total != 1 || len(list) != 1 || len(list[0].Gamedays) != 2 {
		t.Fatalf("list: total=%d len=%d err=%v", total, len(list), err)
	}
	if err := leads.UpdateStatus(ctx, lead.ID, domain.GamePassLeadContacted); err != nil {
		t.Fatalf("update status: %v", err)
	}

	// With the service check skipped, the table's own exclusion constraint
	// still refuses a band overlapping the seeded 2–3 band.
	bands := ports.NewGamePassDiscountBandRepository(f.pool)
	max := 4
	overlap := &domain.GamePassDiscountBand{MinGamedays: 3, MaxGamedays: &max, DiscountPercent: 7, IsActive: true}
	if err := bands.Save(ctx, overlap, nil); !errors.Is(err, appErrors.ErrInvalidGamePassConfig) {
		t.Fatalf("expected the overlap to be refused by the database, got %v", err)
	}
}
