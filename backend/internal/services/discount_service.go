package services

import (
	"context"
	"fmt"
	"math"
	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	appErrors "showtime-backend/internal/errors"
	"time"
)

// CartLine is one priced line a discount code is evaluated against. Both the
// storefront and the ticket flow reduce to this shape so the discount rules
// live in exactly one place.
type CartLine struct {
	EntityType string
	EntityID   string
	Name       string
	UnitPrice  float64
	Quantity   int
}

type IDiscountService interface {
	List(ctx context.Context) ([]dto.DiscountCodeResponse, error)
	Get(ctx context.Context, id string) (*dto.DiscountCodeResponse, error)
	Create(ctx context.Context, createdBy string, req dto.SaveDiscountCodeRequest) (*dto.DiscountCodeResponse, error)
	Update(ctx context.Context, id string, req dto.SaveDiscountCodeRequest) (*dto.DiscountCodeResponse, error)
	Delete(ctx context.Context, id string) error
	ListTargets(ctx context.Context) ([]dto.DiscountTargetOption, error)

	// ApplyToCart prices a cart against a code. It never mutates anything — the
	// hold on the code is taken later, by the purchase transaction.
	ApplyToCart(ctx context.Context, code string, isAuthenticated bool, lines []CartLine) (*domain.DiscountApplication, error)
	Preview(ctx context.Context, isAuthenticated bool, lines []CartLine, code string) *dto.DiscountPreviewResponse
}

type DiscountService struct {
	repo IDiscountRepositoryDep
}

// IDiscountRepositoryDep is the slice of the repository this service needs.
type IDiscountRepositoryDep interface {
	List(ctx context.Context) ([]domain.DiscountCode, error)
	GetByID(ctx context.Context, id string) (*domain.DiscountCode, error)
	GetByCode(ctx context.Context, code string) (*domain.DiscountCode, error)
	Create(ctx context.Context, dc *domain.DiscountCode) error
	Update(ctx context.Context, dc *domain.DiscountCode) error
	Delete(ctx context.Context, id string) error
	ListTargets(ctx context.Context) ([]domain.DiscountCodeItem, error)
}

func NewDiscountService(repo IDiscountRepositoryDep) IDiscountService {
	return &DiscountService{repo: repo}
}

// money rounds to whole kobo. Every discount total passes through here so a
// float subtraction can never leave a fraction of a kobo on an order that
// Paystack is later asked to match exactly.
func money(v float64) float64 {
	return math.Round(v*100) / 100
}

// ─── Admin ────────────────────────────────────────────────────────────────────

func (s *DiscountService) List(ctx context.Context) ([]dto.DiscountCodeResponse, error) {
	codes, err := s.repo.List(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]dto.DiscountCodeResponse, 0, len(codes))
	for i := range codes {
		out = append(out, mapDiscountToResponse(&codes[i]))
	}
	return out, nil
}

func (s *DiscountService) Get(ctx context.Context, id string) (*dto.DiscountCodeResponse, error) {
	dc, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if dc == nil {
		return nil, appErrors.ErrNotFound
	}
	res := mapDiscountToResponse(dc)
	return &res, nil
}

// buildFromRequest maps the admin payload onto the domain model, applying the
// defaults that keep a half-filled form from producing a surprising code.
func buildFromRequest(req dto.SaveDiscountCodeRequest) (*domain.DiscountCode, error) {
	code := domain.NormalizeCode(req.Code)
	if code == "" {
		return nil, fmt.Errorf("code is required")
	}
	if len(req.Items) == 0 {
		return nil, fmt.Errorf("add at least one product or ticket tier to this code")
	}

	audience := req.Audience
	if audience == "" {
		audience = domain.DiscountAudienceAll
	}
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	// An expiry already in the past would create a code that can never be
	// redeemed — almost certainly a typo in the date field.
	if req.ExpiresAt != nil && req.ExpiresAt.Before(time.Now()) {
		return nil, fmt.Errorf("expiry date is in the past")
	}

	items := make([]domain.DiscountCodeItem, 0, len(req.Items))
	seen := make(map[string]bool, len(req.Items))
	for _, it := range req.Items {
		key := it.EntityType + ":" + it.EntityID
		if seen[key] {
			return nil, fmt.Errorf("the same item was added twice to this code")
		}
		seen[key] = true
		if it.AmountOff <= 0 {
			return nil, fmt.Errorf("discount amount must be greater than zero")
		}
		items = append(items, domain.DiscountCodeItem{
			EntityType: it.EntityType,
			EntityID:   it.EntityID,
			AmountOff:  money(it.AmountOff),
		})
	}

	return &domain.DiscountCode{
		Code:        code,
		Description: req.Description,
		MaxUses:     req.MaxUses,
		ExpiresAt:   req.ExpiresAt,
		Audience:    audience,
		IsActive:    isActive,
		Items:       items,
	}, nil
}

