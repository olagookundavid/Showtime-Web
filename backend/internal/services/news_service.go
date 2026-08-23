package services

import (
	"context"
	"errors"
	"fmt"
	"math"
	"pkg-common/logger"
	"regexp"
	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
	"strings"
	"time"

	"github.com/google/uuid"
)

type INewsService interface {
	CreateNews(ctx context.Context, req dto.CreateNewsRequest) error
	GetNews(ctx context.Context, query dto.PaginationQuery) (*dto.PaginatedResponse, error)
	GetNewsByID(ctx context.Context, id string) (*dto.NewsResponse, error)
	GetNewsBySlug(ctx context.Context, slug string) (*dto.NewsResponse, error)
	UpdateNews(ctx context.Context, id string, req dto.CreateNewsRequest) error
	DeleteNews(ctx context.Context, id string) error
}

type NewsService struct {
	repo    ports.NewsRepository
	storage ports.StorageService
}

func NewNewsService(newsRepo ports.NewsRepository, storage ports.StorageService) INewsService {
	return &NewsService{repo: newsRepo, storage: storage}
}

// inlineImageTagRe matches the body tag [image:URL] / [image:URL|caption] used
// to embed photos inside article content. Group 1 is the URL.
var inlineImageTagRe = regexp.MustCompile(`\[image:([^|\]]+)`)

// inlineImageURLs extracts every inline image URL referenced in article content.
func inlineImageURLs(content string) map[string]struct{} {
	urls := make(map[string]struct{})
	for _, m := range inlineImageTagRe.FindAllStringSubmatch(content, -1) {
		urls[m[1]] = struct{}{}
	}
	return urls
}

// scheduleImageDelete removes an object from storage in the background; used
// for featured and inline images that are no longer referenced by any article.
func (s *NewsService) scheduleImageDelete(url, reason string) {
	log := logger.GetSingletonLogger()
	log.Info("Scheduling background delete of news image", map[string]any{"url": url, "reason": reason})
	if jobErr := SubmitJob(func() {
		if delErr := s.storage.DeleteObject(context.Background(), url); delErr != nil {
			logger.GetSingletonLogger().Error("Failed to delete news image", map[string]any{"url": url, "reason": reason, "error": delErr.Error()})
		} else {
			logger.GetSingletonLogger().Info("Deleted news image from R2", map[string]any{"url": url, "reason": reason})
		}
	}); jobErr != nil {
		log.Error(fmt.Sprintf("Failed to submit delete job for news image: %v", jobErr), nil)
	}
}

var slugNonAlnumRe = regexp.MustCompile(`[^a-z0-9]+`)

// slugify lowercases a title and replaces runs of non-alphanumeric characters
// with a single hyphen, trimming leading/trailing hyphens.
func slugify(title string) string {
	s := strings.ToLower(strings.TrimSpace(title))
	s = slugNonAlnumRe.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	if s == "" {
		s = "showtime"
	}
	return s
}

// generateArticleSlug builds the URL slug for a news article server-side —
// slugs are never admin-editable and never collide by construction: every
// slug gets a short random suffix, so no DB round-trip or retry-on-conflict
// loop is needed (the unique DB constraint on news.slug is just a backstop).
func generateArticleSlug(title string) string {
	suffix := strings.ToLower(strings.ReplaceAll(uuid.New().String(), "-", "")[:6])
	return slugify(title) + "-" + suffix
}

func validateFeaturedMedia(req *dto.CreateNewsRequest) error {
	if req.FeaturedMediaType == "" {
		req.FeaturedMediaType = "image"
	}
	if req.FeaturedMediaType != "image" && req.FeaturedMediaType != "youtube" {
		return errors.New("featured_media_type must be 'image' or 'youtube'")
	}
	if req.FeaturedMediaType == "youtube" && req.FeaturedYoutubeURL == "" {
		return errors.New("featured_youtube_url is required when featured_media_type is 'youtube'")
	}
	return nil
}

func (s *NewsService) CreateNews(ctx context.Context, req dto.CreateNewsRequest) error {
	if err := validateFeaturedMedia(&req); err != nil {
		return err
	}
	// Comments are on unless the admin explicitly turned them off, matching the
	// column default — a create request that omits the field must not produce an
	// article whose comment box renders but rejects every post.
	commentsEnabled := true
	if req.CommentsEnabled != nil {
		commentsEnabled = *req.CommentsEnabled
	}

	news := &domain.News{
		Title:              req.Title,
		Slug:               generateArticleSlug(req.Title),
		Excerpt:            req.Excerpt,
		Content:            req.Content,
		FeaturedImage:      req.FeaturedImage,
		FeaturedMediaType:  req.FeaturedMediaType,
		FeaturedYoutubeURL: req.FeaturedYoutubeURL,
		Author:             req.Author,
		Category:           req.Category,
		CommentsEnabled:    commentsEnabled,
		PublishedAt:        time.Now(),
		CreatedAt:          time.Now(),
		UpdatedAt:          time.Now(),
	}
	return s.repo.Create(ctx, news)
}

