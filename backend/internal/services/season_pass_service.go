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
