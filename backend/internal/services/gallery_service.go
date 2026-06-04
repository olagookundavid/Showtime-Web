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

type IGalleryService interface {
	CreateGallery(ctx context.Context, req dto.CreateGalleryRequest) error
	GetGallery(ctx context.Context, competitionID *string, query dto.PaginationQuery) (*dto.PaginatedResponse, error)
	GetGalleryByID(ctx context.Context, id string) (*dto.GalleryResponse, error)
	UpdateGallery(ctx context.Context, id string, req dto.CreateGalleryRequest) error
	DeleteGallery(ctx context.Context, id string) error
}

type GalleryService struct {
	repo ports.GalleryRepository
}

func NewGalleryService(repo ports.GalleryRepository) IGalleryService {
	return &GalleryService{repo: repo}
}

func toGalleryResponse(g *domain.Gallery) dto.GalleryResponse {
	resp := dto.GalleryResponse{
		ID:              g.ID,
		CompetitionID:   g.CompetitionID,
		GameWeek:        g.GameWeek,
		Date:            g.Date,
		PlayersPhotoURL: g.PlayersPhotoURL,
		FansPhotoURL:    g.FansPhotoURL,
		CreatedAt:       g.CreatedAt,
	}
	if g.Competition != nil {
		resp.Competition = &dto.CompetitionResponse{
			ID:     g.Competition.ID,
			Name:   g.Competition.Name,
			Logo:   g.Competition.Logo,
			Status: g.Competition.Status,
		}
	}
	return resp
}

func (s *GalleryService) CreateGallery(ctx context.Context, req dto.CreateGalleryRequest) error {
	gallery := &domain.Gallery{
		CompetitionID:   normalizeOptionalID(req.CompetitionID),
		GameWeek:        req.GameWeek,
		Date:            req.Date,
		PlayersPhotoURL: req.PlayersPhotoURL,
		FansPhotoURL:    req.FansPhotoURL,
		CreatedAt:       time.Now(),
	}
	return s.repo.Create(ctx, gallery)
}

func (s *GalleryService) GetGallery(ctx context.Context, competitionID *string, query dto.PaginationQuery) (*dto.PaginatedResponse, error) {
	offset := (query.Page - 1) * query.Limit
	galleryList, total, err := s.repo.FindAll(ctx, competitionID, query.Limit, offset)
	if err != nil {
		return nil, err
	}

	var responseList []dto.GalleryResponse
	for _, g := range galleryList {
		responseList = append(responseList, toGalleryResponse(g))
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

func (s *GalleryService) GetGalleryByID(ctx context.Context, id string) (*dto.GalleryResponse, error) {
	g, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if g == nil {
		return nil, nil
	}
	resp := toGalleryResponse(g)
	return &resp, nil
}

func (s *GalleryService) UpdateGallery(ctx context.Context, id string, req dto.CreateGalleryRequest) error {
	existing, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if existing == nil {
		return errors.New("gallery item not found")
	}

	existing.CompetitionID = normalizeOptionalID(req.CompetitionID)
	existing.GameWeek = req.GameWeek
	existing.Date = req.Date
	existing.PlayersPhotoURL = req.PlayersPhotoURL
	existing.FansPhotoURL = req.FansPhotoURL

	return s.repo.Update(ctx, existing)
}

func (s *GalleryService) DeleteGallery(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}

func normalizeOptionalID(id *string) *string {
	if id == nil || *id == "" {
		return nil
	}
	return id
}
