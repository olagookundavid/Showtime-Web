package services

import (
	"context"
	"fmt"
	"log"
	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
	"strings"
)

type ITOTWService interface {
	CreateTOTW(ctx context.Context, req dto.SaveTOTWRequest, createdBy *string) (*dto.TOTWResponse, error)
	UpdateTOTW(ctx context.Context, id string, req dto.SaveTOTWRequest) (*dto.TOTWResponse, error)
	DeleteTOTW(ctx context.Context, id string) error
	GetTOTWByID(ctx context.Context, id string) (*dto.TOTWResponse, error)
	GetLatestPublishedTOTW(ctx context.Context, competitionID string) (*dto.TOTWResponse, error)
	ListTOTWArchive(ctx context.Context, competitionID string, onlyPublished bool) ([]dto.TOTWListItemResponse, error)
	PublishTOTW(ctx context.Context, id string, isPublished bool) (*dto.TOTWResponse, error)
	GetPlayerDayStats(ctx context.Context, playerID string, eventDayID string) (map[string]string, error)
}

type TOTWService struct {
	totwRepo     ports.TOTWRepository
	badgeService IBadgeService
}

func NewTOTWService(totwRepo ports.TOTWRepository, badgeService IBadgeService) *TOTWService {
	return &TOTWService{totwRepo: totwRepo, badgeService: badgeService}
}

func (s *TOTWService) CreateTOTW(ctx context.Context, req dto.SaveTOTWRequest, createdBy *string) (*dto.TOTWResponse, error) {
	if len(req.Players) == 0 {
		return nil, fmt.Errorf("starting lineup cannot be empty")
	}

	subHeadline := strings.TrimSpace(req.SubHeadline)
	if subHeadline == "" {
		subHeadline = "Offence & defence lineup"
	}

	totw := &domain.TeamOfTheWeek{
		CompetitionID: req.CompetitionID,
		EventDayID:    req.EventDayID,
		WeekTitle:     strings.TrimSpace(req.WeekTitle),
		Headline:      strings.TrimSpace(req.Headline),
		SubHeadline:   subHeadline,
		IsPublished:   req.IsPublished,
		CreatedBy:     createdBy,
	}

	players := make([]domain.TOTWPlayer, len(req.Players))
	for i, p := range req.Players {
		rating := p.Rating
		if rating <= 0 {
			rating = 8.5
		}
		coordX := p.CoordX
		if coordX == "" {
			coordX = defaultCoordX(p.SlotCode)
		}
		coordY := p.CoordY
		if coordY == "" {
			coordY = defaultCoordY(p.SlotCode)
		}

		players[i] = domain.TOTWPlayer{
			PlayerID:     p.PlayerID,
			SlotCode:     p.SlotCode,
			Position:     p.Position,
			Unit:         p.Unit,
			CoordX:       coordX,
			CoordY:       coordY,
			Rating:       rating,
			Stat1Value:   p.Stat1Value,
			Stat1Label:   p.Stat1Label,
			Stat2Value:   p.Stat2Value,
			Stat2Label:   p.Stat2Label,
			Stat3Value:   p.Stat3Value,
			Stat3Label:   p.Stat3Label,
			DisplayOrder: i,
		}
	}

	created, err := s.totwRepo.CreateTOTW(ctx, totw, players)
	if err != nil {
		return nil, err
	}

	if created.IsPublished && s.badgeService != nil {
		if err := s.badgeService.SyncTOTWBadges(ctx, created); err != nil {
			log.Printf("[ERROR] totw %s: sync badges after create: %v", created.ID, err)
		}
	}

	return s.mapToResponse(created), nil
}

