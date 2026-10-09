package services

import (
	"context"
	"errors"
	"strings"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	appErrors "showtime-backend/internal/errors"
	"showtime-backend/internal/ports"

	"github.com/jackc/pgx/v5"
)

// IGamePassService owns the Game Pass bundle product: the season admission
// rates and the discount bands it is priced from.
type IGamePassService interface {
	// Season admission tiers
	ListSeasonTiers(ctx context.Context, activeOnly bool) ([]dto.SeasonAdmissionTierResponse, error)
	CreateSeasonTier(ctx context.Context, req dto.CreateSeasonAdmissionTierRequest) (*dto.SeasonAdmissionTierResponse, error)
	UpdateSeasonTier(ctx context.Context, id string, req dto.UpdateSeasonAdmissionTierRequest) (*dto.SeasonAdmissionTierResponse, error)
	DeleteSeasonTier(ctx context.Context, id string) error

	// Discount bands
	ListDiscountBands(ctx context.Context, activeOnly bool) ([]dto.GamePassDiscountBandResponse, error)
	GetDiscountBand(ctx context.Context, id string) (*dto.GamePassDiscountBandResponse, error)
	CreateDiscountBand(ctx context.Context, req dto.CreateGamePassDiscountBandRequest) (*dto.GamePassDiscountBandResponse, error)
	UpdateDiscountBand(ctx context.Context, id string, req dto.UpdateGamePassDiscountBandRequest) (*dto.GamePassDiscountBandResponse, error)
	SetDiscountBandStatus(ctx context.Context, id string, isActive bool) (*dto.GamePassDiscountBandResponse, error)
	DeleteDiscountBand(ctx context.Context, id string) error

	// Leads
	CreateLead(ctx context.Context, req dto.CreateGamePassLeadRequest) (*dto.GamePassLeadResponse, error)
	ListLeads(ctx context.Context, status, email string, page, limit int) ([]dto.GamePassLeadResponse, int, error)
	UpdateLeadStatus(ctx context.Context, id string, status string) (*dto.GamePassLeadResponse, error)
}

type GamePassService struct {
	seasonTierRepo ports.SeasonAdmissionTierRepository
	bandRepo       ports.GamePassDiscountBandRepository
	leadRepo       ports.GamePassLeadRepository
	eventDayRepo   ports.EventDayRepository
}

func NewGamePassService(
	seasonTierRepo ports.SeasonAdmissionTierRepository,
	bandRepo ports.GamePassDiscountBandRepository,
	leadRepo ports.GamePassLeadRepository,
	eventDayRepo ports.EventDayRepository,
) IGamePassService {
	return &GamePassService{seasonTierRepo: seasonTierRepo, bandRepo: bandRepo, leadRepo: leadRepo, eventDayRepo: eventDayRepo}
}

// ═══════════════════════════════════════════════════════════════════════════════
// Season Admission Tiers
// ═══════════════════════════════════════════════════════════════════════════════

func (s *GamePassService) ListSeasonTiers(ctx context.Context, activeOnly bool) ([]dto.SeasonAdmissionTierResponse, error) {
	tiers, err := s.seasonTierRepo.List(ctx, activeOnly)
	if err != nil {
		return nil, err
	}
	res := make([]dto.SeasonAdmissionTierResponse, 0, len(tiers))
	for i := range tiers {
		res = append(res, seasonTierToResponse(&tiers[i]))
	}
	return res, nil
}

func (s *GamePassService) CreateSeasonTier(ctx context.Context, req dto.CreateSeasonAdmissionTierRequest) (*dto.SeasonAdmissionTierResponse, error) {
	t := &domain.SeasonAdmissionTier{
		Name:         strings.TrimSpace(req.Name),
		Price:        req.Price,
		Description:  req.Description,
		DisplayOrder: req.DisplayOrder,
		IsActive:     true,
	}
	if req.IsActive != nil {
		t.IsActive = *req.IsActive
	}
	if err := validateSeasonTier(t); err != nil {
		return nil, err
	}
	if err := s.seasonTierRepo.Create(ctx, t); err != nil {
		return nil, err
	}
	res := seasonTierToResponse(t)
	return &res, nil
}

