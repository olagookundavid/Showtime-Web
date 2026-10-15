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

type fakeSeasonRepo struct {
	ports.SeasonPassRepository
	passes  map[string]*domain.SeasonPass
	created *domain.SeasonPass
}

func (f *fakeSeasonRepo) GetByID(ctx context.Context, id string) (*domain.SeasonPass, error) {
	p, ok := f.passes[id]
	if !ok {
		return nil, fmt.Errorf("not found")
	}
	cp := *p
	return &cp, nil
}
func (f *fakeSeasonRepo) List(ctx context.Context, activeOnly bool) ([]domain.SeasonPass, error) {
	var out []domain.SeasonPass
	for _, p := range f.passes {
		if activeOnly && !p.IsActive {
			continue
		}
		out = append(out, *p)
	}
	return out, nil
}
func (f *fakeSeasonRepo) Create(ctx context.Context, p *domain.SeasonPass) error {
	p.ID = "new-pass"
	f.created = p
	return nil
}

// endsIn is a pass whose last valid day is `days` from today in Lagos.
func endsIn(id string, days int, active bool) *domain.SeasonPass {
	return &domain.SeasonPass{
		ID: id, Name: "Showtime Season Pass", Price: 50000, IsActive: active,
		EndsOn: todayLagos(time.Now()).AddDate(0, 0, days),
	}
}

func TestSeasonPassIsValidThroughItsEndDate(t *testing.T) {
	now := time.Now()
	if seasonPassExpired(endsIn("a", 0, true), now) {
		t.Error("a pass ending today is still good today")
	}
	if seasonPassExpired(endsIn("b", 30, true), now) {
		t.Error("a pass ending next month has not ended")
	}
	if !seasonPassExpired(endsIn("c", -1, true), now) {
		t.Error("a pass that ended yesterday has ended")
	}
}

func TestSeasonPassPricingIsTheAdminsPriceTimesQuantity(t *testing.T) {
	pass := &domain.SeasonPass{Price: 50000}
	if p := seasonPassPricing(pass, 1); p.Total != 50000 || p.UnitPrice != 50000 || p.GamePassAmount != 0 {
		t.Errorf("one pass should cost the price set, got %+v", p)
	}
	if p := seasonPassPricing(pass, 3); p.Total != 150000 || p.Subtotal != 150000 {
		t.Errorf("three passes should cost three times, got %+v", p)
	}
	if p := seasonPassPricing(&domain.SeasonPass{Price: 0}, 2); p.Total != 0 {
		t.Errorf("a free pass stays free, got %+v", p)
	}
}

func TestListSeasonPassesOffersOnlyLiveOnes(t *testing.T) {
	svc := &TicketService{seasonRepo: &fakeSeasonRepo{passes: map[string]*domain.SeasonPass{
		"live":     endsIn("live", 60, true),
		"off":      endsIn("off", 60, false),
		"ended":    endsIn("ended", -2, true),
		"lastday":  endsIn("lastday", 0, true),
		"inactive": endsIn("inactive", -2, false),
	}}}
	got, err := svc.ListSeasonPasses(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	ids := map[string]bool{}
	for _, p := range got {
		ids[p.ID] = true
		if p.Expired {
			t.Errorf("%s is listed but expired", p.ID)
		}
	}
	if len(got) != 2 || !ids["live"] || !ids["lastday"] {
		t.Fatalf("only passes that are switched on and not ended should be offered, got %v", ids)
	}

	// Admins see everything, with the ended ones marked.
	all, _ := svc.ListSeasonPassesAdmin(context.Background())
	if len(all) != 5 {
		t.Fatalf("admins should see all 5 passes, got %d", len(all))
	}
}

func TestGetSeasonPassHidesEndedAndSwitchedOffPasses(t *testing.T) {
	svc := &TicketService{seasonRepo: &fakeSeasonRepo{passes: map[string]*domain.SeasonPass{
		"live":  endsIn("live", 10, true),
		"off":   endsIn("off", 10, false),
		"ended": endsIn("ended", -1, true),
	}}}
	ctx := context.Background()
	if p, err := svc.GetSeasonPass(ctx, "live"); err != nil || p.Price != 50000 || p.EndsOn == "" {
		t.Fatalf("a live pass should be returned with its price and end date, got %+v err=%v", p, err)
	}
	for _, id := range []string{"off", "ended", "missing"} {
		if _, err := svc.GetSeasonPass(ctx, id); err == nil {
			t.Errorf("%s should read as not found", id)
		}
	}
}

func TestPurchaseSeasonPassRefusesAnEndedOrSwitchedOffPass(t *testing.T) {
	svc := &TicketService{seasonRepo: &fakeSeasonRepo{passes: map[string]*domain.SeasonPass{
		"off":   endsIn("off", 10, false),
		"ended": endsIn("ended", -1, true),
	}}}
	req := func(id string) dto.PurchaseSeasonPassRequest {
		return dto.PurchaseSeasonPassRequest{SeasonPassID: id, Email: "a@example.test", Name: "A", Phone: "1", Quantity: 1}
	}
	if _, err := svc.PurchaseSeasonPass(context.Background(), req("off"), "http://x", nil); err == nil || !strings.Contains(err.Error(), "not found") {
		t.Errorf("a switched-off pass cannot be bought, got %v", err)
	}
	if _, err := svc.PurchaseSeasonPass(context.Background(), req("ended"), "http://x", nil); err == nil || !strings.Contains(err.Error(), "ended") {
		t.Errorf("an ended pass cannot be bought, got %v", err)
	}
}

func TestCreateSeasonPassValidation(t *testing.T) {
	ctx := context.Background()
	repo := &fakeSeasonRepo{passes: map[string]*domain.SeasonPass{}}
	svc := &TicketService{seasonRepo: repo}

	if _, err := svc.CreateSeasonPass(ctx, dto.CreateSeasonPassRequest{Name: "  ", EndsOn: "2027-05-31"}); err == nil {
		t.Error("a name is required")
	}
	if _, err := svc.CreateSeasonPass(ctx, dto.CreateSeasonPassRequest{Name: "Pass", EndsOn: "31/05/2027"}); err == nil || !strings.Contains(err.Error(), "end date") {
		t.Errorf("a malformed date should be explained, got %v", err)
	}
	res, err := svc.CreateSeasonPass(ctx, dto.CreateSeasonPassRequest{Name: " Showtime Season Pass ", Price: 75000, EndsOn: "2027-05-31"})
	if err != nil {
		t.Fatal(err)
	}
	if repo.created == nil || repo.created.Name != "Showtime Season Pass" || repo.created.Price != 75000 || !repo.created.IsActive {
		t.Fatalf("unexpected pass created: %+v", repo.created)
	}
	if res.EndsOn != "2027-05-31" {
		t.Errorf("the end date should come back as given, got %q", res.EndsOn)
	}
}