func (s *NewsService) GetNews(ctx context.Context, query dto.PaginationQuery) (*dto.PaginatedResponse, error) {
	newsList, total, err := s.repo.FindAll(ctx, query)
	if err != nil {
		return nil, err
	}

	var responseList []dto.NewsResponse
	for _, n := range newsList {
		responseList = append(responseList, newsResponseFromDomain(n))
	}

	totalPages := int(math.Ceil(float64(total) / float64(query.Limit)))

	return &dto.PaginatedResponse{
		Data:       responseList,
		Total:      total,
		Page:       query.Page,
		Limit:      query.Limit,
		TotalPages: totalPages,
	}, nil
}

func newsResponseFromDomain(n *domain.News) dto.NewsResponse {
	return dto.NewsResponse{
		ID:                 n.ID,
		Title:              n.Title,
		Slug:               n.Slug,
		Excerpt:            n.Excerpt,
		Content:            n.Content,
		FeaturedImage:      n.FeaturedImage,
		FeaturedMediaType:  n.FeaturedMediaType,
		FeaturedYoutubeURL: n.FeaturedYoutubeURL,
		Author:             n.Author,
		Category:           n.Category,
		PublishedAt:        n.PublishedAt,
		CreatedAt:          n.CreatedAt,
		UpdatedAt:          n.UpdatedAt,
		CommentsEnabled:    n.CommentsEnabled,
	}
}

func (s *NewsService) GetNewsByID(ctx context.Context, id string) (*dto.NewsResponse, error) {
	n, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if n == nil {
		return nil, nil
	}

	resp := newsResponseFromDomain(n)
	return &resp, nil
}

// GetNewsBySlug resolves a single article by slug regardless of is_hero_only —
// used by the public article page so a hero-carousel-linked article still
// opens even though it's excluded from GetNews's list results.
func (s *NewsService) GetNewsBySlug(ctx context.Context, slug string) (*dto.NewsResponse, error) {
	n, err := s.repo.FindBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}
	if n == nil {
		return nil, nil
	}

	resp := newsResponseFromDomain(n)
	return &resp, nil
}

func (s *NewsService) UpdateNews(ctx context.Context, id string, req dto.CreateNewsRequest) error {
	if err := validateFeaturedMedia(&req); err != nil {
		return err
	}

	existingNews, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if existingNews == nil {
		return errors.New("news not found")
	}

	if s.storage != nil {
		if existingNews.FeaturedImage != "" && existingNews.FeaturedImage != req.FeaturedImage {
			s.scheduleImageDelete(existingNews.FeaturedImage, "featured image replaced")
		}
		// Inline body images dropped in this edit are no longer referenced anywhere
		// (each upload is unique per article), so remove them from storage too.
		newInline := inlineImageURLs(req.Content)
		for url := range inlineImageURLs(existingNews.Content) {
			if _, still := newInline[url]; !still && url != req.FeaturedImage {
				s.scheduleImageDelete(url, "inline image removed from content")
			}
		}
	}

	// Slug is intentionally never changed on update — it's generated once at
	// creation and never admin-editable; changing it would break any link
	// already shared.
	existingNews.Title = req.Title
	existingNews.Excerpt = req.Excerpt
	existingNews.Content = req.Content
	existingNews.FeaturedImage = req.FeaturedImage
	existingNews.FeaturedMediaType = req.FeaturedMediaType
	existingNews.FeaturedYoutubeURL = req.FeaturedYoutubeURL
	existingNews.Author = req.Author
	existingNews.Category = req.Category
	// Omitted means unchanged — the dedicated comment-settings endpoint is free
	// to flip this without a full article edit racing it back.
	if req.CommentsEnabled != nil {
		existingNews.CommentsEnabled = *req.CommentsEnabled
	}
	existingNews.UpdatedAt = time.Now()

	return s.repo.Update(ctx, existingNews)
}

func (s *NewsService) DeleteNews(ctx context.Context, id string) error {
	if s.storage != nil {
		existing, err := s.repo.FindByID(ctx, id)
		if err == nil && existing != nil {
			if existing.FeaturedImage != "" {
				s.scheduleImageDelete(existing.FeaturedImage, "article deleted")
			}
			for url := range inlineImageURLs(existing.Content) {
				if url != existing.FeaturedImage {
					s.scheduleImageDelete(url, "article deleted (inline image)")
				}
			}
		}
	}
	return s.repo.Delete(ctx, id)
}
