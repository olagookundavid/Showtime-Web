package services

// End-to-end coverage of Game Pass checkout and settlement against a real,
// migrated database and a fake Paystack. Lives in this package because the
// Paystack client's base URL is unexported. Skipped unless TEST_DB_DSN is set
// (see tests/integration/fantasy_repo_integration_test.go for setup).

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	appErrors "showtime-backend/internal/errors"
	"showtime-backend/internal/ports"

	"github.com/jackc/pgx/v5/pgxpool"
)

// fakePaystack answers initialize and verify; chargedKobo overrides the
// amount verify reports, to simulate an underpayment.
type fakePaystack struct {
	mu          sync.Mutex
	amounts     map[string]int // reference -> kobo initialized
	chargedKobo *int
}

func (f *fakePaystack) handler(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()
	switch {
	case r.URL.Path == "/transaction/initialize":
		var req PaystackInitRequest
		_ = json.NewDecoder(r.Body).Decode(&req)
		f.amounts[req.Reference] = req.Amount
		fmt.Fprintf(w, `{"status":true,"data":{"authorization_url":"https://pay.test/%s","access_code":"ac_%s","reference":"%s"}}`, req.Reference, req.Reference, req.Reference)
	case strings.HasPrefix(r.URL.Path, "/transaction/verify/"):
		ref := strings.TrimPrefix(r.URL.Path, "/transaction/verify/")
		amount := f.amounts[ref]
		if f.chargedKobo != nil {
			amount = *f.chargedKobo
		}
		fmt.Fprintf(w, `{"status":true,"data":{"status":"success","reference":"%s","amount":%d,"currency":"NGN"}}`, ref, amount)
	default:
		http.NotFound(w, r)
	}
}

type gamePassServiceFixture struct {
	svc      IGamePassService
	pool     *pgxpool.Pool
	paystack *fakePaystack
	tierID   string // season tier
	dayIDs   []string
	tag      string
}

func setupGamePassService(t *testing.T, seasonPrice int) *gamePassServiceFixture {
	t.Helper()
	dsn := os.Getenv("TEST_DB_DSN")
	if dsn == "" {
		t.Skip("Skipping game pass service integration tests: TEST_DB_DSN not set")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}

	fp := &fakePaystack{amounts: map[string]int{}}
	srv := httptest.NewServer(http.HandlerFunc(fp.handler))
	client := &PaystackClient{secretKey: "sk_test", baseURL: srv.URL, client: srv.Client()}

	seed := time.Now().UnixNano() % 1000000
	f := &gamePassServiceFixture{pool: pool, paystack: fp, tag: fmt.Sprintf("GPSvc%d", seed)}
	tierName := f.tag + " Regular"

	exec := func(sql string, args ...any) string {
		t.Helper()
		var id string
		if err := pool.QueryRow(ctx, sql, args...).Scan(&id); err != nil {
			t.Fatalf("fixture: %v\n%s", err, sql)
		}
		return id
	}
	base := 30000 + int(seed%20000)*3
	for i := 0; i < 3; i++ {
		day := exec(`INSERT INTO event_days (title, date) VALUES ($1, CURRENT_DATE + $2::int) RETURNING id`,
			fmt.Sprintf("%s Day %d", f.tag, i+1), base+i)
		f.dayIDs = append(f.dayIDs, day)
		// The third gameday doesn't sell this tier.
		if i < 2 {
			exec(`INSERT INTO ticket_tiers (event_day_id, name, price, capacity) VALUES ($1, $2, 2500, 0) RETURNING id`, day, tierName)
		}
	}
	f.tierID = exec(`INSERT INTO season_admission_tiers (name, price) VALUES ($1, $2) RETURNING id`, tierName, seasonPrice)

	f.svc = NewGamePassService(
		ports.NewSeasonAdmissionTierRepository(pool),
		ports.NewGamePassDiscountBandRepository(pool),
		ports.NewGamePassLeadRepository(pool),
		ports.NewEventDayRepository(pool),
		ports.NewTicketTierRepository(pool),
		ports.NewGamePassOrderRepository(pool),
		client,
		nil, // no email in tests
	)

	t.Cleanup(func() {
		srv.Close()
		bg := context.Background()
		_, _ = pool.Exec(bg, `DELETE FROM tickets WHERE event_day_id = ANY($1::uuid[])`, f.dayIDs)
		_, _ = pool.Exec(bg, `DELETE FROM game_pass_orders WHERE season_tier_id = $1`, f.tierID)
		_, _ = pool.Exec(bg, `DELETE FROM ticket_tiers WHERE event_day_id = ANY($1::uuid[])`, f.dayIDs)
		_, _ = pool.Exec(bg, `DELETE FROM event_days WHERE id = ANY($1::uuid[])`, f.dayIDs)
		_, _ = pool.Exec(bg, `DELETE FROM season_admission_tiers WHERE id = $1`, f.tierID)
		pool.Close()
	})
	return f
}

