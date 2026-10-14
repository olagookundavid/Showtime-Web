package services

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

type fakeEventDayRepo struct {
	ports.EventDayRepository
	updatedID       string
	updatedTitle    *string
	updatedDate     *time.Time
	updatedVenue    *string
	updatedIsActive *bool
}

func (f *fakeEventDayRepo) Update(ctx context.Context, id string, title *string, date *time.Time, venue *string, isActive *bool) error {
	f.updatedID = id
	f.updatedTitle = title
	f.updatedDate = date
	f.updatedVenue = venue
	f.updatedIsActive = isActive
	return nil
}

func TestUpdateEventDay(t *testing.T) {
	edRepo := &fakeEventDayRepo{}
	svc := &TicketService{eventDayRepo: edRepo}

	title := "Updated Game Day"
	dateStr := "2026-10-15"
	venue := "Teslim Balogun Stadium"
	isActive := true

	req := dto.UpdateEventDayRequest{
		Title:    &title,
		Date:     &dateStr,
		Venue:    &venue,
		IsActive: &isActive,
	}

	ctx := context.Background()
	err := svc.UpdateEventDay(ctx, "ed-123", req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if edRepo.updatedID != "ed-123" {
		t.Errorf("expected updatedID ed-123, got %s", edRepo.updatedID)
	}
	if edRepo.updatedTitle == nil || *edRepo.updatedTitle != title {
		t.Errorf("expected title %s, got %v", title, edRepo.updatedTitle)
	}
	if edRepo.updatedDate == nil || edRepo.updatedDate.Format("2006-01-02") != dateStr {
		t.Errorf("expected date %s, got %v", dateStr, edRepo.updatedDate)
	}
	if edRepo.updatedVenue == nil || *edRepo.updatedVenue != venue {
		t.Errorf("expected venue %s, got %v", venue, edRepo.updatedVenue)
	}
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

func TestPriceTicketSingleIsNeverDiscounted(t *testing.T) {
	// Even if a rule exists, a single ticket must not pick it up.
	rules := []domain.GamePassRule{{MinDays: 2, PercentOff: 50, IsActive: true}}
	p := PriceTicket([]int{5000}, 2, domain.PurchaseTypeSingle, rules)
	if p.Subtotal != 10000 || p.GamePassAmount != 0 || p.Total != 10000 {
		t.Fatalf("unexpected pricing: %+v", p)
	}
}

func TestPriceTicketGamePassAtLaunchIsPlainMultiple(t *testing.T) {
	// Launch ladder is all 0%: three days costs three times the price.
	rules := []domain.GamePassRule{
		{MinDays: 2, PercentOff: 0, IsActive: true},
		{MinDays: 3, PercentOff: 0, IsActive: true},
	}
	p := PriceTicket([]int{5000, 5000, 5000}, 1, domain.PurchaseTypeGamePass, rules)
	if p.UnitPrice != 15000 || p.Total != 15000 || p.GamePassPercent != 0 {
		t.Fatalf("unexpected pricing: %+v", p)
	}
}

func TestPriceTicketGamePassLadder(t *testing.T) {
	rules := []domain.GamePassRule{
		{MinDays: 2, PercentOff: 5, IsActive: true},
		{MinDays: 3, PercentOff: 10, IsActive: true},
		{MinDays: 5, PercentOff: 20, IsActive: false}, // inactive: ignored
	}
	cases := []struct {
		days        int
		wantPercent float64
	}{
		{1, 0}, // below every rung
		{2, 5},
		{3, 10},
		{4, 10}, // highest rung reached
		{6, 10}, // the 5-day rung is inactive
	}
	for _, c := range cases {
		prices := make([]int, c.days)
		for i := range prices {
			prices[i] = 1000
		}
		p := PriceTicket(prices, 1, domain.PurchaseTypeGamePass, rules)
		if p.GamePassPercent != c.wantPercent {
			t.Errorf("%d days: percent = %v, want %v", c.days, p.GamePassPercent, c.wantPercent)
		}
	}
}

func TestPriceTicketGamePassDiscountAppliesToQuantityAndRounds(t *testing.T) {
	rules := []domain.GamePassRule{{MinDays: 2, PercentOff: 10, IsActive: true}}
	// 2 days at 2500 = 5000 per person, x3 = 15000, 10% = 1500.
	p := PriceTicket([]int{2500, 2500}, 3, domain.PurchaseTypeGamePass, rules)
	if p.Subtotal != 15000 || p.GamePassAmount != 1500 || p.Total != 13500 {
		t.Fatalf("unexpected pricing: %+v", p)
	}
	// 3333 x 2 = 6666; 7.5% = 499.95 -> rounds to 500.
	p = PriceTicket([]int{3333, 3333}, 1, domain.PurchaseTypeGamePass, []domain.GamePassRule{{MinDays: 2, PercentOff: 7.5, IsActive: true}})
	if p.GamePassAmount != 500 || p.Total != 6166 {
		t.Fatalf("unexpected rounding: %+v", p)
	}
}

func TestPriceTicketFreeDaysStayFree(t *testing.T) {
	p := PriceTicket([]int{0, 0}, 2, domain.PurchaseTypeGamePass, []domain.GamePassRule{{MinDays: 2, PercentOff: 25, IsActive: true}})
	if p.Total != 0 || p.GamePassAmount != 0 {
		t.Fatalf("free pass should stay free: %+v", p)
	}
}

// ─── Selection rules ──────────────────────────────────────────────────────────

type fakeProductRepo struct {
	ports.TicketProductRepository
	product *domain.TicketProduct
	days    map[string]domain.TicketProductDay // by event day id
}

func (f *fakeProductRepo) GetProduct(ctx context.Context, id string) (*domain.TicketProduct, error) {
	if f.product == nil || f.product.ID != id {
		return nil, fmt.Errorf("not found")
	}
	cp := *f.product
	return &cp, nil
}

func (f *fakeProductRepo) GetProductDays(ctx context.Context, productID string, ids []string) ([]domain.TicketProductDay, error) {
	var out []domain.TicketProductDay
	for _, id := range ids {
		if d, ok := f.days[id]; ok {
			out = append(out, d)
		}
	}
	return out, nil
}

func futureDay(id string, offsetDays int, price, capacity, sold int) domain.TicketProductDay {
	date := time.Now().AddDate(0, 0, offsetDays)
	return domain.TicketProductDay{
		ID:         "pd-" + id,
		ProductID:  "p1",
		EventDayID: id,
		Price:      price,
		Capacity:   capacity,
		SoldCount:  sold,
		IsActive:   true,
		EventDay:   &domain.EventDay{ID: id, Title: "Day " + id, Date: date, IsActive: true},
	}
}

func newSelectionService() *TicketService {
	return &TicketService{productRepo: &fakeProductRepo{
		product: &domain.TicketProduct{ID: "p1", Name: "VIP", IsActive: true, AllowGamePass: true},
		days: map[string]domain.TicketProductDay{
			"d1": futureDay("d1", 7, 5000, 0, 0),
			"d2": futureDay("d2", 14, 5000, 0, 0),
			"d3": futureDay("d3", 21, 5000, 10, 9), // one seat left
			"dp": futureDay("dp", -3, 5000, 0, 0),  // already played
		},
	}}
}

func TestResolveSelectionSingleNeedsExactlyOneDay(t *testing.T) {
	svc := newSelectionService()
	ctx := context.Background()

	if _, err := svc.resolveSelection(ctx, "p1", []string{"d1", "d2"}, domain.PurchaseTypeSingle, 1, "", false); err == nil {
		t.Fatal("a single ticket for two days should be refused")
	}
	if _, err := svc.resolveSelection(ctx, "p1", []string{"d1"}, domain.PurchaseTypeSingle, 1, "", false); err != nil {
		t.Fatalf("a single ticket for one day should be allowed: %v", err)
	}
}

func TestResolveSelectionGamePassNeedsTwoOrMoreDays(t *testing.T) {
	svc := newSelectionService()
	ctx := context.Background()

	if _, err := svc.resolveSelection(ctx, "p1", []string{"d1"}, domain.PurchaseTypeGamePass, 1, "", false); err == nil {
		t.Fatal("a Game Pass for one day should be refused")
	}
	// Duplicates collapse, so the same day twice is still one day.
	if _, err := svc.resolveSelection(ctx, "p1", []string{"d1", "d1"}, domain.PurchaseTypeGamePass, 1, "", false); err == nil {
		t.Fatal("the same day twice is one day, not a pass")
	}
	sel, err := svc.resolveSelection(ctx, "p1", []string{"d2", "d1"}, domain.PurchaseTypeGamePass, 1, "", false)
	if err != nil {
		t.Fatalf("a two-day pass should be allowed: %v", err)
	}
	if sel.days[0].EventDayID != "d1" || sel.days[1].EventDayID != "d2" {
		t.Fatalf("days should be ordered by date, got %s then %s", sel.days[0].EventDayID, sel.days[1].EventDayID)
	}
}

func TestResolveSelectionRefusesPastAndSoldOutDays(t *testing.T) {
	svc := newSelectionService()
	ctx := context.Background()

	if _, err := svc.resolveSelection(ctx, "p1", []string{"dp"}, domain.PurchaseTypeSingle, 1, "", false); err == nil || !strings.Contains(err.Error(), "past") {
		t.Fatalf("a past day should be refused, got %v", err)
	}
	if _, err := svc.resolveSelection(ctx, "p1", []string{"d3"}, domain.PurchaseTypeSingle, 2, "", false); err == nil || !strings.Contains(err.Error(), "only 1 remaining") {
		t.Fatalf("expected a remaining-seats error, got %v", err)
	}
	// One full day sinks the whole pass.
	if _, err := svc.resolveSelection(ctx, "p1", []string{"d1", "d3"}, domain.PurchaseTypeGamePass, 2, "", false); err == nil {
		t.Fatal("a pass including a day without enough seats should be refused")
	}
}

func TestResolveSelectionHiddenProductNeedsAccessCode(t *testing.T) {
	svc := newSelectionService()
	repo := svc.productRepo.(*fakeProductRepo)
	code := "VIP2026"
	repo.product.IsHidden = true
	repo.product.AccessCode = &code
	ctx := context.Background()

	if _, err := svc.resolveSelection(ctx, "p1", []string{"d1"}, domain.PurchaseTypeSingle, 1, "", false); err == nil {
		t.Fatal("a hidden ticket without its code should look like it does not exist")
	}
	if _, err := svc.resolveSelection(ctx, "p1", []string{"d1"}, domain.PurchaseTypeSingle, 1, " vip2026 ", false); err != nil {
		t.Fatalf("the right code, any case, should unlock it: %v", err)
	}
	if _, err := svc.resolveSelection(ctx, "p1", []string{"d1"}, domain.PurchaseTypeSingle, 1, "", true); err != nil {
		t.Fatalf("an admin issuing a ticket does not need the code: %v", err)
	}
}

func TestResolveSelectionRespectsAllowGamePass(t *testing.T) {
	svc := newSelectionService()
	svc.productRepo.(*fakeProductRepo).product.AllowGamePass = false
	if _, err := svc.resolveSelection(context.Background(), "p1", []string{"d1", "d2"}, domain.PurchaseTypeGamePass, 1, "", false); err == nil {
		t.Fatal("a product that opts out of Game Pass should be refused")
	}
}

// ─── Check-in ─────────────────────────────────────────────────────────────────

func ticketWithDays(days ...domain.TicketDay) *domain.Ticket {
	return &domain.Ticket{ID: "t1", Days: days}
}

func TestDayForCheckinPicksToday(t *testing.T) {
	now := time.Date(2026, 11, 14, 14, 0, 0, 0, lagos())
	tk := ticketWithDays(
		domain.TicketDay{EventDayID: "d1", Title: "Day 1", Date: time.Date(2026, 11, 13, 0, 0, 0, 0, time.UTC)},
		domain.TicketDay{EventDayID: "d2", Title: "Day 2", Date: time.Date(2026, 11, 14, 0, 0, 0, 0, time.UTC)},
	)
	day, err := dayForCheckin(tk, "", true, now)
	if err != nil || day.EventDayID != "d2" {
		t.Fatalf("expected d2, got %v err=%v", day, err)
	}
}

func TestDayForCheckinStrictRejectsWhenNoDayToday(t *testing.T) {
	now := time.Date(2026, 11, 20, 14, 0, 0, 0, lagos())
	tk := ticketWithDays(domain.TicketDay{EventDayID: "d1", Date: time.Date(2026, 11, 13, 0, 0, 0, 0, time.UTC)})
	if _, err := dayForCheckin(tk, "", true, now); err == nil || !strings.Contains(err.Error(), "not valid today") {
		t.Fatalf("expected a not-valid-today error, got %v", err)
	}
}

func TestDayForCheckinAdminFallsBackToEarliestUnattended(t *testing.T) {
	now := time.Date(2026, 11, 20, 14, 0, 0, 0, lagos())
	attended := time.Now()
	tk := ticketWithDays(
		domain.TicketDay{EventDayID: "d1", Date: time.Date(2026, 11, 13, 0, 0, 0, 0, time.UTC), CheckedInAt: &attended},
		domain.TicketDay{EventDayID: "d2", Date: time.Date(2026, 11, 27, 0, 0, 0, 0, time.UTC)},
	)
	day, err := dayForCheckin(tk, "", false, now)
	if err != nil || day.EventDayID != "d2" {
		t.Fatalf("expected d2, got %v err=%v", day, err)
	}
}

func TestDayForCheckinExplicitDayMustBeOnTicket(t *testing.T) {
	now := time.Date(2026, 11, 13, 14, 0, 0, 0, lagos())
	tk := ticketWithDays(domain.TicketDay{EventDayID: "d1", Date: time.Date(2026, 11, 13, 0, 0, 0, 0, time.UTC)})
	if _, err := dayForCheckin(tk, "other", true, now); err == nil {
		t.Fatal("a day that is not on the ticket should be refused")
	}
	if day, err := dayForCheckin(tk, "d1", true, now); err != nil || day.EventDayID != "d1" {
		t.Fatalf("an explicit day on the ticket, today, should be honoured, got %v err=%v", day, err)
	}
}

func TestDayForCheckinStrictExplicitDayMustBeToday(t *testing.T) {
	// The gate must not admit a ticket a week early just because the day was named.
	now := time.Date(2026, 11, 6, 14, 0, 0, 0, lagos())
	tk := ticketWithDays(domain.TicketDay{EventDayID: "d1", Title: "Day 1", Date: time.Date(2026, 11, 13, 0, 0, 0, 0, time.UTC)})
	if _, err := dayForCheckin(tk, "d1", true, now); err == nil || !strings.Contains(err.Error(), "is not today") {
		t.Fatalf("expected an is-not-today error, got %v", err)
	}
	// The admin override may name any day on the ticket.
	if day, err := dayForCheckin(tk, "d1", false, now); err != nil || day.EventDayID != "d1" {
		t.Fatalf("the override should allow it, got %v err=%v", day, err)
	}
}

// ─── Reminders ────────────────────────────────────────────────────────────────

func TestReminderSendAtIsNineAMLagosTheDayBefore(t *testing.T) {
	matchDay := time.Date(2026, 12, 5, 0, 0, 0, 0, time.UTC) // stored DATE
	got := reminderSendAt(matchDay)
	want := time.Date(2026, 12, 4, 9, 0, 0, 0, lagos())
	if !got.Equal(want) {
		t.Fatalf("got %v, want %v", got, want)
	}
	// 09:00 WAT is 08:00 UTC.
	if got.UTC().Hour() != 8 {
		t.Fatalf("expected 08:00 UTC, got %v", got.UTC())
	}
}

func TestReminderSendAtCrossesMonthBoundary(t *testing.T) {
	got := reminderSendAt(time.Date(2026, 12, 1, 0, 0, 0, 0, time.UTC))
	if got.Day() != 30 || got.Month() != time.November {
		t.Fatalf("expected 30 Nov, got %v", got)
	}
}

// ─── Game Pass rules ──────────────────────────────────────────────────────────

func TestSaveGamePassRulesRejectsDuplicateDays(t *testing.T) {
	svc := &TicketService{productRepo: &fakeProductRepo{}}
	_, err := svc.SaveGamePassRules(context.Background(), dto.SaveGamePassRulesRequest{Rules: []dto.GamePassRuleDTO{
		{MinDays: 3, PercentOff: 5},
		{MinDays: 3, PercentOff: 10},
	}})
	if err == nil || !strings.Contains(err.Error(), "two rules for 3 days") {
		t.Fatalf("expected a duplicate-rule error, got %v", err)
	}
}