func (s *DiscountService) Create(ctx context.Context, createdBy string, req dto.SaveDiscountCodeRequest) (*dto.DiscountCodeResponse, error) {
	dc, err := buildFromRequest(req)
	if err != nil {
		return nil, err
	}
	if createdBy != "" {
		dc.CreatedBy = &createdBy
	}
	if err := s.repo.Create(ctx, dc); err != nil {
		return nil, err
	}
	return s.Get(ctx, dc.ID)
}

func (s *DiscountService) Update(ctx context.Context, id string, req dto.SaveDiscountCodeRequest) (*dto.DiscountCodeResponse, error) {
	dc, err := buildFromRequest(req)
	if err != nil {
		return nil, err
	}
	dc.ID = id
	if err := s.repo.Update(ctx, dc); err != nil {
		return nil, err
	}
	return s.Get(ctx, id)
}

func (s *DiscountService) Delete(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}

func (s *DiscountService) ListTargets(ctx context.Context) ([]dto.DiscountTargetOption, error) {
	targets, err := s.repo.ListTargets(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]dto.DiscountTargetOption, 0, len(targets))
	for _, t := range targets {
		out = append(out, dto.DiscountTargetOption{
			EntityType: t.EntityType,
			EntityID:   t.EntityID,
			Name:       t.EntityName,
			Price:      t.EntityPrice,
		})
	}
	return out, nil
}

// ─── Redemption pricing ───────────────────────────────────────────────────────

// ApplyToCart validates a code against a buyer and a cart and returns what it
// would take off. The discount lands once per distinct product or tier in the
// cart — buying three of the same shirt discounts one of them — and is capped at
// the line's own subtotal so a generous code can never push a total negative.
func (s *DiscountService) ApplyToCart(ctx context.Context, code string, isAuthenticated bool, lines []CartLine) (*domain.DiscountApplication, error) {
	normalized := domain.NormalizeCode(code)
	if normalized == "" {
		return nil, appErrors.ErrDiscountNotFound
	}

	dc, err := s.repo.GetByCode(ctx, normalized)
	if err != nil {
		return nil, err
	}
	if dc == nil {
		return nil, appErrors.ErrDiscountNotFound
	}
	if !dc.IsActive {
		return nil, appErrors.ErrDiscountInactive
	}
	if dc.Expired(time.Now()) {
		return nil, appErrors.ErrDiscountExpired
	}
	if dc.Exhausted() {
		return nil, appErrors.ErrDiscountExhausted
	}
	if !dc.AllowsAudience(isAuthenticated) {
		if dc.Audience == domain.DiscountAudienceAuthenticated {
			return nil, appErrors.ErrDiscountMembersOnly
		}
		return nil, appErrors.ErrDiscountGuestsOnly
	}

	// Collapse the cart to one entry per distinct entity first. Two lines of the
	// same product (different sizes, say) are still one product as far as the
	// code is concerned, so it must not fire twice.
	type merged struct {
		name     string
		subtotal float64
		order    int
	}
	byEntity := map[string]*merged{}
	var originalAmount float64
	next := 0
	for _, l := range lines {
		lineTotal := l.UnitPrice * float64(l.Quantity)
		originalAmount += lineTotal

		key := l.EntityType + ":" + l.EntityID
		if m, ok := byEntity[key]; ok {
			m.subtotal += lineTotal
			continue
		}
		byEntity[key] = &merged{name: l.Name, subtotal: lineTotal, order: next}
		next++
	}

	applied := make([]domain.DiscountLine, next)
	var total float64
	matched := 0
	for _, l := range lines {
		key := l.EntityType + ":" + l.EntityID
		m, ok := byEntity[key]
		if !ok {
			continue // already consumed
		}
		amountOff, covered := dc.AmountOffFor(l.EntityType, l.EntityID)
		if !covered {
			delete(byEntity, key)
			continue
		}

		// Never take off more than the line is worth.
		if amountOff > m.subtotal {
			amountOff = m.subtotal
		}
		amountOff = money(amountOff)
		if amountOff <= 0 {
			delete(byEntity, key)
			continue
		}

		applied[m.order] = domain.DiscountLine{
			EntityType: l.EntityType,
			EntityID:   l.EntityID,
			Name:       m.name,
			AmountOff:  amountOff,
		}
		total += amountOff
		matched++
		delete(byEntity, key)
	}

	if matched == 0 {
		return nil, appErrors.ErrDiscountNotApplicable
	}

	// Compact away the gaps left by uncovered entities.
	out := make([]domain.DiscountLine, 0, matched)
	for _, l := range applied {
		if l.AmountOff > 0 {
			out = append(out, l)
		}
	}

	total = money(total)
	originalAmount = money(originalAmount)
	final := money(originalAmount - total)
	if final < 0 {
		final = 0
	}

	return &domain.DiscountApplication{
		Code:           dc.Code,
		CodeID:         dc.ID,
		Lines:          out,
		TotalDiscount:  total,
		OriginalAmount: originalAmount,
		FinalAmount:    final,
	}, nil
}

