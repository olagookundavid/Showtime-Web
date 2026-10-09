package services

import (
	"context"
	"strings"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	appErrors "showtime-backend/internal/errors"
	"showtime-backend/internal/ports"
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
}

type GamePassService struct {
	seasonTierRepo ports.SeasonAdmissionTierRepository
	bandRepo       ports.GamePassDiscountBandRepository
}

func NewGamePassService(seasonTierRepo ports.SeasonAdmissionTierRepository, bandRepo ports.GamePassDiscountBandRepository) IGamePassService {
	return &GamePassService{seasonTierRepo: seasonTierRepo, bandRepo: bandRepo}
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
