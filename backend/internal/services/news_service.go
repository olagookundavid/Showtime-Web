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
	"time"
)

type INewsService interface {
	CreateNews(ctx context.Context, req dto.CreateNewsRequest) error
	GetNews(ctx context.Context, query dto.PaginationQuery) (*dto.PaginatedResponse, error)
	GetNewsByID(ctx context.Context, id string) (*dto.NewsResponse, error)
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
	news := &domain.News{
		Title:              req.Title,
		Slug:               req.Slug,
		Excerpt:            req.Excerpt,
		Content:            req.Content,
		FeaturedImage:      req.FeaturedImage,
		FeaturedMediaType:  req.FeaturedMediaType,
		FeaturedYoutubeURL: req.FeaturedYoutubeURL,
		Author:             req.Author,
		Category:           req.Category,
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

	existingNews.Title = req.Title
	existingNews.Slug = req.Slug
	existingNews.Excerpt = req.Excerpt
	existingNews.Content = req.Content
	existingNews.FeaturedImage = req.FeaturedImage
	existingNews.FeaturedMediaType = req.FeaturedMediaType
	existingNews.FeaturedYoutubeURL = req.FeaturedYoutubeURL
	existingNews.Author = req.Author
	existingNews.Category = req.Category
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

