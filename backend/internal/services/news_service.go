package services

import (
	"context"
	"errors"
	"math"
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
	repo ports.NewsRepository
}

func NewNewsService(repo ports.NewsRepository) INewsService {
	return &NewsService{repo: repo}
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
		PublishedAt:   req.PublishedAt,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}
	return s.repo.Create(ctx, news)
}

func (s *NewsService) GetNews(ctx context.Context, query dto.PaginationQuery) (*dto.PaginatedResponse, error) {
	offset := (query.Page - 1) * query.Limit
	newsList, total, err := s.repo.FindAll(ctx, query.Limit, offset)
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
	existingNews.PublishedAt = req.PublishedAt
	existingNews.UpdatedAt = time.Now()

	return s.repo.Update(ctx, existingNews)
}

func (s *NewsService) DeleteNews(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}
