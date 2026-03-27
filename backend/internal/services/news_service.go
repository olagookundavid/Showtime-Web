package services

import (
	"context"
	"errors"
	"fmt"
	"math"
	"pkg-common/logger"
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



func (s *NewsService) CreateNews(ctx context.Context, req dto.CreateNewsRequest) error {
	news := &domain.News{
		Title:         req.Title,
		Slug:          req.Slug,
		Excerpt:       req.Excerpt,
		Content:       req.Content,
		FeaturedImage: req.FeaturedImage,
		Author:        req.Author,
		Category:      req.Category,
		PublishedAt:   time.Now(),
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
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
		responseList = append(responseList, dto.NewsResponse{
			ID:            n.ID,
			Title:         n.Title,
			Slug:          n.Slug,
			Excerpt:       n.Excerpt,
			Content:       n.Content,
			FeaturedImage: n.FeaturedImage,
			Author:        n.Author,
			Category:      n.Category,
			PublishedAt:   n.PublishedAt,
			CreatedAt:     n.CreatedAt,
			UpdatedAt:     n.UpdatedAt,
		})
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

func (s *NewsService) GetNewsByID(ctx context.Context, id string) (*dto.NewsResponse, error) {
	n, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if n == nil {
		return nil, nil
	}

	return &dto.NewsResponse{
		ID:            n.ID,
		Title:         n.Title,
		Slug:          n.Slug,
		Excerpt:       n.Excerpt,
		Content:       n.Content,
		FeaturedImage: n.FeaturedImage,
		Author:        n.Author,
		Category:      n.Category,
		PublishedAt:   n.PublishedAt,
		CreatedAt:     n.CreatedAt,
		UpdatedAt:     n.UpdatedAt,
	}, nil
}

func (s *NewsService) UpdateNews(ctx context.Context, id string, req dto.CreateNewsRequest) error {
	if s.storage != nil {
		existing, err := s.repo.FindByID(ctx, id)
		if err == nil && existing != nil && existing.FeaturedImage != "" && existing.FeaturedImage != req.FeaturedImage {
			oldImage := existing.FeaturedImage
			log := logger.GetSingletonLogger()
			log.Info("Scheduling background delete of old news featured image", map[string]any{"old_url": oldImage})
			if jobErr := SubmitJob(func() {
				if delErr := s.storage.DeleteObject(context.Background(), oldImage); delErr != nil {
					logger.GetSingletonLogger().Error("Failed to delete old news image", map[string]any{"url": oldImage, "error": delErr.Error()})
				} else {
					logger.GetSingletonLogger().Info("Deleted old news image from R2", map[string]any{"url": oldImage})
				}
			}); jobErr != nil {
				log.Error(fmt.Sprintf("Failed to submit delete job for news image: %v", jobErr), nil)
			}
		}
	}

	existingNews, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if existingNews == nil {
		return errors.New("news not found")
	}

	existingNews.Title = req.Title
	existingNews.Slug = req.Slug
	existingNews.Excerpt = req.Excerpt
	existingNews.Content = req.Content
	existingNews.FeaturedImage = req.FeaturedImage
	existingNews.Author = req.Author
	existingNews.Category = req.Category
	existingNews.UpdatedAt = time.Now()

	return s.repo.Update(ctx, existingNews)
}

func (s *NewsService) DeleteNews(ctx context.Context, id string) error {
	if s.storage != nil {
		existing, err := s.repo.FindByID(ctx, id)
		if err == nil && existing != nil && existing.FeaturedImage != "" {
			oldImage := existing.FeaturedImage
			log := logger.GetSingletonLogger()
			log.Info("Scheduling background delete of news image on record delete", map[string]any{"url": oldImage})
			if jobErr := SubmitJob(func() {
				if delErr := s.storage.DeleteObject(context.Background(), oldImage); delErr != nil {
					logger.GetSingletonLogger().Error("Failed to delete news image on record delete", map[string]any{"url": oldImage, "error": delErr.Error()})
				} else {
					logger.GetSingletonLogger().Info("Deleted news image from R2", map[string]any{"url": oldImage})
				}
			}); jobErr != nil {
				log.Error(fmt.Sprintf("Failed to submit delete job for news image: %v", jobErr), nil)
			}
		}
	}
	return s.repo.Delete(ctx, id)
}

