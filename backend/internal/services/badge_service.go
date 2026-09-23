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

type IBadgeService interface {
	ListBadges(ctx context.Context) ([]dto.BadgeResponse, error)
	GetBadgeByID(ctx context.Context, id string) (*dto.BadgeResponse, error)
	CreateBadge(ctx context.Context, req dto.CreateBadgeRequest) (*dto.BadgeResponse, error)
	UpdateBadge(ctx context.Context, id string, req dto.UpdateBadgeRequest) (*dto.BadgeResponse, error)
	DeleteBadge(ctx context.Context, id string) error
	GetPlayerBadges(ctx context.Context, playerID string) ([]dto.PlayerBadgeResponse, error)
	AwardBadge(ctx context.Context, req dto.AwardBadgeRequest, awardedBy *string) (*dto.PlayerBadgeResponse, error)
	DeleteAward(ctx context.Context, awardID string) error
	BackfillMVPBadges(ctx context.Context) (int, error)
	SyncPlayerMVPBadge(ctx context.Context, playerID string) error
	SyncTOTWBadges(ctx context.Context, totw *domain.TeamOfTheWeek) error
	HandleTOTWDeleted(ctx context.Context, totwID string) error
	ListAwards(ctx context.Context, badgeID, playerID string, page, limit int) ([]dto.PlayerBadgeAwardResponse, int64, error)
}

type BadgeService struct {
	badgeRepo ports.BadgeRepository
}

func NewBadgeService(badgeRepo ports.BadgeRepository) *BadgeService {
	return &BadgeService{badgeRepo: badgeRepo}
}

func (s *BadgeService) ListBadges(ctx context.Context) ([]dto.BadgeResponse, error) {
	badges, err := s.badgeRepo.ListBadges(ctx)
	if err != nil {
		return nil, err
	}
	res := make([]dto.BadgeResponse, len(badges))
	for i, b := range badges {
		res[i] = dto.BadgeResponse{
			ID:          b.ID,
			Code:        b.Code,
			Name:        b.Name,
			Description: b.Description,
			Icon:        b.Icon,
			Category:    b.Category,
			ColorScheme: b.ColorScheme,
			IsSystem:    b.IsSystem,
			CreatedAt:   b.CreatedAt,
			UpdatedAt:   b.UpdatedAt,
		}
	}
	return res, nil
}

func (s *BadgeService) GetBadgeByID(ctx context.Context, id string) (*dto.BadgeResponse, error) {
	b, err := s.badgeRepo.GetBadgeByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return &dto.BadgeResponse{
		ID:          b.ID,
		Code:        b.Code,
		Name:        b.Name,
		Description: b.Description,
		Icon:        b.Icon,
		Category:    b.Category,
		ColorScheme: b.ColorScheme,
		IsSystem:    b.IsSystem,
		CreatedAt:   b.CreatedAt,
		UpdatedAt:   b.UpdatedAt,
	}, nil
}

func (s *BadgeService) CreateBadge(ctx context.Context, req dto.CreateBadgeRequest) (*dto.BadgeResponse, error) {
	code := strings.ToUpper(strings.TrimSpace(req.Code))
	if code == "" {
		return nil, fmt.Errorf("badge code is required")
	}

	badge := &domain.Badge{
		Code:        code,
		Name:        strings.TrimSpace(req.Name),
		Description: req.Description,
		Icon:        req.Icon,
		Category:    req.Category,
		ColorScheme: req.ColorScheme,
		IsSystem:    false,
	}
	if badge.Icon == "" {
		badge.Icon = "🏆"
	}
	if badge.Category == "" {
		badge.Category = "Honor"
	}
	if badge.ColorScheme == "" {
		badge.ColorScheme = "gold"
	}

	err := s.badgeRepo.CreateBadge(ctx, badge)
	if err != nil {
		return nil, err
	}

	return &dto.BadgeResponse{
		ID:          badge.ID,
		Code:        badge.Code,
		Name:        badge.Name,
		Description: badge.Description,
		Icon:        badge.Icon,
		Category:    badge.Category,
		ColorScheme: badge.ColorScheme,
		IsSystem:    badge.IsSystem,
		CreatedAt:   badge.CreatedAt,
		UpdatedAt:   badge.UpdatedAt,
	}, nil
}

func (s *BadgeService) UpdateBadge(ctx context.Context, id string, req dto.UpdateBadgeRequest) (*dto.BadgeResponse, error) {
	badge, err := s.badgeRepo.GetBadgeByID(ctx, id)
	if err != nil {
		return nil, err
	}

	badge.Name = strings.TrimSpace(req.Name)
	badge.Description = req.Description
	if req.Icon != "" {
		badge.Icon = req.Icon
	}
	if req.Category != "" {
		badge.Category = req.Category
	}
	if req.ColorScheme != "" {
		badge.ColorScheme = req.ColorScheme
	}

	err = s.badgeRepo.UpdateBadge(ctx, badge)
	if err != nil {
		return nil, err
	}

	return &dto.BadgeResponse{
		ID:          badge.ID,
		Code:        badge.Code,
		Name:        badge.Name,
		Description: badge.Description,
		Icon:        badge.Icon,
		Category:    badge.Category,
		ColorScheme: badge.ColorScheme,
		IsSystem:    badge.IsSystem,
		CreatedAt:   badge.CreatedAt,
		UpdatedAt:   badge.UpdatedAt,
	}, nil
}

