package services

import (
	"context"
	"errors"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

// MaxHeroSlides caps how many slides the homepage carousel can hold. Five is
// plenty for a hero carousel — beyond that the auto-rotate cadence makes the
// later slides effectively invisible.
const MaxHeroSlides = 5

// heroSlideNewsCategory is the fixed category assigned to every article
// authored from the Hero Slides admin. It's not exposed as a picker in that
// form — every hero-linked article is tagged the same way — and it doubles as
// the "featured" badge shown on the article page via NewsDetail's existing
// category-badge rendering.
const heroSlideNewsCategory = "Showtime"

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

// createLinkedNews inserts the news article for a new hero slide. The slug is
// generated server-side by generateArticleSlug (shared with regular news
// creation in news_service.go) — it's never admin-editable and, since it
// always carries a random unique suffix, it can't collide.
func (s *HeroSlideService) createLinkedNews(ctx context.Context, req dto.HeroSlideNewsRequest, slideImageURL string) (*domain.News, error) {
	mediaType := req.FeaturedMediaType
	if mediaType == "" {
		mediaType = "image"
	}
	if mediaType == "youtube" && req.FeaturedYoutubeURL == "" {
		return nil, errors.New("featured_youtube_url is required when featured_media_type is 'youtube'")
	}
	featuredImage := ""
	if mediaType == "image" {
		featuredImage = slideImageURL
	}

	now := time.Now()
	news := &domain.News{
		Title:              req.Title,
		Slug:               generateArticleSlug(req.Title),
		Excerpt:            req.Excerpt,
		Content:            req.Content,
		FeaturedImage:      featuredImage,
		FeaturedMediaType:  mediaType,
		FeaturedYoutubeURL: req.FeaturedYoutubeURL,
		Category:           heroSlideNewsCategory,
		PublishedAt:        now,
		CreatedAt:          now,
		UpdatedAt:          now,
		IsHeroOnly:         true,
	}
	if err := s.newsRepo.Create(ctx, news); err != nil {
		return nil, err
	}
	return news, nil
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

	news, err := s.createLinkedNews(ctx, req.News, req.ImageURL)
	if err != nil {
		return nil, err
	}

	slide := &domain.HeroSlide{
		ImageURL:       req.ImageURL,
		MobileImageURL: req.MobileImageURL,
		DisplayOrder:   displayOrder,
		IsActive:       isActive,
		NewsID:         &news.ID,
	}
	if err := s.repo.Create(ctx, slide); err != nil {
		return nil, err
	}
	slide.News = news
	resp := heroSlideToResponse(slide, true)
	return &resp, nil
}

func (s *HeroSlideService) Update(ctx context.Context, id string, req dto.UpdateHeroSlideRequest) error {
	if err := s.repo.Update(ctx, id, req.ImageURL, req.MobileImageURL, req.DisplayOrder, req.IsActive); err != nil {
		return err
	}
	if req.News == nil {
		return nil
	}

	slide, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if slide == nil {
		return errors.New("hero slide not found")
	}

	mediaType := req.News.FeaturedMediaType
	if mediaType == "" {
		mediaType = "image"
	}
	if mediaType == "youtube" && req.News.FeaturedYoutubeURL == "" {
		return errors.New("featured_youtube_url is required when featured_media_type is 'youtube'")
	}
	featuredImage := ""
	if mediaType == "image" {
		featuredImage = slide.ImageURL // the (possibly just-updated) carousel image
	}

	if slide.NewsID == nil {
		// Legacy slide (created before this feature) getting its first article.
		news, err := s.createLinkedNews(ctx, *req.News, slide.ImageURL)
		if err != nil {
			return err
		}
		return s.repo.LinkNews(ctx, id, &news.ID)
	}

	// Update the existing linked article in place. Slug is intentionally never
	// regenerated on edit — changing it would break any link already shared.
	existing, err := s.newsRepo.FindByID(ctx, *slide.NewsID)
	if err != nil {
		return err
	}
	if existing == nil {
		return errors.New("linked news article not found")
	}
	existing.Title = req.News.Title
	existing.Excerpt = req.News.Excerpt
	existing.Content = req.News.Content
	existing.FeaturedMediaType = mediaType
	existing.FeaturedYoutubeURL = req.News.FeaturedYoutubeURL
	existing.FeaturedImage = featuredImage
	existing.UpdatedAt = time.Now()

	return s.newsRepo.Update(ctx, existing)
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
