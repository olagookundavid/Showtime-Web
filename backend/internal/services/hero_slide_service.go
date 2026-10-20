package services

import (
	"context"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

type IHeroSlideService interface {
	List(ctx context.Context, activeOnly bool) ([]dto.HeroSlideResponse, error)
	Create(ctx context.Context, req dto.CreateHeroSlideRequest) (*dto.HeroSlideResponse, error)
	Update(ctx context.Context, id string, req dto.UpdateHeroSlideRequest) error
	Delete(ctx context.Context, id string) error
}

type HeroSlideService struct {
	repo     ports.HeroSlideRepository
	newsRepo ports.NewsRepository
}

func NewHeroSlideService(repo ports.HeroSlideRepository, newsRepo ports.NewsRepository) IHeroSlideService {
	return &HeroSlideService{repo: repo, newsRepo: newsRepo}
}

func heroSlideToResponse(s *domain.HeroSlide, includeNewsDetail bool) dto.HeroSlideResponse {
	resp := dto.HeroSlideResponse{
		ID:             s.ID,
		ImageURL:       s.ImageURL,
		MobileImageURL: s.MobileImageURL,
		DestinationURL: s.DestinationURL,
		DisplayOrder:   s.DisplayOrder,
		IsActive:       s.IsActive,
		CreatedAt:      s.CreatedAt,
		UpdatedAt:      s.UpdatedAt,
	}
	if s.News != nil {
		resp.NewsSlug = s.News.Slug
		if includeNewsDetail {
			resp.News = &dto.HeroSlideNewsResponse{
				ID:                 s.News.ID,
				Slug:               s.News.Slug,
				Title:              s.News.Title,
				Excerpt:            s.News.Excerpt,
				Content:            s.News.Content,
				Category:           s.News.Category,
				FeaturedMediaType:  s.News.FeaturedMediaType,
				FeaturedYoutubeURL: s.News.FeaturedYoutubeURL,
			}
		}
	}
	return resp
}

func (s *HeroSlideService) List(ctx context.Context, activeOnly bool) ([]dto.HeroSlideResponse, error) {
	slides, err := s.repo.FindAll(ctx, activeOnly)
	if err != nil {
		return nil, err
	}
	// Public (active-only) reads get the minimal payload (just news_slug);
	// the admin management list gets the full nested article for edit-prefill.
	includeNewsDetail := !activeOnly
	out := make([]dto.HeroSlideResponse, 0, len(slides))
	for _, sl := range slides {
		out = append(out, heroSlideToResponse(sl, includeNewsDetail))
	}
	return out, nil
}

func (s *HeroSlideService) Create(ctx context.Context, req dto.CreateHeroSlideRequest) (*dto.HeroSlideResponse, error) {
	var displayOrder int
	if req.DisplayOrder != nil {
		displayOrder = *req.DisplayOrder
	} else {
		// Append after the highest existing order. A slide count would
		// under-shoot once any slide has been deleted, colliding with an
		// existing display_order and silently breaking later moves.
		next, err := s.repo.NextDisplayOrder(ctx)
		if err != nil {
			return nil, err
		}
		displayOrder = next
	}
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	slide := &domain.HeroSlide{
		ImageURL:       req.ImageURL,
		MobileImageURL: req.MobileImageURL,
		DestinationURL: req.DestinationURL,
		DisplayOrder:   displayOrder,
		IsActive:       isActive,
	}
	if err := s.repo.Create(ctx, slide); err != nil {
		return nil, err
	}
	resp := heroSlideToResponse(slide, true)
	return &resp, nil
}

func (s *HeroSlideService) Update(ctx context.Context, id string, req dto.UpdateHeroSlideRequest) error {
	return s.repo.Update(ctx, id, req.ImageURL, req.MobileImageURL, req.DestinationURL, req.DisplayOrder, req.IsActive)
}

func (s *HeroSlideService) Delete(ctx context.Context, id string) error {
	slide, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}
	// The linked article has no life outside the carousel — remove it too
	// rather than leaving an orphaned, permanently-hidden news row.
	if slide != nil && slide.NewsID != nil {
		if err := s.newsRepo.Delete(ctx, *slide.NewsID); err != nil {
			return err
		}
	}
	return nil
}
