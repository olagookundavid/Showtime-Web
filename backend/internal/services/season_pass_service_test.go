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

// ─── Pricing ──────────────────────────────────────────────────────────────────

func TestPriceSeasonPassIsFullPriceLessItsOwnPercentage(t *testing.T) {
	// 30 match days at 3000, 30% off: 90,000 less 27,000.
	prices := make([]int, 30)
	for i := range prices {
		prices[i] = 3000
	}
	p := PriceSeasonPass(prices, 1, 30)
	if p.UnitPrice != 90000 || p.Subtotal != 90000 || p.GamePassAmount != 27000 || p.Total != 63000 {
		t.Fatalf("unexpected pricing: %+v", p)
	}
}

func TestPriceSeasonPassSixtyPercentOff(t *testing.T) {
	// The example from the brief, read as "percent off": 3000 x 30 days, 60% off,
	// leaves 40% to pay.
	prices := make([]int, 30)
	for i := range prices {
		prices[i] = 3000
	}
	p := PriceSeasonPass(prices, 1, 60)
	if p.Total != 36000 || p.GamePassAmount != 54000 {
		t.Fatalf("60%% off 90,000 should cost 36,000, got %+v", p)
	}
}

func TestPriceSeasonPassMultipliesByQuantityAndRounds(t *testing.T) {
	p := PriceSeasonPass([]int{3333, 3333}, 3, 7.5) // 19,998 x 7.5% = 1499.85 -> 1500
	if p.Subtotal != 19998 || p.GamePassAmount != 1500 || p.Total != 18498 {
		t.Fatalf("unexpected pricing: %+v", p)
	}
}

func TestPriceSeasonPassEdges(t *testing.T) {
	if p := PriceSeasonPass([]int{3000, 3000}, 1, 0); p.Total != 6000 || p.GamePassAmount != 0 {
		t.Errorf("0%% off should charge full price, got %+v", p)
	}
	if p := PriceSeasonPass([]int{3000, 3000}, 1, 100); p.Total != 0 {
		t.Errorf("100%% off should be free, got %+v", p)
	}
	if p := PriceSeasonPass(nil, 1, 50); p.Total != 0 {
		t.Errorf("no days costs nothing, got %+v", p)
	}
}

// ─── What a pass covers ───────────────────────────────────────────────────────

type fakeSeasonRepo struct {
	ports.SeasonPassRepository
	pass     *domain.SeasonPass
	existing bool
}

func (f *fakeSeasonRepo) GetByID(ctx context.Context, id string) (*domain.SeasonPass, error) {
	if f.pass == nil || f.pass.ID != id {
		return nil, fmt.Errorf("not found")
	}
	cp := *f.pass
	return &cp, nil
}
func (f *fakeSeasonRepo) GetByProduct(ctx context.Context, productID string) (*domain.SeasonPass, error) {
	if f.existing {
		return &domain.SeasonPass{ID: "existing"}, nil
	}
	return nil, fmt.Errorf("none")
}
func (f *fakeSeasonRepo) Create(ctx context.Context, p *domain.SeasonPass) error {
	p.ID = "new-pass"
	f.pass = p
	return nil
}
func (f *fakeSeasonRepo) List(ctx context.Context, activeOnly bool) ([]domain.SeasonPass, error) {
	if f.pass == nil {
		return nil, nil
	}
	return []domain.SeasonPass{*f.pass}, nil
}

type seasonProductRepo struct {
	ports.TicketProductRepository
	product *domain.TicketProduct
	days    []domain.TicketProductDay
}

func (f *seasonProductRepo) GetProduct(ctx context.Context, id string) (*domain.TicketProduct, error) {
	if f.product == nil || f.product.ID != id {
		return nil, fmt.Errorf("not found")
	}
	cp := *f.product
	return &cp, nil
}
func (f *seasonProductRepo) EnsureEventDays(ctx context.Context) error { return nil }
func (f *seasonProductRepo) ListProductDays(ctx context.Context, productID string) ([]domain.TicketProductDay, error) {
	return f.days, nil
}

func seasonDay(id, title string, offset, price, capacity, sold int) domain.TicketProductDay {
	date := todayLagos(time.Now()).AddDate(0, 0, offset)
	return domain.TicketProductDay{
		EventDayID: id, ProductID: testProduct, CompetitionID: "c1", CompetitionName: "Regular Season",
		Price: price, Capacity: capacity, SoldCount: sold,
		EventDay: &domain.EventDay{ID: id, Title: title, Date: date, IsActive: true},
	}
}