func (s *BadgeService) DeleteBadge(ctx context.Context, id string) error {
	return s.badgeRepo.DeleteBadge(ctx, id)
}

func (s *BadgeService) GetPlayerBadges(ctx context.Context, playerID string) ([]dto.PlayerBadgeResponse, error) {
	badges, err := s.badgeRepo.GetPlayerBadges(ctx, playerID)
	if err != nil {
		return nil, err
	}

	res := make([]dto.PlayerBadgeResponse, len(badges))
	for i, pb := range badges {
		bResp := dto.PlayerBadgeResponse{
			ID:            pb.ID,
			PlayerID:      pb.PlayerID,
			BadgeID:       pb.BadgeID,
			Count:         pb.Count,
			LastAwardedAt: pb.LastAwardedAt,
		}
		if pb.Badge != nil {
			bResp.Code = pb.Badge.Code
			bResp.Name = pb.Badge.Name
			bResp.Description = pb.Badge.Description
			bResp.Icon = pb.Badge.Icon
			bResp.Category = pb.Badge.Category
			bResp.ColorScheme = pb.Badge.ColorScheme
		}
		for _, a := range pb.Awards {
			bResp.Awards = append(bResp.Awards, dto.PlayerBadgeAwardResponse{
				ID:            a.ID,
				PlayerID:      a.PlayerID,
				BadgeID:       a.BadgeID,
				CompetitionID: a.CompetitionID,
				SeasonID:      a.SeasonID,
				MatchID:       a.MatchID,
				TOTWID:        a.TOTWID,
				Reason:        a.Reason,
				Count:         a.Count,
				AwardedBy:     a.AwardedBy,
				CreatedAt:     a.CreatedAt,
			})
		}
		res[i] = bResp
	}

	return res, nil
}

func (s *BadgeService) AwardBadge(ctx context.Context, req dto.AwardBadgeRequest, awardedBy *string) (*dto.PlayerBadgeResponse, error) {
	inc := 1
	if req.Increment != nil && *req.Increment > 0 {
		inc = *req.Increment
	}

	// A manual MVP award tied to a match would be deleted by the MVP sync the
	// next time that match is saved; the match's own MVP field is the source.
	if req.MatchID != nil && *req.MatchID != "" {
		if mvp, err := s.badgeRepo.GetBadgeByCode(ctx, "MVP"); err == nil && mvp.ID == req.BadgeID {
			return nil, fmt.Errorf("set the MVP on the match itself instead of awarding it manually")
		}
	}

	award := &domain.PlayerBadgeAward{
		PlayerID:      req.PlayerID,
		BadgeID:       req.BadgeID,
		CompetitionID: req.CompetitionID,
		SeasonID:      req.SeasonID,
		MatchID:       req.MatchID,
		Reason:        req.Reason,
		Count:         inc,
		AwardedBy:     awardedBy,
	}

	pb, err := s.badgeRepo.AwardBadge(ctx, award, inc)
	if err != nil {
		return nil, err
	}

	badge, _ := s.badgeRepo.GetBadgeByID(ctx, req.BadgeID)
	resp := &dto.PlayerBadgeResponse{
		ID:            pb.ID,
		PlayerID:      pb.PlayerID,
		BadgeID:       pb.BadgeID,
		Count:         pb.Count,
		LastAwardedAt: pb.LastAwardedAt,
	}
	if badge != nil {
		resp.Code = badge.Code
		resp.Name = badge.Name
		resp.Description = badge.Description
		resp.Icon = badge.Icon
		resp.Category = badge.Category
		resp.ColorScheme = badge.ColorScheme
	}
	return resp, nil
}

func (s *BadgeService) DeleteAward(ctx context.Context, awardID string) error {
	return s.badgeRepo.DeleteAward(ctx, awardID)
}

func (s *BadgeService) BackfillMVPBadges(ctx context.Context) (int, error) {
	return s.badgeRepo.BackfillAllMVPBadges(ctx)
}

func (s *BadgeService) SyncPlayerMVPBadge(ctx context.Context, playerID string) error {
	return s.badgeRepo.SyncPlayerMVPBadge(ctx, playerID)
}

