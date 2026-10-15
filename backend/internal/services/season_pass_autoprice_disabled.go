package services

// DISABLED: automatic season pass pricing.
//
// A first version of the Season Pass was made from a ticket and priced itself: every
// match day still to be played in the ticket's linked competitions, times the
// ticket's price per day, less a percentage. For now a Season Pass is a standalone
// pass whose price an admin types, and none of this is used.
//
// It is kept here as comments so it is not lost. To bring it back, restore the
// `product_id` link on season_passes (the column still exists, unused), uncomment
// the blocks below, and add the percent_off and quote fields back to the DTOs. The
// same code is also in git history on the branch feat/ticket-products-by-competition
// (commit f81f3b6).

/*
=== PriceSeasonPass (was in ticket_pricing.go) ===

// PriceSeasonPass prices a season pass: every covered day at the ticket's price,
// less the pass's own percentage. The Game Pass ladder does not apply on top; the
// season pass's percentage is the whole discount. Rounded to whole naira (half
// up) like the ladder.
func PriceSeasonPass(dayPrices []int, quantity int, percentOff float64) TicketPricing {
	unit := 0
	for _, p := range dayPrices {
		unit += p
	}
	p := TicketPricing{UnitPrice: unit, Subtotal: unit * quantity, GamePassPercent: percentOff}
	p.GamePassAmount = int(math.Round(float64(p.Subtotal) * percentOff / 100))
	p.Total = p.Subtotal - p.GamePassAmount
	if p.Total < 0 {
		p.Total = 0
	}
	return p
}


=== season_pass_service.go ===

package services

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
)

// maxSeasonDays bounds how many match days one season pass can cover, so a pass
// cannot lock an unbounded number of seat rows in one transaction. It is far above
// a real season; a Game Pass stays capped at maxPassDays.
const maxSeasonDays = 150

// seasonOffer is a season pass worked out for a number of passes at this moment:
// which remaining match days it covers, which are left out, and what it costs.
type seasonOffer struct {
	pass    *domain.SeasonPass
	product *domain.TicketProduct
	// days are covered and in date order; skipped are remaining days with fewer
	// seats than the quantity asked for.
	days    []domain.TicketProductDay
	skipped []domain.TicketProductDay
}

func (o *seasonOffer) prices() []int {
	prices := make([]int, len(o.days))
	for i, d := range o.days {
		prices[i] = d.Price
	}
	return prices
}

// buildSeasonOffer works out a season pass for `quantity` passes. It covers every
// match day still to be played (today onwards) in the ticket's linked competitions,
// so its price falls as the season goes on.
//
// A remaining day without seats for the whole quantity is left out and reported,
// not charged for: one sold-out day must not make the whole season unbuyable.
//
// adminView skips the hidden-ticket access code and lets an inactive pass be
// previewed, which a person setting the pass up needs.
func (s *TicketService) buildSeasonOffer(ctx context.Context, pass *domain.SeasonPass, quantity int, accessCode string, adminView bool) (*seasonOffer, error) {
	if !adminView && !pass.IsActive {
		return nil, fmt.Errorf("season pass not found")
	}
	product, err := s.productRepo.GetProduct(ctx, pass.ProductID)
	if err != nil {
		return nil, fmt.Errorf("season pass not found")
	}
	if !adminView {
		if !product.IsActive {
			return nil, fmt.Errorf("%s is not on sale", pass.Name)
		}
		if product.IsHidden && !accessCodeMatches(product.AccessCode, accessCode) {
			return nil, fmt.Errorf("season pass not found")
		}
	}

	// A competition may have fixtures added since the ticket was set up.
	if err := s.productRepo.EnsureEventDays(ctx); err != nil {
		fmt.Printf("⚠️ WARNING: failed to prepare match days: %s\n", err.Error())
	}
	all, err := s.productRepo.ListProductDays(ctx, product.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to load match days: %w", err)
	}

	today := todayLagos(time.Now())
	offer := &seasonOffer{pass: pass, product: product}
	for _, d := range all {
		if d.EventDay == nil || !d.EventDay.IsActive || dateOnly(d.EventDay.Date).Before(today) {
			continue
		}
		if avail := d.Available(); avail >= 0 && avail < quantity {
			offer.skipped = append(offer.skipped, d)
			continue
		}
		offer.days = append(offer.days, d)
	}
	sortGameDays(offer.days)
	sortGameDays(offer.skipped)
	return offer, nil
}

func seasonDayResponse(d domain.TicketProductDay) dto.SeasonPassDayResponse {
	r := dto.SeasonPassDayResponse{
		EventDayID:      d.EventDayID,
		CompetitionID:   d.CompetitionID,
		CompetitionName: d.CompetitionName,
		Price:           d.Price,
		Available:       d.Available(),
	}
	if d.EventDay != nil {
		r.EventTitle = d.EventDay.Title
		r.EventDate = d.EventDay.Date.Format("2006-01-02")
		r.EventVenue = d.EventDay.Venue
	}
	return r
}

func (s *TicketService) seasonPassResponse(o *seasonOffer, quantity int) *dto.SeasonPassResponse {
	pricing := PriceSeasonPass(o.prices(), quantity, o.pass.PercentOff)
	res := &dto.SeasonPassResponse{
		ID:                 o.pass.ID,
		ProductID:          o.product.ID,
		ProductName:        o.product.Name,
		Name:               o.pass.Name,
		Description:        o.pass.Description,
		PercentOff:         o.pass.PercentOff,
		IsActive:           o.pass.IsActive,
		ProductDescription: o.product.Description,
		PricePerDay:        o.product.BasePrice,
		Competitions:       []dto.TicketCompetitionResponse{},
		Quantity:           quantity,
		MatchDays:          []dto.SeasonPassDayResponse{},
		SkippedDays:        []dto.SeasonPassDayResponse{},
		DaysRemaining:      len(o.days),
		FullPrice:          pricing.Subtotal,
		DiscountAmount:     pricing.GamePassAmount,
		Price:              pricing.Total,
		Available:          len(o.days) > 0,
	}
	for _, c := range o.product.Competitions {
		res.Competitions = append(res.Competitions, dto.TicketCompetitionResponse{ID: c.ID, Name: c.Name})
	}
	for _, d := range o.days {
		res.MatchDays = append(res.MatchDays, seasonDayResponse(d))
	}
	for _, d := range o.skipped {
		res.SkippedDays = append(res.SkippedDays, seasonDayResponse(d))
	}
	return res
}

func (s *TicketService) quantityOrOne(q int) int {
	if q < 1 {
		return 1
	}
	if q > 10 {
		return 10
	}
	return q
}

// ListSeasonPasses is what the storefront offers: active passes that still have
// match days to sell, priced for `quantity` passes. A pass made from a hidden
// ticket appears only to someone holding its access code.
func (s *TicketService) ListSeasonPasses(ctx context.Context, quantity int, accessCode string) ([]dto.SeasonPassResponse, error) {
	quantity = s.quantityOrOne(quantity)
	passes, err := s.seasonRepo.List(ctx, true)
	if err != nil {
		return nil, err
	}
	out := make([]dto.SeasonPassResponse, 0, len(passes))
	for i := range passes {
		offer, err := s.buildSeasonOffer(ctx, &passes[i], quantity, accessCode, false)
		if err != nil || len(offer.days) == 0 {
			continue // hidden, off sale, or nothing left to buy
		}
		out = append(out, *s.seasonPassResponse(offer, quantity))
	}
	return out, nil
}

// GetSeasonPass is one pass with its match days and price, for a pass page.
func (s *TicketService) GetSeasonPass(ctx context.Context, id string, quantity int, accessCode string) (*dto.SeasonPassResponse, error) {
	quantity = s.quantityOrOne(quantity)
	pass, err := s.seasonRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("season pass not found")
	}
	offer, err := s.buildSeasonOffer(ctx, pass, quantity, accessCode, false)
	if err != nil {
		return nil, err
	}
	return s.seasonPassResponse(offer, quantity), nil
}

// ListSeasonPassesAdmin lists every pass, off sale ones included, each previewed
// for one pass as it would be sold today.
func (s *TicketService) ListSeasonPassesAdmin(ctx context.Context) ([]dto.SeasonPassResponse, error) {
	passes, err := s.seasonRepo.List(ctx, false)
	if err != nil {
		return nil, err
	}
	out := make([]dto.SeasonPassResponse, 0, len(passes))
	for i := range passes {
		offer, err := s.buildSeasonOffer(ctx, &passes[i], 1, "", true)
		if err != nil {
			continue
		}
		out = append(out, *s.seasonPassResponse(offer, 1))
	}
	return out, nil
}

func (s *TicketService) adminSeasonPass(ctx context.Context, id string) (*dto.SeasonPassResponse, error) {
	pass, err := s.seasonRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("season pass not found")
	}
	offer, err := s.buildSeasonOffer(ctx, pass, 1, "", true)
	if err != nil {
		return nil, err
	}
	return s.seasonPassResponse(offer, 1), nil
}

func (s *TicketService) CreateSeasonPass(ctx context.Context, req dto.CreateSeasonPassRequest) (*dto.SeasonPassResponse, error) {
	product, err := s.productRepo.GetProduct(ctx, req.ProductID)
	if err != nil {
		return nil, fmt.Errorf("ticket not found")
	}
	if len(product.Competitions) == 0 {
		return nil, fmt.Errorf("link %s to at least one tournament first: a season pass covers the match days of its tournaments", product.Name)
	}
	if _, err := s.seasonRepo.GetByProduct(ctx, product.ID); err == nil {
		return nil, fmt.Errorf("%s already has a season pass. Edit that one instead", product.Name)
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = product.Name + " Season Pass"
	}
	pass := &domain.SeasonPass{
		ProductID:   product.ID,
		Name:        name,
		Description: req.Description,
		PercentOff:  req.PercentOff,
		IsActive:    true,
	}
	if req.IsActive != nil {
		pass.IsActive = *req.IsActive
	}
	if err := s.seasonRepo.Create(ctx, pass); err != nil {
		return nil, fmt.Errorf("failed to create season pass: %w", err)
	}
	return s.adminSeasonPass(ctx, pass.ID)
}

func (s *TicketService) UpdateSeasonPass(ctx context.Context, id string, req dto.UpdateSeasonPassRequest) (*dto.SeasonPassResponse, error) {
	pass, err := s.seasonRepo.GetByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("season pass not found")
	}
	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if name == "" {
			return nil, fmt.Errorf("name cannot be empty")
		}
		pass.Name = name
	}
	if req.Description != nil {
		pass.Description = *req.Description
	}
	if req.PercentOff != nil {
		pass.PercentOff = *req.PercentOff
	}
	if req.IsActive != nil {
		pass.IsActive = *req.IsActive
	}
	if err := s.seasonRepo.Update(ctx, pass); err != nil {
		return nil, fmt.Errorf("failed to update season pass: %w", err)
	}
	return s.adminSeasonPass(ctx, id)
}

func (s *TicketService) DeleteSeasonPass(ctx context.Context, id string) error {
	return s.seasonRepo.Delete(ctx, id)
}

// PurchaseSeasonPass sells a season pass: one ticket covering every match day
// still to be played, priced from those days now. The buyer never sends a day or
// an amount; both are decided here.
func (s *TicketService) PurchaseSeasonPass(ctx context.Context, req dto.PurchaseSeasonPassRequest, callbackURL string, userID *string) (*dto.TicketResponse, error) {
	pass, err := s.seasonRepo.GetByID(ctx, req.SeasonPassID)
	if err != nil {
		return nil, fmt.Errorf("season pass not found")
	}
	offer, err := s.buildSeasonOffer(ctx, pass, req.Quantity, req.AccessCode, false)
	if err != nil {
		return nil, err
	}
	if len(offer.days) == 0 {
		return nil, fmt.Errorf("there are no match days left on %s", pass.Name)
	}
	if len(offer.days) > maxSeasonDays {
		return nil, fmt.Errorf("a season pass can cover at most %d match days", maxSeasonDays)
	}

	// Give every covered day its seat-lock row; Create then reserves them all or none.
	ids := make([]string, len(offer.days))
	for i, d := range offer.days {
		ids[i] = d.EventDayID
	}
	locked, err := s.productRepo.ResolveProductDays(ctx, offer.product.ID, ids)
	if err != nil {
		return nil, fmt.Errorf("failed to load match days: %w", err)
	}
	if len(locked) != len(ids) {
		return nil, fmt.Errorf("the match days changed while you were buying. Please try again")
	}
	sort.SliceStable(locked, func(i, j int) bool { return locked[i].EventDay.Date.Before(locked[j].EventDay.Date) })

	passID := pass.ID
	return s.checkout(ctx, checkoutInput{
		sel:          &selection{product: offer.product, days: locked},
		pricing:      PriceSeasonPass(offer.prices(), req.Quantity, pass.PercentOff),
		purchaseType: domain.PurchaseTypeSeasonPass,
		seasonPassID: &passID,
		productName:  pass.Name,
		email:        req.Email,
		name:         req.Name,
		phone:        req.Phone,
		quantity:     req.Quantity,
		referralCode: req.ReferralCode,
		callbackURL:  callbackURL,
		userID:       userID,
	})
}

=== season_pass_service_test.go ===

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

*/
