package services

import (
	"context"
	"errors"
	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

// MaxHeroSlides caps how many slides the homepage carousel can hold. Five is
// plenty for a hero carousel — beyond that the auto-rotate cadence makes the
// later slides effectively invisible.
const MaxHeroSlides = 5

type IHeroSlideService interface {
	List(ctx context.Context, activeOnly bool) ([]dto.HeroSlideResponse, error)
	Create(ctx context.Context, req dto.CreateHeroSlideRequest) (*dto.HeroSlideResponse, error)
	Update(ctx context.Context, id string, req dto.UpdateHeroSlideRequest) error
	Delete(ctx context.Context, id string) error
}

type HeroSlideService struct {
	repo ports.HeroSlideRepository
}

func NewHeroSlideService(repo ports.HeroSlideRepository) IHeroSlideService {
	return &HeroSlideService{repo: repo}
}

func heroSlideToResponse(s *domain.HeroSlide) dto.HeroSlideResponse {
	return dto.HeroSlideResponse{
		ID:             s.ID,
		ImageURL:       s.ImageURL,
		MobileImageURL: s.MobileImageURL,
		DisplayOrder:   s.DisplayOrder,
		IsActive:       s.IsActive,
		CreatedAt:      s.CreatedAt,
		UpdatedAt:      s.UpdatedAt,
	}
}

func (s *HeroSlideService) List(ctx context.Context, activeOnly bool) ([]dto.HeroSlideResponse, error) {
	slides, err := s.repo.FindAll(ctx, activeOnly)
	if err != nil {
		return nil, err
	}
	out := make([]dto.HeroSlideResponse, 0, len(slides))
	for _, s := range slides {
		out = append(out, heroSlideToResponse(s))
	}
	return out, nil
}

func (s *HeroSlideService) Create(ctx context.Context, req dto.CreateHeroSlideRequest) (*dto.HeroSlideResponse, error) {
	// Enforce the 5-slide cap at the service layer so the admin UI gets a
	// clear 4xx error rather than silently dropping rows in the DB.
	count, err := s.repo.Count(ctx)
	if err != nil {
		return nil, err
	}
	if count >= MaxHeroSlides {
		return nil, errors.New("hero slide limit reached (max 5) — delete one before adding another")
	}

	displayOrder := count // default: append to the end
	if req.DisplayOrder != nil {
		displayOrder = *req.DisplayOrder
	}
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	slide := &domain.HeroSlide{
		ImageURL:       req.ImageURL,
		MobileImageURL: req.MobileImageURL,
		DisplayOrder:   displayOrder,
		IsActive:       isActive,
	}
	if err := s.repo.Create(ctx, slide); err != nil {
		return nil, err
	}
	resp := heroSlideToResponse(slide)
	return &resp, nil
}

func (s *HeroSlideService) Update(ctx context.Context, id string, req dto.UpdateHeroSlideRequest) error {
	return s.repo.Update(ctx, id, req.ImageURL, req.MobileImageURL, req.DisplayOrder, req.IsActive)
}

func (s *HeroSlideService) Delete(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}