// Preview answers "what would this code do?" for the checkout screen. Rejections
// come back as a valid response with a reason rather than an error, because the
// buyer typing a wrong code is an expected outcome, not a failure.
func (s *DiscountService) Preview(ctx context.Context, isAuthenticated bool, lines []CartLine, code string) *dto.DiscountPreviewResponse {
	var original float64
	for _, l := range lines {
		original += l.UnitPrice * float64(l.Quantity)
	}
	original = money(original)

	app, err := s.ApplyToCart(ctx, code, isAuthenticated, lines)
	if err != nil {
		return &dto.DiscountPreviewResponse{
			Code:           domain.NormalizeCode(code),
			Valid:          false,
			Message:        err.Error(),
			Lines:          []dto.DiscountLineResponse{},
			OriginalAmount: original,
			DiscountAmount: 0,
			FinalAmount:    original,
		}
	}

	lineRes := make([]dto.DiscountLineResponse, 0, len(app.Lines))
	for _, l := range app.Lines {
		lineRes = append(lineRes, dto.DiscountLineResponse{
			EntityType: l.EntityType,
			EntityID:   l.EntityID,
			Name:       l.Name,
			AmountOff:  l.AmountOff,
		})
	}

	return &dto.DiscountPreviewResponse{
		Code:           app.Code,
		Valid:          true,
		Lines:          lineRes,
		OriginalAmount: app.OriginalAmount,
		DiscountAmount: app.TotalDiscount,
		FinalAmount:    app.FinalAmount,
	}
}

func mapDiscountToResponse(d *domain.DiscountCode) dto.DiscountCodeResponse {
	items := make([]dto.DiscountCodeItemResponse, 0, len(d.Items))
	for _, it := range d.Items {
		items = append(items, dto.DiscountCodeItemResponse{
			ID:          it.ID,
			EntityType:  it.EntityType,
			EntityID:    it.EntityID,
			EntityName:  it.EntityName,
			EntityPrice: it.EntityPrice,
			AmountOff:   it.AmountOff,
		})
	}
	return dto.DiscountCodeResponse{
		ID:          d.ID,
		Code:        d.Code,
		Description: d.Description,
		MaxUses:     d.MaxUses,
		UsedCount:   d.UsedCount,
		ExpiresAt:   d.ExpiresAt,
		Audience:    d.Audience,
		IsActive:    d.IsActive,
		CreatedAt:   d.CreatedAt,
		UpdatedAt:   d.UpdatedAt,
		Items:       items,
		IsExpired:   d.Expired(time.Now()),
		IsExhausted: d.Exhausted(),
	}
}