func (s *TOTWService) UpdateTOTW(ctx context.Context, id string, req dto.SaveTOTWRequest) (*dto.TOTWResponse, error) {
	if len(req.Players) == 0 {
		return nil, fmt.Errorf("starting lineup cannot be empty")
	}

	subHeadline := strings.TrimSpace(req.SubHeadline)
	if subHeadline == "" {
		subHeadline = "Offence & defence lineup"
	}

	totw := &domain.TeamOfTheWeek{
		ID:            id,
		CompetitionID: req.CompetitionID,
		EventDayID:    req.EventDayID,
		WeekTitle:     strings.TrimSpace(req.WeekTitle),
		Headline:      strings.TrimSpace(req.Headline),
		SubHeadline:   subHeadline,
		IsPublished:   req.IsPublished,
	}

	players := make([]domain.TOTWPlayer, len(req.Players))
	for i, p := range req.Players {
		rating := p.Rating
		if rating <= 0 {
			rating = 8.5
		}
		coordX := p.CoordX
		if coordX == "" {
			coordX = defaultCoordX(p.SlotCode)
		}
		coordY := p.CoordY
		if coordY == "" {
			coordY = defaultCoordY(p.SlotCode)
		}

		players[i] = domain.TOTWPlayer{
			TOTWID:       id,
			PlayerID:     p.PlayerID,
			SlotCode:     p.SlotCode,
			Position:     p.Position,
			Unit:         p.Unit,
			CoordX:       coordX,
			CoordY:       coordY,
			Rating:       rating,
			Stat1Value:   p.Stat1Value,
			Stat1Label:   p.Stat1Label,
			Stat2Value:   p.Stat2Value,
			Stat2Label:   p.Stat2Label,
			Stat3Value:   p.Stat3Value,
			Stat3Label:   p.Stat3Label,
			DisplayOrder: i,
		}
	}

	updated, err := s.totwRepo.UpdateTOTW(ctx, totw, players)
	if err != nil {
		return nil, err
	}

	if s.badgeService != nil {
		if err := s.badgeService.SyncTOTWBadges(ctx, updated); err != nil {
			log.Printf("[ERROR] totw %s: sync badges after update: %v", updated.ID, err)
		}
	}

	return s.mapToResponse(updated), nil
}

func (s *TOTWService) DeleteTOTW(ctx context.Context, id string) error {
	if s.badgeService != nil {
		if err := s.badgeService.HandleTOTWDeleted(ctx, id); err != nil {
			log.Printf("[ERROR] totw %s: clear badges before delete: %v", id, err)
		}
	}
	return s.totwRepo.DeleteTOTW(ctx, id)
}

func (s *TOTWService) GetTOTWByID(ctx context.Context, id string) (*dto.TOTWResponse, error) {
	totw, err := s.totwRepo.GetTOTWByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return s.mapToResponse(totw), nil
}

func (s *TOTWService) GetLatestPublishedTOTW(ctx context.Context, competitionID string) (*dto.TOTWResponse, error) {
	totw, err := s.totwRepo.GetLatestPublishedTOTW(ctx, competitionID)
	if err != nil {
		return nil, err
	}
	return s.mapToResponse(totw), nil
}

func (s *TOTWService) ListTOTWArchive(ctx context.Context, competitionID string, onlyPublished bool) ([]dto.TOTWListItemResponse, error) {
	list, err := s.totwRepo.ListTOTWArchive(ctx, competitionID, onlyPublished)
	if err != nil {
		return nil, err
	}

	res := make([]dto.TOTWListItemResponse, len(list))
	for i, item := range list {
		var compName, compLogo string
		if item.Competition != nil {
			compName = item.Competition.Name
			compLogo = item.Competition.Logo
		}
		res[i] = dto.TOTWListItemResponse{
			ID:              item.ID,
			CompetitionID:   item.CompetitionID,
			CompetitionName: compName,
			CompetitionLogo: compLogo,
			EventDayID:      item.EventDayID,
			WeekTitle:       item.WeekTitle,
			Headline:        item.Headline,
			SubHeadline:     item.SubHeadline,
			IsPublished:     item.IsPublished,
			PublishedAt:     item.PublishedAt,
			CreatedAt:       item.CreatedAt,
		}
	}
	return res, nil
}

func (s *TOTWService) PublishTOTW(ctx context.Context, id string, isPublished bool) (*dto.TOTWResponse, error) {
	totw, err := s.totwRepo.PublishTOTW(ctx, id, isPublished)
	if err != nil {
		return nil, err
	}

	if s.badgeService != nil {
		if err := s.badgeService.SyncTOTWBadges(ctx, totw); err != nil {
			log.Printf("[ERROR] totw %s: sync badges after publish toggle: %v", totw.ID, err)
		}
	}

	return s.mapToResponse(totw), nil
}

func (s *TOTWService) GetPlayerDayStats(ctx context.Context, playerID string, eventDayID string) (map[string]string, error) {
	return s.totwRepo.GetPlayerDayStats(ctx, playerID, eventDayID)
}