func (s *BadgeService) SyncTOTWBadges(ctx context.Context, totw *domain.TeamOfTheWeek) error {
	if totw == nil {
		return nil
	}

	totwBadge, err := s.badgeRepo.GetBadgeByCode(ctx, "TOTW")
	if err != nil {
		return err
	}

	affectedPlayers := make(map[string]bool)

	if !totw.IsPublished {
		// If unpublished: remove all awards associated with this totw edition
		removedIDs, err := s.badgeRepo.DeleteTOTWAwards(ctx, totw.ID, nil)
		if err != nil {
			log.Printf("[ERROR] totw badges: remove awards for unpublished totw %s: %v", totw.ID, err)
		}
		for _, pid := range removedIDs {
			affectedPlayers[pid] = true
		}
		for _, tp := range totw.Players {
			affectedPlayers[tp.PlayerID] = true
		}
	} else {
		// If published:
		currentIDs := make([]string, len(totw.Players))
		for i, tp := range totw.Players {
			currentIDs[i] = tp.PlayerID
			affectedPlayers[tp.PlayerID] = true
		}

		// Remove awards for players who were removed from this TOTW
		removedIDs, err := s.badgeRepo.DeleteTOTWAwards(ctx, totw.ID, currentIDs)
		if err != nil {
			log.Printf("[ERROR] totw badges: remove awards for dropped players in totw %s: %v", totw.ID, err)
		}
		for _, pid := range removedIDs {
			affectedPlayers[pid] = true
		}

		// Ensure award exists for all current players
		for _, tp := range totw.Players {
			award := &domain.PlayerBadgeAward{
				PlayerID:      tp.PlayerID,
				BadgeID:       totwBadge.ID,
				CompetitionID: &totw.CompetitionID,
				TOTWID:        &totw.ID,
				Reason:        fmt.Sprintf("Team of the Week selection (%s - %s)", totw.WeekTitle, tp.Position),
				AwardedBy:     totw.CreatedBy,
			}
			if err := s.badgeRepo.EnsureTOTWAward(ctx, award); err != nil {
				log.Printf("[ERROR] totw badges: award player %s for totw %s: %v", tp.PlayerID, totw.ID, err)
			}
		}
	}

	// Recount badge counts for all affected players
	for pid := range affectedPlayers {
		if err := s.badgeRepo.SyncTOTWBadgeForPlayer(ctx, pid); err != nil {
			log.Printf("[ERROR] totw badges: recount player %s: %v", pid, err)
		}
	}

	return nil
}

func (s *BadgeService) HandleTOTWDeleted(ctx context.Context, totwID string) error {
	removedIDs, err := s.badgeRepo.DeleteTOTWAwards(ctx, totwID, nil)
	if err != nil {
		return err
	}
	for _, pid := range removedIDs {
		if err := s.badgeRepo.SyncTOTWBadgeForPlayer(ctx, pid); err != nil {
			log.Printf("[ERROR] totw badges: recount player %s after totw %s delete: %v", pid, totwID, err)
		}
	}
	return nil
}

func (s *BadgeService) ListAwards(ctx context.Context, badgeID, playerID string, page, limit int) ([]dto.PlayerBadgeAwardResponse, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	offset := (page - 1) * limit

	awards, total, err := s.badgeRepo.ListAwards(ctx, badgeID, playerID, limit, offset)
	if err != nil {
		return nil, 0, err
	}

	res := make([]dto.PlayerBadgeAwardResponse, len(awards))
	for i, a := range awards {
		res[i] = dto.PlayerBadgeAwardResponse{
			ID:              a.ID,
			PlayerID:        a.PlayerID,
			BadgeID:         a.BadgeID,
			CompetitionID:   a.CompetitionID,
			SeasonID:        a.SeasonID,
			MatchID:         a.MatchID,
			TOTWID:          a.TOTWID,
			Reason:          a.Reason,
			Count:           a.Count,
			AwardedBy:       a.AwardedBy,
			CreatedAt:       a.CreatedAt,
			CompetitionName: a.CompetitionName,
		}
		if a.Badge != nil {
			res[i].Badge = &dto.BadgeResponse{
				ID:          a.Badge.ID,
				Code:        a.Badge.Code,
				Name:        a.Badge.Name,
				Description: a.Badge.Description,
				Icon:        a.Badge.Icon,
				Category:    a.Badge.Category,
				ColorScheme: a.Badge.ColorScheme,
				IsSystem:    a.Badge.IsSystem,
				CreatedAt:   a.Badge.CreatedAt,
				UpdatedAt:   a.Badge.UpdatedAt,
			}
		}
		if a.Player != nil {
			pResp := dto.PlayerResponse{
				ID:           a.Player.ID,
				Name:         a.Player.Name,
				JerseyNumber: a.Player.JerseyNumber,
				Position:     a.Player.Position,
				Image:        a.Player.Image,
			}
			if a.Player.Team != nil {
				pResp.Team = &dto.TeamResponse{
					Name: a.Player.Team.Name,
				}
			}
			res[i].Player = &pResp
		}
	}
	return res, total, nil
}
