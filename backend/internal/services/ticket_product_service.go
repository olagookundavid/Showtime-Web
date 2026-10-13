package services

import (
	"context"
	"fmt"
	"strings"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
)

func normalizeAccessCode(code *string) *string {
	if code == nil {
		return nil
	}
	c := strings.ToUpper(strings.TrimSpace(*code))
	if c == "" {
		return nil
	}
	return &c
}

func productToResponse(p *domain.TicketProduct, includeSecrets bool) *dto.TicketProductResponse {
	res := &dto.TicketProductResponse{
		ID:            p.ID,
		Name:          p.Name,
		Slug:          p.Slug,
		Description:   p.Description,
		BasePrice:     p.BasePrice,
		IsHidden:      p.IsHidden,
		IsActive:      p.IsActive,
		AllowGamePass: p.AllowGamePass,
		SortOrder:     p.SortOrder,
		Days:          []dto.TicketProductDayResponse{},
	}
	// The access code is what unlocks a hidden product, so it only goes to admins.
	if includeSecrets {
		res.AccessCode = p.AccessCode
	}
	for _, d := range p.Days {
		res.Days = append(res.Days, productDayToResponse(d))
	}
	return res
}

func productDayToResponse(d domain.TicketProductDay) dto.TicketProductDayResponse {
	r := dto.TicketProductDayResponse{
		ID:            d.ID,
		ProductID:     d.ProductID,
		EventDayID:    d.EventDayID,
		Price:         d.Price,
		PriceOverride: d.PriceOverride,
		Capacity:      d.Capacity,
		SoldCount:     d.SoldCount,
		HeldCount:     d.HeldCount,
		Available:     d.Available(),
		IsActive:      d.IsActive,
	}
	if d.EventDay != nil {
		r.EventTitle = d.EventDay.Title
		r.EventDate = d.EventDay.Date.Format("2006-01-02")
		r.EventVenue = d.EventDay.Venue
	}
	return r
}

func (s *TicketService) CreateProduct(ctx context.Context, req dto.CreateTicketProductRequest) (*dto.TicketProductResponse, error) {
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return nil, fmt.Errorf("name is required")
	}
	p := &domain.TicketProduct{
		Name:          name,
		Description:   req.Description,
		BasePrice:     req.BasePrice,
		IsHidden:      req.IsHidden,
		IsActive:      true,
		AllowGamePass: true,
		SortOrder:     req.SortOrder,
	}
	if req.IsActive != nil {
		p.IsActive = *req.IsActive
	}
	if req.AllowGamePass != nil {
		p.AllowGamePass = *req.AllowGamePass
	}
	if p.IsHidden {
		p.AccessCode = normalizeAccessCode(req.AccessCode)
	}

	base := slugify(name)
	var err error
	for i := 0; i < 6; i++ {
		p.Slug = base
		if i > 0 {
			p.Slug = fmt.Sprintf("%s-%d", base, i+1)
		}
		if err = s.productRepo.CreateProduct(ctx, p); err == nil {
			return productToResponse(p, true), nil
		}
		if strings.Contains(err.Error(), "idx_ticket_products_name") {
			return nil, fmt.Errorf("a ticket called %q already exists", name)
		}
		if !strings.Contains(err.Error(), "ticket_products_slug_key") {
			break
		}
	}
	return nil, fmt.Errorf("failed to create ticket: %w", err)
}

func (s *TicketService) UpdateProduct(ctx context.Context, id string, req dto.UpdateTicketProductRequest) (*dto.TicketProductResponse, error) {
	p, err := s.productRepo.GetProduct(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("ticket not found: %w", err)
	}

	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if name == "" {
			return nil, fmt.Errorf("name cannot be empty")
		}
		p.Name = name
	}
	if req.Description != nil {
		p.Description = *req.Description
	}
	if req.BasePrice != nil {
		p.BasePrice = *req.BasePrice
	}
	if req.IsHidden != nil {
		p.IsHidden = *req.IsHidden
	}
	if req.AccessCode != nil {
		p.AccessCode = normalizeAccessCode(req.AccessCode)
	}
	// A visible product has no use for an access code.
	if !p.IsHidden {
		p.AccessCode = nil
	}
	if req.IsActive != nil {
		p.IsActive = *req.IsActive
	}
	if req.AllowGamePass != nil {
		p.AllowGamePass = *req.AllowGamePass
	}
	if req.SortOrder != nil {
		p.SortOrder = *req.SortOrder
	}

	if err := s.productRepo.UpdateProduct(ctx, p); err != nil {
		if strings.Contains(err.Error(), "idx_ticket_products_name") {
			return nil, fmt.Errorf("a ticket called %q already exists", p.Name)
		}
		return nil, fmt.Errorf("failed to update ticket: %w", err)
	}
	return s.productWithDays(ctx, id)
}

