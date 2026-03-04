package services

import (
	"context"
	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

type IPlayerService interface {
	GetPlayers(ctx context.Context, teamID string, search string) ([]dto.PlayerResponse, error)
	GetPlayerByID(ctx context.Context, id string) (*dto.PlayerResponse, error)
	CreatePlayer(ctx context.Context, player *domain.Player) error
	UpdatePlayer(ctx context.Context, player *domain.Player) error
	DeletePlayer(ctx context.Context, id string) error
}

type PlayerService struct {
	repo ports.PlayerRepository
}

func NewPlayerService(repo ports.PlayerRepository) IPlayerService {
	return &PlayerService{repo: repo}
}

func (s *PlayerService) GetPlayers(ctx context.Context, teamID string, search string) ([]dto.PlayerResponse, error) {
	players, err := s.repo.GetPlayers(ctx, teamID, search)
	if err != nil {
		return nil, err
	}

	var res []dto.PlayerResponse
	for _, p := range players {
		pr := dto.PlayerResponse{
			ID:            p.ID,
			Name:          p.Name,
			JerseyNumber:  p.JerseyNumber,
			Position:      p.Position,
			Bio:           p.Bio,
			Image:         p.Image,
			Touchdowns:    p.Touchdowns,
			Yards:         p.Yards,
			Interceptions: p.Interceptions,
			Tackles:       p.Tackles,
		}
		if p.Team != nil {
			pr.Team = &dto.TeamResponse{
				ID:        p.Team.ID,
				Name:      p.Team.Name,
				ShortName: p.Team.ShortName,
				Logo:      p.Team.Logo,
			}
		}
		res = append(res, pr)
	}
	return res, nil
}

func (s *PlayerService) GetPlayerByID(ctx context.Context, id string) (*dto.PlayerResponse, error) {
	p, err := s.repo.GetPlayerByID(ctx, id)
	if err != nil {
		return nil, err
	}

	pr := &dto.PlayerResponse{
		ID:            p.ID,
		Name:          p.Name,
		JerseyNumber:  p.JerseyNumber,
		Position:      p.Position,
		Bio:           p.Bio,
		Image:         p.Image,
		Touchdowns:    p.Touchdowns,
		Yards:         p.Yards,
		Interceptions: p.Interceptions,
		Tackles:       p.Tackles,
	}
	if p.Team != nil {
		pr.Team = &dto.TeamResponse{
			ID:        p.Team.ID,
			Name:      p.Team.Name,
			ShortName: p.Team.ShortName,
			Logo:      p.Team.Logo,
		}
	}
	return pr, nil
}

func (s *PlayerService) CreatePlayer(ctx context.Context, player *domain.Player) error {
	return s.repo.CreatePlayer(ctx, player)
}

func (s *PlayerService) UpdatePlayer(ctx context.Context, player *domain.Player) error {
	return s.repo.UpdatePlayer(ctx, player)
}

func (s *PlayerService) DeletePlayer(ctx context.Context, id string) error {
	return s.repo.DeletePlayer(ctx, id)
}
