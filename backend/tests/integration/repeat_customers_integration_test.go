package tests_integration

// Integration coverage for repeat-customer tracking: the column on the admin
// tickets list and the weekly report on the dashboard.

import (
	"context"
	"fmt"
	"testing"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/ports"
	"showtime-backend/internal/services"
)

// boughtOn makes a ticket for the match days, as bought on the given Lagos date.
func (f *ticketFixture) boughtOn(t *testing.T, lagosDate string, p *domain.TicketProduct, email, phone string, status domain.TicketStatus, total int, pds ...*domain.TicketProductDay) *domain.Ticket {
	t.Helper()
	tk := f.newTicket(p, 1, status, pds...)
	tk.Email = email
	tk.Phone = phone
	tk.TotalAmount = total
	if err := f.tickets.Create(context.Background(), tk); err != nil {
		t.Fatalf("create ticket: %v", err)
	}
	// Midday Lagos, so the date cannot slip across midnight in UTC.
	mustExec(t, f.pool,
		`UPDATE tickets SET created_at = ($2 || ' 12:00')::timestamp AT TIME ZONE 'Africa/Lagos' WHERE id = $1`, tk.ID, lagosDate)
	return tk
}

// priorOf reads a ticket the way the admin lists do, which is where the repeat
// column comes from.
func priorOf(t *testing.T, f *ticketFixture, tk *domain.Ticket) *int {
	t.Helper()
	found, _, err := f.tickets.SearchByEmail(context.Background(), tk.Email, 1, 50)
	if err != nil {
		t.Fatal(err)
	}
	for _, got := range found {
		if got.ID == tk.ID {
			return got.PriorPurchases
		}
	}
	t.Fatalf("ticket %s not found by its email", tk.ID)
	return nil
}

func TestRepeatCustomers_ColumnAndWeeklyReport(t *testing.T) {
	f := newTicketFixture(t)
	ctx := context.Background()
	analytics := ports.NewAnalyticsRepository(f.pool)

	d1 := f.eventDay(t, "rc-1", "2090-06-01")
	d2 := f.eventDay(t, "rc-2", "2090-06-08")
	comp := f.competition(t, "rc", "2090-06-01", "2090-06-08")
	p := f.product(t, "RC", 1000, 0, comp)
	pd1 := f.productDay(t, p, d1)
	pd2 := f.productDay(t, p, d2)

	suffix := fmt.Sprint(time.Now().UnixNano() % 100000)
	ada := "ada" + suffix + "@ticketfixture.test"
	bola := "bola" + suffix + "@ticketfixture.test"
	chi := "chi" + suffix + "@ticketfixture.test"
	dayo := "dayo" + suffix + "@ticketfixture.test"
	emma := "emma" + suffix + "@ticketfixture.test"
	phone := "08031234" + suffix[:3]

	// Ada: day 1 purchase, then comes back for day 2.
	adaFirst := f.boughtOn(t, "2090-05-20", p, ada, "", domain.TicketStatusPaid, 1000, pd1)
	adaBack := f.boughtOn(t, "2090-05-27", p, ada, "", domain.TicketStatusPaid, 1000, pd2)
	// Bola: buys twice on the same day — one visit, not a return.
	bolaA := f.boughtOn(t, "2090-05-28", p, bola, "", domain.TicketStatusPaid, 1000, pd2)
	bolaB := f.boughtOn(t, "2090-05-28", p, bola, "", domain.TicketStatusPaid, 1000, pd2)
	// Chi bought before with a different email but the same phone, written differently.
	f.boughtOn(t, "2090-05-10", p, chi, phone, domain.TicketStatusPaid, 1000, pd1)
	chiBack := f.boughtOn(t, "2090-05-29", p, dayo, "+234"+phone[1:], domain.TicketStatusPaid, 1000, pd2)
	// Emma's earlier tickets were a gift, an unpaid order and a player ticket: none count.
	f.boughtOn(t, "2090-05-01", p, emma, "", domain.TicketStatusPaid, 0, pd1)
	f.boughtOn(t, "2090-05-02", p, emma, "", domain.TicketStatusPending, 1000, pd1)
	player := f.boughtOn(t, "2090-05-03", p, emma, "", domain.TicketStatusPaid, 1000, pd1)
	mustExec(t, f.pool, `UPDATE tickets SET purchase_type = 'PLAYER' WHERE id = $1`, player.ID)
	emmaNew := f.boughtOn(t, "2090-05-30", p, emma, "", domain.TicketStatusPaid, 1000, pd2)
	pending := f.boughtOn(t, "2090-05-31", p, ada, "", domain.TicketStatusPending, 1000, pd2)

	want := map[string]struct {
		tk    *domain.Ticket
		prior int
	}{
		"ada first": {adaFirst, 0}, "ada back": {adaBack, 1},
		"bola a": {bolaA, 0}, "bola b": {bolaB, 0},
		"chi by phone": {chiBack, 1}, "emma": {emmaNew, 0},
	}
	for name, w := range want {
		got := priorOf(t, f, w.tk)
		if got == nil || *got != w.prior {
			t.Errorf("%s: prior purchases = %v, want %d", name, got, w.prior)
		}
	}
	if got := priorOf(t, f, pending); got != nil {
		t.Errorf("an unpaid ticket should say nothing about the buyer, got %d", *got)
	}

	// The admin list carries the same numbers.
	list, _, err := f.tickets.List(ctx, d2.ID, "", 1, 50)
	if err != nil {
		t.Fatal(err)
	}
	seen := 0
	for _, tk := range list {
		if tk.ID == adaBack.ID {
			seen++
			if tk.PriorPurchases == nil || *tk.PriorPurchases != 1 {
				t.Errorf("list: ada's return should show 1 prior purchase, got %v", tk.PriorPurchases)
			}
		}
	}
	if seen != 1 {
		t.Fatalf("list should include ada's ticket once, saw %d", seen)
	}

	// Weekly report: day 2 has Ada, Bola, Dayo (via phone) and Emma as buyers, and
	// Ada and Dayo are the returning ones.
	days, err := analytics.RepeatCustomerDays(ctx)
	if err != nil {
		t.Fatal(err)
	}
	var day2 *ports.RepeatCustomerDay
	for i := range days {
		if days[i].EventDayID == d2.ID {
			day2 = &days[i]
		}
	}
	if day2 == nil {
		t.Fatal("day 2 should be in the report")
	}
	if day2.Buyers != 4 || day2.Returning != 2 {
		t.Fatalf("day 2: buyers=%d returning=%d, want 4 and 2", day2.Buyers, day2.Returning)
	}

	customers, err := analytics.RepeatCustomers(ctx, d2.ID)
	if err != nil {
		t.Fatal(err)
	}
	got := map[string]int{}
	for _, c := range customers {
		got[c.Email] = c.PriorPurchases
	}
	if len(got) != 2 || got[ada] != 1 || got[dayo] != 1 {
		t.Fatalf("returning customers for day 2 = %v, want only ada and dayo with 1 each", got)
	}

	// The service picks the report's day and shapes the response.
	svc := services.NewAnalyticsService(nil, nil, analytics)
	report, err := svc.GetRepeatCustomerReport(ctx, d2.ID)
	if err != nil {
		t.Fatal(err)
	}
	if report.EventDayID != d2.ID || len(report.Customers) != 2 {
		t.Fatalf("report = day %s with %d customers", report.EventDayID, len(report.Customers))
	}
}