func newSeasonService(days []domain.TicketProductDay, percent float64) (*TicketService, *domain.SeasonPass) {
	pass := &domain.SeasonPass{ID: "pass-1", ProductID: testProduct, Name: "Regular Season Pass", PercentOff: percent, IsActive: true}
	return &TicketService{
		seasonRepo: &fakeSeasonRepo{pass: pass},
		productRepo: &seasonProductRepo{
			product: &domain.TicketProduct{ID: testProduct, Name: "Regular", IsActive: true, BasePrice: 3000,
				Competitions: []domain.TicketCompetition{{ID: "c1", Name: "Regular Season"}}},
			days: days,
		},
	}, pass
}

func TestSeasonOfferCoversOnlyDaysFromTodayOnwardsEarliestFirst(t *testing.T) {
	svc, pass := newSeasonService([]domain.TicketProductDay{
		seasonDay("gw19", "Game Week 19", 56, 3000, 0, 0), // keyed in first
		seasonDay("gw3", "Game Week 3", 14, 3000, 0, 0),
		seasonDay("gone", "Game Week 1", -7, 3000, 0, 0),
		seasonDay("today", "Game Week 2", 0, 3000, 0, 0),
	}, 30)

	offer, err := svc.buildSeasonOffer(context.Background(), pass, 1, "", false)
	if err != nil {
		t.Fatal(err)
	}
	var got []string
	for _, d := range offer.days {
		got = append(got, d.EventDay.Title)
	}
	want := "Game Week 2|Game Week 3|Game Week 19"
	if strings.Join(got, "|") != want {
		t.Fatalf("covered days = %v, want %s (today onwards, by date played)", got, want)
	}

	res := svc.seasonPassResponse(offer, 1)
	// 3 days x 3000 = 9000, 30% off = 2700.
	if res.DaysRemaining != 3 || res.FullPrice != 9000 || res.DiscountAmount != 2700 || res.Price != 6300 || !res.Available {
		t.Fatalf("unexpected quote: %+v", res)
	}
}

func TestSeasonPriceFallsAsTheSeasonGoesOn(t *testing.T) {
	// The same pass, a week later: one fewer match day left, so a lower price.
	svc, pass := newSeasonService([]domain.TicketProductDay{
		seasonDay("a", "A", 0, 3000, 0, 0),
		seasonDay("b", "B", 7, 3000, 0, 0),
		seasonDay("c", "C", 14, 3000, 0, 0),
	}, 50)
	before, _ := svc.buildSeasonOffer(context.Background(), pass, 1, "", false)

	// "A week later": the first day has now been played.
	svc.productRepo.(*seasonProductRepo).days[0] = seasonDay("a", "A", -1, 3000, 0, 0)
	after, _ := svc.buildSeasonOffer(context.Background(), pass, 1, "", false)

	p1 := svc.seasonPassResponse(before, 1).Price
	p2 := svc.seasonPassResponse(after, 1).Price
	if p1 != 4500 || p2 != 3000 {
		t.Fatalf("price should drop from 4500 to 3000 as a day passes, got %d then %d", p1, p2)
	}
}

func TestSeasonOfferLeavesOutSoldOutDaysInsteadOfBlockingEveryone(t *testing.T) {
	svc, pass := newSeasonService([]domain.TicketProductDay{
		seasonDay("a", "A", 7, 3000, 0, 0),
		seasonDay("full", "Full", 14, 3000, 10, 10), // no seats left
		seasonDay("few", "Few", 21, 3000, 10, 9),    // one seat: fine for 1, not for 2
	}, 0)

	one, _ := svc.buildSeasonOffer(context.Background(), pass, 1, "", false)
	if len(one.days) != 2 || len(one.skipped) != 1 || one.skipped[0].EventDay.Title != "Full" {
		t.Fatalf("for one pass: covered=%d skipped=%d", len(one.days), len(one.skipped))
	}
	two, _ := svc.buildSeasonOffer(context.Background(), pass, 2, "", false)
	if len(two.days) != 1 || len(two.skipped) != 2 {
		t.Fatalf("for two passes the thinner day drops out too: covered=%d skipped=%d", len(two.days), len(two.skipped))
	}
	// A skipped day is not charged for.
	if res := svc.seasonPassResponse(two, 2); res.FullPrice != 6000 || len(res.SkippedDays) != 2 {
		t.Fatalf("only the covered day should be priced, got %+v", res)
	}
}

