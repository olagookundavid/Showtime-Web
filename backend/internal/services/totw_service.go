package services

import (
	"context"
	"showtime-backend/internal/domain"
	"showtime-backend/internal/ports"
)

type ITOTWService interface {
	CreateTOTWEntry(ctx context.Context, entry *domain.TOTWEntry) error
	DeleteTOTWEntry(ctx context.Context, id string) error
	GetTOTW(ctx context.Context, competitionID string, eventDay string) ([]domain.TOTWEntry, error)
	GetLatestTOTW(ctx context.Context, competitionID string) ([]domain.TOTWEntry, string, error)
}

type TOTWService struct {
	repo ports.TOTWRepository
}

func NewTOTWService(repo ports.TOTWRepository) *TOTWService {
	return &TOTWService{repo: repo}
}

func (s *TOTWService) CreateTOTWEntry(ctx context.Context, entry *domain.TOTWEntry) error {
	return s.repo.Create(ctx, entry)
}

func (s *TOTWService) DeleteTOTWEntry(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}

func (s *TOTWService) GetTOTW(ctx context.Context, competitionID string, eventDay string) ([]domain.TOTWEntry, error) {
	return s.repo.GetByFilter(ctx, competitionID, eventDay)
}

func (s *TOTWService) GetLatestTOTW(ctx context.Context, competitionID string) ([]domain.TOTWEntry, string, error) {
	return s.repo.GetLatest(ctx, competitionID)
}
