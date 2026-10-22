package services

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
	"showtime-backend/internal/richtext"
)

// fantasyCarouselSummaryRunes is how much of an article's text a slide shows
// when the article has no excerpt.
const fantasyCarouselSummaryRunes = 160

type IFantasyCarouselService interface {
	List(ctx context.Context, activeOnly bool) ([]dto.FantasyCarouselSlideResponse, error)
	Add(ctx context.Context, req dto.AddFantasyCarouselSlideRequest) (*dto.FantasyCarouselSlideResponse, error)
	// QuickAdd publishes a new article to the news site and puts it straight on
	// the carousel, in one step.
	QuickAdd(ctx context.Context, req dto.CreateNewsRequest) (*dto.FantasyCarouselSlideResponse, error)
	Update(ctx context.Context, id string, req dto.UpdateFantasyCarouselSlideRequest) error
	Remove(ctx context.Context, id string) error
}

// articleCreator is the part of the news service QuickAdd needs: publishing an
// article through the same validation, slug and sanitising as the News admin.
type articleCreator interface {
	CreateArticle(ctx context.Context, req dto.CreateNewsRequest) (*domain.News, error)
}

type FantasyCarouselService struct {
	repo     ports.FantasyCarouselRepository
	articles articleCreator
	newsRepo ports.NewsRepository
}

func NewFantasyCarouselService(repo ports.FantasyCarouselRepository, articles articleCreator, newsRepo ports.NewsRepository) IFantasyCarouselService {
	return &FantasyCarouselService{repo: repo, articles: articles, newsRepo: newsRepo}
}

func fantasyCarouselSummary(n *domain.News) string {
	if excerpt := strings.TrimSpace(n.Excerpt); excerpt != "" {
		return excerpt
	}
	text := strings.TrimSpace(richtext.PlainText(n.Content))
	if utf8.RuneCountInString(text) <= fantasyCarouselSummaryRunes {
		return text
	}
	runes := []rune(text)
	return strings.TrimSpace(string(runes[:fantasyCarouselSummaryRunes])) + "…"
}

func fantasyCarouselSlideResponse(s *domain.FantasyCarouselSlide) dto.FantasyCarouselSlideResponse {
	resp := dto.FantasyCarouselSlideResponse{
		ID:           s.ID,
		DisplayOrder: s.DisplayOrder,
		IsActive:     s.IsActive,
		CreatedAt:    s.CreatedAt,
	}
	if n := s.News; n != nil {
		resp.Article = dto.FantasyCarouselArticle{
			ID:                 s.NewsID,
			Slug:               n.Slug,
			Title:              n.Title,
			Summary:            fantasyCarouselSummary(n),
			FeaturedImage:      n.FeaturedImage,
			FeaturedMediaType:  n.FeaturedMediaType,
			FeaturedYoutubeURL: n.FeaturedYoutubeURL,
			Category:           n.Category,
			PublishedAt:        n.PublishedAt,
		}
	}
	return resp
}

func (s *FantasyCarouselService) List(ctx context.Context, activeOnly bool) ([]dto.FantasyCarouselSlideResponse, error) {
	slides, err := s.repo.List(ctx, activeOnly)
	if err != nil {
		return nil, err
	}
	out := make([]dto.FantasyCarouselSlideResponse, 0, len(slides))
	for _, sl := range slides {
		out = append(out, fantasyCarouselSlideResponse(sl))
	}
	return out, nil
}

// slideFor re-reads a just-added slide so the response carries its article.
func (s *FantasyCarouselService) slideFor(ctx context.Context, id string) (*dto.FantasyCarouselSlideResponse, error) {
	slides, err := s.repo.List(ctx, false)
	if err != nil {
		return nil, err
	}
	for _, sl := range slides {
		if sl.ID == id {
			resp := fantasyCarouselSlideResponse(sl)
			return &resp, nil
		}
	}
	return nil, errors.New("the slide was added but could not be read back")
}

func (s *FantasyCarouselService) Add(ctx context.Context, req dto.AddFantasyCarouselSlideRequest) (*dto.FantasyCarouselSlideResponse, error) {
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}
	slide, err := s.repo.Add(ctx, req.NewsID, isActive)
	if err != nil {
		return nil, err
	}
	return s.slideFor(ctx, slide.ID)
}

func (s *FantasyCarouselService) QuickAdd(ctx context.Context, req dto.CreateNewsRequest) (*dto.FantasyCarouselSlideResponse, error) {
	req.Category = strings.TrimSpace(req.Category)
	if req.Category == "" {
		req.Category = domain.FantasyNewsCategories[0]
	}
	valid := false
	for _, c := range domain.FantasyNewsCategories {
		if strings.EqualFold(req.Category, c) {
			req.Category, valid = c, true
			break
		}
	}
	if !valid {
		return nil, fmt.Errorf("a quick-added article must be filed under %s", strings.Join(domain.FantasyNewsCategories, " or "))
	}

	// Refuse a full carousel before publishing anything, so the common case
	// never leaves an article behind. Add re-checks under its lock.
	count, err := s.repo.Count(ctx)
	if err != nil {
		return nil, err
	}
	if count >= domain.FantasyCarouselMax {
		return nil, domain.ErrFantasyCarouselFull
	}

	article, err := s.articles.CreateArticle(ctx, req)
	if err != nil {
		return nil, err
	}
	slide, err := s.repo.Add(ctx, article.ID, true)
	if err != nil {
		// Someone filled the last place in between. Take the article back down
		// rather than leave a published story the editor did not mean to post
		// on its own. Its images stay, so a retry can reuse the upload.
		if delErr := s.newsRepo.Delete(ctx, article.ID); delErr != nil {
			return nil, fmt.Errorf("%w (and the article it published could not be removed: %v)", err, delErr)
		}
		return nil, err
	}
	return s.slideFor(ctx, slide.ID)
}

func (s *FantasyCarouselService) Update(ctx context.Context, id string, req dto.UpdateFantasyCarouselSlideRequest) error {
	return s.repo.Update(ctx, id, req.DisplayOrder, req.IsActive)
}

func (s *FantasyCarouselService) Remove(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}
