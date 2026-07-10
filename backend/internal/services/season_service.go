package services

import (
	"context"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

type ISeasonService interface {
	ListGraphics(ctx context.Context) ([]dto.SeasonGraphicResponse, error)
	UpsertGraphic(ctx context.Context, req dto.UpsertSeasonGraphicRequest) (*dto.SeasonGraphicResponse, error)

	ListMVPs(ctx context.Context, activeOnly bool) ([]dto.SeasonMVPResponse, error)
	CreateMVP(ctx context.Context, req dto.CreateSeasonMVPRequest) (*dto.SeasonMVPResponse, error)
	UpdateMVP(ctx context.Context, id string, req dto.UpdateSeasonMVPRequest) error
	DeleteMVP(ctx context.Context, id string) error
}

type SeasonService struct {
	repo ports.SeasonRepository
}

func NewSeasonService(repo ports.SeasonRepository) ISeasonService {
	return &SeasonService{repo: repo}
}

func graphicToResponse(g *domain.SeasonGraphic) dto.SeasonGraphicResponse {
	return dto.SeasonGraphicResponse{
		ID:             g.ID,
		Category:       g.Category,
		ImageURL:       g.ImageURL,
		MobileImageURL: g.MobileImageURL,
	}
}

func mvpToResponse(m *domain.SeasonMVP) dto.SeasonMVPResponse {
	resp := dto.SeasonMVPResponse{
		ID:           m.ID,
		PlayerID:     m.PlayerID,
		Label:        m.Label,
		DisplayOrder: m.DisplayOrder,
		IsActive:     m.IsActive,
	}
	if m.Player != nil {
		resp.PlayerName = m.Player.Name
		resp.PlayerImage = m.Player.Image
		resp.PlayerJerseyNumber = m.Player.JerseyNumber
		resp.PlayerPosition = m.Player.Position
		if m.Player.Team != nil {
			resp.TeamName = m.Player.Team.Name
			resp.TeamLogo = m.Player.Team.Logo
		}
	}
	return resp
}

func (s *SeasonService) ListGraphics(ctx context.Context) ([]dto.SeasonGraphicResponse, error) {
	graphics, err := s.repo.FindAllGraphics(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]dto.SeasonGraphicResponse, 0, len(graphics))
	for _, g := range graphics {
		out = append(out, graphicToResponse(g))
	}
	return out, nil
}

func (s *SeasonService) UpsertGraphic(ctx context.Context, req dto.UpsertSeasonGraphicRequest) (*dto.SeasonGraphicResponse, error) {
	g := &domain.SeasonGraphic{
		Category:       req.Category,
		ImageURL:       req.ImageURL,
		MobileImageURL: req.MobileImageURL,
	}
	if err := s.repo.UpsertGraphic(ctx, g); err != nil {
		return nil, err
	}
	resp := graphicToResponse(g)
	return &resp, nil
}

func (s *SeasonService) ListMVPs(ctx context.Context, activeOnly bool) ([]dto.SeasonMVPResponse, error) {
	mvps, err := s.repo.FindAllMVPs(ctx, activeOnly)
	if err != nil {
		return nil, err
	}
	out := make([]dto.SeasonMVPResponse, 0, len(mvps))
	for _, m := range mvps {
		out = append(out, mvpToResponse(m))
	}
	return out, nil
}

func (s *SeasonService) CreateMVP(ctx context.Context, req dto.CreateSeasonMVPRequest) (*dto.SeasonMVPResponse, error) {
	displayOrder := 0
	if req.DisplayOrder != nil {
		displayOrder = *req.DisplayOrder
	}
	m := &domain.SeasonMVP{
		PlayerID:     req.PlayerID,
		Label:        req.Label,
		DisplayOrder: displayOrder,
		IsActive:     true,
	}
	if err := s.repo.CreateMVP(ctx, m); err != nil {
		return nil, err
	}
	resp := mvpToResponse(m)
	return &resp, nil
}

func (s *SeasonService) UpdateMVP(ctx context.Context, id string, req dto.UpdateSeasonMVPRequest) error {
	return s.repo.UpdateMVP(ctx, id, req.Label, req.DisplayOrder, req.IsActive)
}

func (s *SeasonService) DeleteMVP(ctx context.Context, id string) error {
	return s.repo.DeleteMVP(ctx, id)
}