func (f *gamePassServiceFixture) checkout(days []string, holders int) (*dto.GamePassOrderResponse, error) {
	return f.svc.Checkout(context.Background(), dto.GamePassCheckoutRequest{
		Name: f.tag, Email: "buyer@example.invalid", Phone: "080",
		TierID: f.tierID, GamedayIDs: days, Holders: holders,
	}, "https://site.test/tickets/game-pass/confirm", nil)
}

func TestGamePassCheckoutAndWebhook(t *testing.T) {
	f := setupGamePassService(t, 2000)
	ctx := context.Background()

	// 2 gamedays x 2 holders at ₦2,000 = ₦8,000, less the seeded 5% = ₦7,600.
	order, err := f.checkout(f.dayIDs[:2], 2)
	if err != nil {
		t.Fatalf("checkout: %v", err)
	}
	if order.Total != 7600 || order.DiscountPercent != 5 || order.PaymentStatus != "pending" || order.AuthorizationURL == "" {
		t.Fatalf("got total=%d pct=%d status=%s url=%q", order.Total, order.DiscountPercent, order.PaymentStatus, order.AuthorizationURL)
	}
	if len(order.Tickets) != 0 {
		t.Fatalf("a pending checkout must not reveal ticket codes")
	}
	if kobo := f.paystack.amounts[order.PaystackReference]; kobo != 760000 {
		t.Fatalf("Paystack was asked for %d kobo, want 760000", kobo)
	}

	// The webhook settles it, and a retry is harmless.
	for i := 0; i < 2; i++ {
		if err := f.svc.HandleWebhook(ctx, order.PaystackReference); err != nil {
			t.Fatalf("webhook #%d: %v", i+1, err)
		}
	}
	paid, err := f.svc.VerifyPayment(ctx, order.PaystackReference)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if paid.PaymentStatus != "paid" || len(paid.Tickets) != 4 {
		t.Fatalf("got status=%s tickets=%d, want paid/4", paid.PaymentStatus, len(paid.Tickets))
	}
	for _, tk := range paid.Tickets {
		if tk.Status != string(domain.TicketStatusPaid) {
			t.Fatalf("ticket %s is %s", tk.TicketCode, tk.Status)
		}
	}
}

func TestGamePassUnderpaymentFails(t *testing.T) {
	f := setupGamePassService(t, 2000)
	order, err := f.checkout(f.dayIDs[:2], 1)
	if err != nil {
		t.Fatalf("checkout: %v", err)
	}
	short := 100
	f.paystack.chargedKobo = &short
	if err := f.svc.HandleWebhook(context.Background(), order.PaystackReference); err != nil {
		t.Fatalf("webhook: %v", err)
	}
	got, _ := f.svc.GetOrderByReference(context.Background(), order.PaystackReference)
	if got.PaymentStatus != "failed" {
		t.Fatalf("an underpaid order must fail, got %s", got.PaymentStatus)
	}
}

func TestGamePassFreeTierSkipsPaystack(t *testing.T) {
	f := setupGamePassService(t, 0)
	order, err := f.checkout(f.dayIDs[:2], 1)
	if err != nil {
		t.Fatalf("checkout: %v", err)
	}
	if order.PaymentStatus != "paid" || order.AuthorizationURL != "" || len(order.Tickets) != 2 {
		t.Fatalf("got status=%s url=%q tickets=%d, want paid/none/2", order.PaymentStatus, order.AuthorizationURL, len(order.Tickets))
	}
	if len(f.paystack.amounts) != 0 {
		t.Fatalf("a free order must not touch Paystack")
	}
}

func TestGamePassCheckoutRejections(t *testing.T) {
	f := setupGamePassService(t, 2000)
	cases := []struct {
		name    string
		days    []string
		holders int
		want    string
	}{
		{"one gameday", f.dayIDs[:1], 1, "at least 2 gamedays"},
		{"same gameday twice", []string{f.dayIDs[0], f.dayIDs[0]}, 1, "at least 2 gamedays"},
		{"too many holders", f.dayIDs[:2], 11, "1 to 10 pass holders"},
		{"gameday without the tier", f.dayIDs, 1, "doesn't offer"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := f.checkout(tc.days, tc.holders)
			if !errors.Is(err, appErrors.ErrInvalidGamePassConfig) || !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("expected %q, got %v", tc.want, err)
			}
		})
	}
	if len(f.paystack.amounts) != 0 {
		t.Fatalf("rejected checkouts must not reach Paystack")
	}
}