func (s *TOTWService) mapToResponse(totw *domain.TeamOfTheWeek) *dto.TOTWResponse {
	if totw == nil {
		return nil
	}

	resp := &dto.TOTWResponse{
		ID:            totw.ID,
		CompetitionID: totw.CompetitionID,
		EventDayID:    totw.EventDayID,
		WeekTitle:     totw.WeekTitle,
		Headline:      totw.Headline,
		SubHeadline:   totw.SubHeadline,
		IsPublished:   totw.IsPublished,
		PublishedAt:   totw.PublishedAt,
		CreatedAt:     totw.CreatedAt,
		UpdatedAt:     totw.UpdatedAt,
	}

	if totw.Competition != nil {
		resp.Competition = &dto.CompetitionResponse{
			ID:   totw.Competition.ID,
			Name: totw.Competition.Name,
			Logo: totw.Competition.Logo,
		}
	}

	resp.Players = make([]dto.TOTWPlayerResponse, len(totw.Players))
	for i, p := range totw.Players {
		pResp := dto.TOTWPlayerResponse{
			ID:           p.ID,
			TOTWID:       p.TOTWID,
			PlayerID:     p.PlayerID,
			SlotCode:     p.SlotCode,
			Position:     p.Position,
			Unit:         p.Unit,
			CoordX:       p.CoordX,
			CoordY:       p.CoordY,
			Rating:       p.Rating,
			Stat1Value:   p.Stat1Value,
			Stat1Label:   p.Stat1Label,
			Stat2Value:   p.Stat2Value,
			Stat2Label:   p.Stat2Label,
			Stat3Value:   p.Stat3Value,
			Stat3Label:   p.Stat3Label,
			DisplayOrder: p.DisplayOrder,
		}
		if p.Player != nil {
			pResp.Player = &dto.PlayerResponse{
				ID:           p.Player.ID,
				Name:         p.Player.Name,
				JerseyNumber: p.Player.JerseyNumber,
				Position:     p.Player.Position,
				Image:        p.Player.Image,
			}
			if p.Player.Team != nil {
				pResp.Player.Team = &dto.TeamResponse{
					ID:        p.Player.Team.ID,
					Name:      p.Player.Team.Name,
					ShortName: p.Player.Team.ShortName,
					Logo:      p.Player.Team.Logo,
				}
			}
		}
		resp.Players[i] = pResp
	}

	return resp
}

func normalizeTOTWSlot(slot string) string {
	s := strings.ToUpper(strings.TrimSpace(slot))
	s = strings.ReplaceAll(s, "-", "_")
	s = strings.ReplaceAll(s, " ", "_")
	return s
}

// defaultCoordX provides coordinates for the Starting XIV matching Showtime_Team_of_the_Week_UI.html and AdminTOTW
func defaultCoordX(slot string) string {
	switch normalizeTOTWSlot(slot) {
	case "S1", "DEF_S1":
		return "32%"
	case "S2", "DEF_S2":
		return "68%"
	case "R", "DEF_R", "RUSH", "RUSHER":
		return "50%"
	case "DEF1", "DEF_1":
		return "18%"
	case "DEF2", "DEF_2":
		return "34%"
	case "DEF3", "DEF_3":
		return "66%"
	case "DEF4", "DEF_4":
		return "82%"
	case "C", "OFF_C", "CENTER":
		return "50%"
	case "WR1", "WR_1", "OFF_WR1", "OFF_WR_1":
		return "14%"
	case "WR2", "WR_2", "OFF_WR2", "OFF_WR_2":
		return "86%"
	case "WR3", "WR_3", "OFF_WR3", "OFF_WR_3":
		return "28%"
	case "WR4", "WR_4", "OFF_WR4", "OFF_WR_4":
		return "72%"
	case "FQB", "OFF_FQB", "OFF_FQB_RB", "FEMALE_QB":
		return "32%"
	case "QB", "OFF_QB", "MALE_QB":
		return "50%"
	default:
		return "50%"
	}
}

// defaultCoordY provides coordinates for the Starting XIV matching Showtime_Team_of_the_Week_UI.html and AdminTOTW
func defaultCoordY(slot string) string {
	switch normalizeTOTWSlot(slot) {
	case "S1", "DEF_S1":
		return "20%"
	case "S2", "DEF_S2":
		return "20%"
	case "R", "DEF_R", "RUSH", "RUSHER":
		return "44%"
	case "DEF1", "DEF_1":
		return "40%"
	case "DEF2", "DEF_2":
		return "38%"
	case "DEF3", "DEF_3":
		return "38%"
	case "DEF4", "DEF_4":
		return "40%"
	case "C", "OFF_C", "CENTER":
		return "68%"
	case "WR1", "WR_1", "OFF_WR1", "OFF_WR_1":
		return "68%"
	case "WR2", "WR_2", "OFF_WR2", "OFF_WR_2":
		return "68%"
	case "WR3", "WR_3", "OFF_WR3", "OFF_WR_3":
		return "56%"
	case "WR4", "WR_4", "OFF_WR4", "OFF_WR_4":
		return "56%"
	case "FQB", "OFF_FQB", "OFF_FQB_RB", "FEMALE_QB":
		return "86%"
	case "QB", "OFF_QB", "MALE_QB":
		return "86%"
	default:
		return "50%"
	}
}