func (s *GamePassService) UpdateSeasonTier(ctx context.Context, id string, req dto.UpdateSeasonAdmissionTierRequest) (*dto.SeasonAdmissionTierResponse, error) {
	t, err := s.seasonTierRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if req.Name != nil {
		t.Name = strings.TrimSpace(*req.Name)
	}
	if req.Price != nil {
		t.Price = *req.Price
	}
	if req.Description != nil {
		t.Description = *req.Description
	}
	if req.DisplayOrder != nil {
		t.DisplayOrder = *req.DisplayOrder
	}
	if req.IsActive != nil {
		t.IsActive = *req.IsActive
	}
	if err := validateSeasonTier(t); err != nil {
		return nil, err
	}
	if err := s.seasonTierRepo.Update(ctx, t); err != nil {
		return nil, err
	}
	res := seasonTierToResponse(t)
	return &res, nil
}

func (s *GamePassService) DeleteSeasonTier(ctx context.Context, id string) error {
	return s.seasonTierRepo.Delete(ctx, id)
}

func validateSeasonTier(t *domain.SeasonAdmissionTier) error {
	if t.Name == "" {
		return appErrors.InvalidGamePassConfig("tier name cannot be empty")
	}
	if t.Price < 0 {
		return appErrors.InvalidGamePassConfig("tier price cannot be negative")
	}
	return nil
}