func (s *TicketService) DeleteProduct(ctx context.Context, id string) error {
	return s.productRepo.DeleteProduct(ctx, id)
}

// productWithDays reloads one product with its days, for responses after a write.
func (s *TicketService) productWithDays(ctx context.Context, id string) (*dto.TicketProductResponse, error) {
	products, err := s.productRepo.ListProducts(ctx, false)
	if err != nil {
		return nil, err
	}
	for i := range products {
		if products[i].ID == id {
			return productToResponse(&products[i], true), nil
		}
	}
	return nil, fmt.Errorf("ticket not found")
}

func (s *TicketService) ListProductsAdmin(ctx context.Context) ([]dto.TicketProductResponse, error) {
	products, err := s.productRepo.ListProducts(ctx, false)
	if err != nil {
		return nil, err
	}
	out := make([]dto.TicketProductResponse, 0, len(products))
	for i := range products {
		out = append(out, *productToResponse(&products[i], true))
	}
	return out, nil
}

func (s *TicketService) SaveProductDay(ctx context.Context, productID string, req dto.SaveProductDayRequest) (*dto.TicketProductResponse, error) {
	if _, err := s.productRepo.GetProduct(ctx, productID); err != nil {
		return nil, fmt.Errorf("ticket not found: %w", err)
	}
	if _, err := s.eventDayRepo.GetByID(ctx, req.EventDayID); err != nil {
		return nil, fmt.Errorf("match day not found: %w", err)
	}
	d := &domain.TicketProductDay{
		ProductID:     productID,
		EventDayID:    req.EventDayID,
		PriceOverride: req.PriceOverride,
		Capacity:      req.Capacity,
		IsActive:      true,
	}
	if req.IsActive != nil {
		d.IsActive = *req.IsActive
	}
	if err := s.productRepo.SaveProductDay(ctx, d); err != nil {
		return nil, err
	}
	return s.productWithDays(ctx, productID)
}

func (s *TicketService) DeleteProductDay(ctx context.Context, productID, eventDayID string) error {
	return s.productRepo.DeleteProductDay(ctx, productID, eventDayID)
}

// ListPublicProducts is what the storefront sells: active products with the
// upcoming, active days they are on sale for. A hidden product appears only to
// someone holding its access code.
func (s *TicketService) ListPublicProducts(ctx context.Context, accessCode string) ([]dto.TicketProductResponse, error) {
	products, err := s.productRepo.ListProducts(ctx, true)
	if err != nil {
		return nil, err
	}

	today := todayLagos(time.Now())
	out := make([]dto.TicketProductResponse, 0, len(products))
	for i := range products {
		p := &products[i]
		if p.IsHidden && !accessCodeMatches(p.AccessCode, accessCode) {
			continue
		}
		sellable := p.Days[:0:0]
		for _, d := range p.Days {
			if !d.IsActive || d.EventDay == nil || !d.EventDay.IsActive {
				continue
			}
			if dateOnly(d.EventDay.Date).Before(today) {
				continue
			}
			sellable = append(sellable, d)
		}
		if len(sellable) == 0 {
			continue // nothing to buy yet
		}
		p.Days = sellable
		out = append(out, *productToResponse(p, false))
	}
	return out, nil
}

func (s *TicketService) GetGamePassRules(ctx context.Context) ([]dto.GamePassRuleResponse, error) {
	rules, err := s.productRepo.ListGamePassRules(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]dto.GamePassRuleResponse, 0, len(rules))
	for _, r := range rules {
		out = append(out, dto.GamePassRuleResponse{MinDays: r.MinDays, PercentOff: r.PercentOff, IsActive: r.IsActive})
	}
	return out, nil
}

func (s *TicketService) SaveGamePassRules(ctx context.Context, req dto.SaveGamePassRulesRequest) ([]dto.GamePassRuleResponse, error) {
	seen := map[int]bool{}
	rules := make([]domain.GamePassRule, 0, len(req.Rules))
	for _, r := range req.Rules {
		if seen[r.MinDays] {
			return nil, fmt.Errorf("there are two rules for %d days", r.MinDays)
		}
		seen[r.MinDays] = true
		active := true
		if r.IsActive != nil {
			active = *r.IsActive
		}
		rules = append(rules, domain.GamePassRule{MinDays: r.MinDays, PercentOff: r.PercentOff, IsActive: active})
	}
	if err := s.productRepo.ReplaceGamePassRules(ctx, rules); err != nil {
		return nil, err
	}
	return s.GetGamePassRules(ctx)
}
