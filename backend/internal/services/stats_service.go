package services

import (
	"context"
	"fmt"
	"showtime-backend/internal/domain"
	"showtime-backend/internal/ports"
	"time"
)

type IStatsService interface {
	UpsertPlayerStat(ctx context.Context, stat *domain.PlayerStat) error
	GetPlayerStats(ctx context.Context, filter domain.StatsFilter) ([]domain.AggregatedPlayerStat, int, error)
	GetTeamStats(ctx context.Context, filter domain.StatsFilter) ([]domain.AggregatedTeamStat, int, error)
	GetStatDates(ctx context.Context, competitionID string) ([]string, error)
}

type StatsService struct {
	repo ports.StatsRepository
}

func NewStatsService(repo ports.StatsRepository) IStatsService {
	return &StatsService{repo: repo}
}

func (s *StatsService) UpsertPlayerStat(ctx context.Context, stat *domain.PlayerStat) error {
	// The repo handles the incremental add via ON CONFLICT DO UPDATE
	return s.repo.UpsertPlayerStat(ctx, stat)
}

func (s *StatsService) GetPlayerStats(ctx context.Context, filter domain.StatsFilter) ([]domain.AggregatedPlayerStat, int, error) {
	return s.repo.GetPlayerStats(ctx, filter)
}

func (s *StatsService) GetTeamStats(ctx context.Context, filter domain.StatsFilter) ([]domain.AggregatedTeamStat, int, error) {
	return s.repo.GetTeamStats(ctx, filter)
}

func (s *StatsService) GetStatDates(ctx context.Context, competitionID string) ([]string, error) {
	return s.repo.GetStatDates(ctx, competitionID)
}

func ParseMatchDate(dateStr string) (time.Time, error) {
	if dateStr == "" {
		return time.Time{}, fmt.Errorf("match date is required")
	}
	parsed, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return time.Time{}, fmt.Errorf("invalid date format: %v", err)
	}
	return parsed, nil
}