func seasonTierToResponse(t *domain.SeasonAdmissionTier) dto.SeasonAdmissionTierResponse {
	return dto.SeasonAdmissionTierResponse{
		ID:           t.ID,
		Name:         t.Name,
		Price:        t.Price,
		Description:  t.Description,
		DisplayOrder: t.DisplayOrder,
		IsActive:     t.IsActive,
		CreatedAt:    t.CreatedAt,
		UpdatedAt:    t.UpdatedAt,
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// Discount Bands
// ═══════════════════════════════════════════════════════════════════════════════

func (s *GamePassService) ListDiscountBands(ctx context.Context, activeOnly bool) ([]dto.GamePassDiscountBandResponse, error) {
	bands, err := s.bandRepo.List(ctx, activeOnly)
	if err != nil {
		return nil, err
	}
	res := make([]dto.GamePassDiscountBandResponse, 0, len(bands))
	for i := range bands {
		res = append(res, discountBandToResponse(&bands[i]))
	}
	return res, nil
}

func (s *GamePassService) GetDiscountBand(ctx context.Context, id string) (*dto.GamePassDiscountBandResponse, error) {
	b, err := s.bandRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	res := discountBandToResponse(b)
	return &res, nil
}

func (s *GamePassService) CreateDiscountBand(ctx context.Context, req dto.CreateGamePassDiscountBandRequest) (*dto.GamePassDiscountBandResponse, error) {
	b := &domain.GamePassDiscountBand{
		MinGamedays:     req.MinGamedays,
		MaxGamedays:     req.MaxGamedays,
		DiscountPercent: req.DiscountPercent,
		DisplayOrder:    req.DisplayOrder,
		IsActive:        true,
	}
	if req.IsActive != nil {
		b.IsActive = *req.IsActive
	}
	return s.saveDiscountBand(ctx, b)
}

// UpdateDiscountBand applies a partial edit: omitted fields keep their stored
// value, and max_gamedays sent as null makes the band open ended.
func (s *GamePassService) UpdateDiscountBand(ctx context.Context, id string, req dto.UpdateGamePassDiscountBandRequest) (*dto.GamePassDiscountBandResponse, error) {
	b, err := s.bandRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if req.MinGamedays != nil {
		b.MinGamedays = *req.MinGamedays
	}
	if req.MaxGamedays.Set {
		b.MaxGamedays = req.MaxGamedays.Value
	}
	if req.DiscountPercent != nil {
		b.DiscountPercent = *req.DiscountPercent
	}
	if req.DisplayOrder != nil {
		b.DisplayOrder = *req.DisplayOrder
	}
	if req.IsActive != nil {
		b.IsActive = *req.IsActive
	}
	return s.saveDiscountBand(ctx, b)
}

func (s *GamePassService) SetDiscountBandStatus(ctx context.Context, id string, isActive bool) (*dto.GamePassDiscountBandResponse, error) {
	b, err := s.bandRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	b.IsActive = isActive
	return s.saveDiscountBand(ctx, b)
}

func (s *GamePassService) DeleteDiscountBand(ctx context.Context, id string) error {
	return s.bandRepo.Delete(ctx, id)
}

// saveDiscountBand is the one write path for create, edit and status changes,
// so every one of them goes through the same validation. The check runs inside
// the repository's locked transaction against the bands as they stand then.
func (s *GamePassService) saveDiscountBand(ctx context.Context, b *domain.GamePassDiscountBand) (*dto.GamePassDiscountBandResponse, error) {
	err := s.bandRepo.Save(ctx, b, func(all []domain.GamePassDiscountBand) error {
		if err := domain.ValidateDiscountBand(*b, all); err != nil {
			return appErrors.InvalidGamePassConfig("%s", err.Error())
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	res := discountBandToResponse(b)
	return &res, nil
}

func discountBandToResponse(b *domain.GamePassDiscountBand) dto.GamePassDiscountBandResponse {
	return dto.GamePassDiscountBandResponse{
		ID:              b.ID,
		MinGamedays:     b.MinGamedays,
		MaxGamedays:     b.MaxGamedays,
		DiscountPercent: b.DiscountPercent,
		DisplayOrder:    b.DisplayOrder,
		IsActive:        b.IsActive,
		CreatedAt:       b.CreatedAt,
		UpdatedAt:       b.UpdatedAt,
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// Quote
// ═══════════════════════════════════════════════════════════════════════════════

// GamePassQuote is a bundle priced server side from the stored season rate and
// active bands. Anything the buyer saw before this is only a preview.
type GamePassQuote struct {
	Tier     domain.SeasonAdmissionTier
	Gamedays []domain.EventDay
	Price    domain.GamePassPrice
}

// quote validates a bundle selection and prices it. The caller sends only the
// tier, gamedays and holders; every figure comes from the database. Repeated
// gameday IDs are counted once.
func (s *GamePassService) quote(ctx context.Context, tierID string, gamedayIDs []string, holders int) (*GamePassQuote, error) {
	if holders < 1 || holders > domain.MaxGamePassHolders {
		return nil, appErrors.InvalidGamePassConfig("a Game Pass covers 1 to %d pass holders", domain.MaxGamePassHolders)
	}

	ids := make([]string, 0, len(gamedayIDs))
	seen := map[string]bool{}
	for _, id := range gamedayIDs {
		id = strings.ToLower(strings.TrimSpace(id))
		if id != "" && !seen[id] {
			seen[id] = true
			ids = append(ids, id)
		}
	}
	if len(ids) < domain.MinGamePassGamedays {
		return nil, appErrors.InvalidGamePassConfig("pick at least %d gamedays for a Game Pass", domain.MinGamePassGamedays)
	}

	tier, err := s.seasonTierRepo.GetByID(ctx, tierID)
	if err != nil {
		if errors.Is(err, appErrors.ErrNotFound) {
			return nil, appErrors.InvalidGamePassConfig("that admission tier isn't available")
		}
		return nil, err
	}
	if !tier.IsActive {
		return nil, appErrors.InvalidGamePassConfig("the %s tier isn't available for Game Pass", tier.Name)
	}

	// Same "not in the past" rule single ticket purchases use.
	today := time.Now().Truncate(24 * time.Hour)
	gamedays := make([]domain.EventDay, 0, len(ids))
	for _, id := range ids {
		ed, err := s.eventDayRepo.GetByID(ctx, id)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, appErrors.InvalidGamePassConfig("one of the selected gamedays no longer exists")
			}
			return nil, err
		}
		if !ed.IsActive {
			return nil, appErrors.InvalidGamePassConfig("%s isn't on sale", ed.Title)
		}
		if ed.Date.Truncate(24 * time.Hour).Before(today) {
			return nil, appErrors.InvalidGamePassConfig("%s has already taken place", ed.Title)
		}
		gamedays = append(gamedays, *ed)
	}

	bands, err := s.bandRepo.List(ctx, true)
	if err != nil {
		return nil, err
	}

	return &GamePassQuote{
		Tier:     *tier,
		Gamedays: gamedays,
		Price:    domain.PriceGamePass(tier.Price, len(gamedays), holders, bands),
	}, nil
}

// ═══════════════════════════════════════════════════════════════════════════════
// Leads
// ═══════════════════════════════════════════════════════════════════════════════

func (s *GamePassService) CreateLead(ctx context.Context, req dto.CreateGamePassLeadRequest) (*dto.GamePassLeadResponse, error) {
	name := strings.TrimSpace(req.Name)
	phone := strings.TrimSpace(req.Phone)
	if name == "" || phone == "" {
		return nil, appErrors.InvalidGamePassConfig("name and phone are required")
	}

	q, err := s.quote(ctx, req.TierID, req.GamedayIDs, req.Holders)
	if err != nil {
		return nil, err
	}

	lead := &domain.GamePassLead{
		Name:     name,
		Email:    strings.TrimSpace(req.Email),
		Phone:    phone,
		TierName: q.Tier.Name,
		Price:    q.Price,
		Status:   domain.GamePassLeadNew,
		Gamedays: q.Gamedays,
	}
	for _, ed := range q.Gamedays {
		lead.GamedayIDs = append(lead.GamedayIDs, ed.ID)
	}

	if err := s.leadRepo.Create(ctx, lead); err != nil {
		return nil, err
	}
	res := leadToResponse(lead)
	return &res, nil
}

func (s *GamePassService) ListLeads(ctx context.Context, status, email string, page, limit int) ([]dto.GamePassLeadResponse, int, error) {
	if status != "" && !domain.GamePassLeadStatus(status).Valid() {
		return nil, 0, appErrors.InvalidGamePassConfig("unknown lead status %q", status)
	}
	leads, total, err := s.leadRepo.List(ctx, status, strings.TrimSpace(email), page, limit)
	if err != nil {
		return nil, 0, err
	}
	res := make([]dto.GamePassLeadResponse, 0, len(leads))
	for i := range leads {
		res = append(res, leadToResponse(&leads[i]))
	}
	return res, total, nil
}

func (s *GamePassService) UpdateLeadStatus(ctx context.Context, id string, status string) (*dto.GamePassLeadResponse, error) {
	st := domain.GamePassLeadStatus(status)
	if !st.Valid() {
		return nil, appErrors.InvalidGamePassConfig("unknown lead status %q", status)
	}
	if err := s.leadRepo.UpdateStatus(ctx, id, st); err != nil {
		return nil, err
	}
	lead, err := s.leadRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	res := leadToResponse(lead)
	return &res, nil
}

func leadToResponse(l *domain.GamePassLead) dto.GamePassLeadResponse {
	res := dto.GamePassLeadResponse{
		ID:              l.ID,
		Name:            l.Name,
		Email:           l.Email,
		Phone:           l.Phone,
		TierName:        l.TierName,
		GamedayIDs:      l.GamedayIDs,
		Gamedays:        make([]dto.GamePassLeadGameday, 0, len(l.Gamedays)),
		Holders:         l.Price.Holders,
		StandardTotal:   l.Price.StandardTotal,
		DiscountPercent: l.Price.DiscountPercent,
		DiscountAmount:  l.Price.DiscountAmount,
		Total:           l.Price.Total,
		Status:          string(l.Status),
		CreatedAt:       l.CreatedAt,
		UpdatedAt:       l.UpdatedAt,
	}
	for _, ed := range l.Gamedays {
		res.Gamedays = append(res.Gamedays, dto.GamePassLeadGameday{
			ID:    ed.ID,
			Title: ed.Title,
			Date:  ed.Date.Format("2006-01-02"),
		})
	}
	return res
}
