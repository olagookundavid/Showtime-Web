package services

import (
	"context"
	"fmt"
	"strings"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
)

// A Season Pass is a standalone pass: a name, a price an admin types, and an end
// date. Whoever holds its code is let in at every match day up to and including
// that date. It is not made from a ticket, takes no seats, and its price is not
// worked out. (The earlier automatic pricing is kept, disabled, in
// season_pass_autoprice_disabled.go.)

// seasonPassEndsOn parses an end date (YYYY-MM-DD).
func seasonPassEndsOn(s string) (time.Time, error) {
	d, err := time.Parse("2006-01-02", strings.TrimSpace(s))
	if err != nil {
		return time.Time{}, fmt.Errorf("the end date must be a date like 2027-05-31")
	}
	return d, nil
}

// seasonPassPricing is what `quantity` passes cost: the price an admin set, times
// the quantity. No discount applies.
func seasonPassPricing(p *domain.SeasonPass, quantity int) TicketPricing {
	total := p.Price * quantity
	return TicketPricing{UnitPrice: p.Price, Subtotal: total, Total: total}
}

// seasonPassExpired reports whether a pass has ended: its end date is before
// today, in Lagos. The end date itself is still a valid day.
func seasonPassExpired(p *domain.SeasonPass, now time.Time) bool {
	return dateOnly(p.EndsOn).Before(todayLagos(now))
}

func seasonPassResponse(p *domain.SeasonPass) *dto.SeasonPassResponse {
	return &dto.SeasonPassResponse{
		ID:          p.ID,
		Name:        p.Name,
		Description: p.Description,
		Price:       p.Price,
		EndsOn:      p.EndsOn.Format("2006-01-02"),
		IsActive:    p.IsActive,
		Expired:     seasonPassExpired(p, time.Now()),
	}
}

// ListSeasonPasses is what the storefront offers: active passes that have not ended.
func (s *TicketService) ListSeasonPasses(ctx context.Context) ([]dto.SeasonPassResponse, error) {
	passes, err := s.seasonRepo.List(ctx, true)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	out := make([]dto.SeasonPassResponse, 0, len(passes))
	for i := range passes {
		if seasonPassExpired(&passes[i], now) {
			continue
		}
		out = append(out, *seasonPassResponse(&passes[i]))
	}
	return out, nil
}

// GetSeasonPass is one pass for sale. An ended or switched-off pass is "not found".
func (s *TicketService) GetSeasonPass(ctx context.Context, id string) (*dto.SeasonPassResponse, error) {
	pass, err := s.seasonRepo.GetByID(ctx, id)
	if err != nil || !pass.IsActive || seasonPassExpired(pass, time.Now()) {
		return nil, fmt.Errorf("season pass not found")
	}
	return seasonPassResponse(pass), nil
}

// ListSeasonPassesAdmin lists every pass, switched-off and ended ones included.
func (s *TicketService) ListSeasonPassesAdmin(ctx context.Context) ([]dto.SeasonPassResponse, error) {
	passes, err := s.seasonRepo.List(ctx, false)
	if err != nil {
		return nil, err
	}
	out := make([]dto.SeasonPassResponse, 0, len(passes))
	for i := range passes {
		out = append(out, *seasonPassResponse(&passes[i]))
	}
	return out, nil
}

func (s *TicketService) CreateSeasonPass(ctx context.Context, req dto.CreateSeasonPassRequest) (*dto.SeasonPassResponse, error) {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, fmt.Errorf("name is required")
	}
	endsOn, err := seasonPassEndsOn(req.EndsOn)
	if err != nil {
		return nil, err
	}
	pass := &domain.SeasonPass{
		Name:        name,
		Description: req.Description,
		Price:       req.Price,
		EndsOn:      endsOn,
		IsActive:    true,
	}
	if req.IsActive != nil {
		pass.IsActive = *req.IsActive
	}
	if err := s.seasonRepo.Create(ctx, pass); err != nil {
		return nil, fmt.Errorf("failed to create season pass: %w", err)
	}
	return seasonPassResponse(pass), nil
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
	if req.Price != nil {
		pass.Price = *req.Price
	}
	if req.EndsOn != nil {
		endsOn, err := seasonPassEndsOn(*req.EndsOn)
		if err != nil {
			return nil, err
		}
		pass.EndsOn = endsOn
	}
	if req.IsActive != nil {
		pass.IsActive = *req.IsActive
	}
	if err := s.seasonRepo.Update(ctx, pass); err != nil {
		return nil, fmt.Errorf("failed to update season pass: %w", err)
	}
	return seasonPassResponse(pass), nil
}

func (s *TicketService) DeleteSeasonPass(ctx context.Context, id string) error {
	return s.seasonRepo.Delete(ctx, id)
}

// PurchaseSeasonPass sells a season pass. The price and the end date come from the
// pass; the buyer sends neither. It becomes one ticket with no match days, so it
// takes no seats and sends no per-day reminders.
func (s *TicketService) PurchaseSeasonPass(ctx context.Context, req dto.PurchaseSeasonPassRequest, callbackURL string, userID *string) (*dto.TicketResponse, error) {
	pass, err := s.seasonRepo.GetByID(ctx, req.SeasonPassID)
	if err != nil || !pass.IsActive {
		return nil, fmt.Errorf("season pass not found")
	}
	if seasonPassExpired(pass, time.Now()) {
		return nil, fmt.Errorf("%s ended on %s and can no longer be bought", pass.Name, pass.EndsOn.Format("2 Jan 2006"))
	}

	passID := pass.ID
	return s.checkout(ctx, checkoutInput{
		pricing:      seasonPassPricing(pass, req.Quantity),
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