func TestSeasonOfferRespectsTheTicketBeingOnSaleAndHidden(t *testing.T) {
	svc, pass := newSeasonService([]domain.TicketProductDay{seasonDay("a", "A", 7, 3000, 0, 0)}, 10)
	repo := svc.productRepo.(*seasonProductRepo)
	ctx := context.Background()

	pass.IsActive = false
	if _, err := svc.buildSeasonOffer(ctx, pass, 1, "", false); err == nil {
		t.Error("an inactive pass should not be sold")
	}
	if _, err := svc.buildSeasonOffer(ctx, pass, 1, "", true); err != nil {
		t.Error("an admin can still preview an inactive pass")
	}
	pass.IsActive = true

	repo.product.IsActive = false
	if _, err := svc.buildSeasonOffer(ctx, pass, 1, "", false); err == nil {
		t.Error("a pass on a ticket that is off sale should not be sold")
	}
	repo.product.IsActive = true

	code := "SECRET"
	repo.product.IsHidden, repo.product.AccessCode = true, &code
	if _, err := svc.buildSeasonOffer(ctx, pass, 1, "", false); err == nil {
		t.Error("a pass on a hidden ticket needs the access code")
	}
	if _, err := svc.buildSeasonOffer(ctx, pass, 1, " secret ", false); err != nil {
		t.Errorf("the right code should unlock it: %v", err)
	}
}

func TestListSeasonPassesOmitsAPassWithNoDaysLeft(t *testing.T) {
	svc, _ := newSeasonService([]domain.TicketProductDay{seasonDay("gone", "Gone", -3, 3000, 0, 0)}, 20)
	got, err := svc.ListSeasonPasses(context.Background(), 1, "")
	if err != nil || len(got) != 0 {
		t.Fatalf("a finished season has nothing to sell, got %d err=%v", len(got), err)
	}
}

func TestQuantityIsClamped(t *testing.T) {
	svc := &TicketService{}
	if svc.quantityOrOne(0) != 1 || svc.quantityOrOne(-4) != 1 || svc.quantityOrOne(99) != 10 || svc.quantityOrOne(3) != 3 {
		t.Fatal("quantity should stay between 1 and 10")
	}
}

// ─── Setting a pass up ────────────────────────────────────────────────────────

func TestCreateSeasonPassNeedsALinkedTournamentAndOnlyOnePerTicket(t *testing.T) {
	ctx := context.Background()
	svc, _ := newSeasonService(nil, 0)
	svc.seasonRepo = &fakeSeasonRepo{}

	// No tournaments linked.
	svc.productRepo.(*seasonProductRepo).product.Competitions = nil
	if _, err := svc.CreateSeasonPass(ctx, dto.CreateSeasonPassRequest{ProductID: testProduct, PercentOff: 20}); err == nil || !strings.Contains(err.Error(), "tournament") {
		t.Fatalf("a ticket with no tournament cannot have a season pass, got %v", err)
	}

	// Already has one.
	svc.productRepo.(*seasonProductRepo).product.Competitions = []domain.TicketCompetition{{ID: "c1", Name: "Season"}}
	svc.seasonRepo = &fakeSeasonRepo{existing: true}
	if _, err := svc.CreateSeasonPass(ctx, dto.CreateSeasonPassRequest{ProductID: testProduct, PercentOff: 20}); err == nil || !strings.Contains(err.Error(), "already has a season pass") {
		t.Fatalf("one pass per ticket, got %v", err)
	}
}

func TestCreateSeasonPassDefaultsItsName(t *testing.T) {
	svc, _ := newSeasonService([]domain.TicketProductDay{seasonDay("a", "A", 7, 3000, 0, 0)}, 0)
	repo := &fakeSeasonRepo{}
	svc.seasonRepo = repo

	if _, err := svc.CreateSeasonPass(context.Background(), dto.CreateSeasonPassRequest{ProductID: testProduct, PercentOff: 25}); err != nil {
		t.Fatal(err)
	}
	if repo.pass == nil || repo.pass.Name != "Regular Season Pass" || repo.pass.PercentOff != 25 || !repo.pass.IsActive {
		t.Fatalf("unexpected pass created: %+v", repo.pass)
	}
}
