package services

import (
	"context"
	"fmt"
	"pkg-common/logger"
	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

type IPlayerService interface {
	GetPlayers(ctx context.Context, teamID string, search string, page, limit int, rosterStatus string) (dto.PaginatedResult[dto.PlayerResponse], error)
	GetPlayerByID(ctx context.Context, id string) (*dto.PlayerResponse, error)
	CreatePlayer(ctx context.Context, player *domain.Player) error
	UpdatePlayer(ctx context.Context, player *domain.Player) error
	DeletePlayer(ctx context.Context, id string) error
	RestorePlayer(ctx context.Context, id string) error
	AssignRandomJerseyNumbers(ctx context.Context, teamID string) (int, error)
	MovePlayerToReserve(ctx context.Context, teamID, playerID string) error
	GraduatePlayerFromReserve(ctx context.Context, teamID, playerID string) error
	GetTeamRosterSummary(ctx context.Context, teamID string) (*dto.RosterSummaryResponse, error)
}

type PlayerService struct {
	repo    ports.PlayerRepository
	storage ports.StorageService
}

func NewPlayerService(repo ports.PlayerRepository, storage ports.StorageService) IPlayerService {
	return &PlayerService{repo: repo, storage: storage}
}

func (s *PlayerService) GetPlayers(ctx context.Context, teamID string, search string, page, limit int, rosterStatus string) (dto.PaginatedResult[dto.PlayerResponse], error) {
	players, total, err := s.repo.GetPlayers(ctx, teamID, search, page, limit, rosterStatus)
	if err != nil {
		return dto.PaginatedResult[dto.PlayerResponse]{}, err
	}

	res := make([]dto.PlayerResponse, 0, len(players))
	for _, p := range players {
		pr := dto.PlayerResponse{
			ID:           p.ID,
			Name:         p.Name,
			JerseyNumber: p.JerseyNumber,
			Position:     p.Position,
			Gender:       p.Gender,
			Bio:          p.Bio,
			Image:        p.Image,
			Email:        p.Email,
			Status:       p.Status,
			IsReserve:    p.IsReserve,
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

	totalPages := 0
	if limit > 0 {
		totalPages = int((total + int64(limit) - 1) / int64(limit))
	}

	return dto.PaginatedResult[dto.PlayerResponse]{
		Data:       res,
		Total:      int(total),
		Page:       page,
		Limit:      limit,
		TotalPages: totalPages,
	}, nil
}

func (s *PlayerService) GetPlayerByID(ctx context.Context, id string) (*dto.PlayerResponse, error) {
	p, err := s.repo.GetPlayerByID(ctx, id)
	if err != nil {
		return nil, err
	}

	pr := &dto.PlayerResponse{
		ID:           p.ID,
		Name:         p.Name,
		JerseyNumber: p.JerseyNumber,
		Position:     p.Position,
		Gender:       p.Gender,
		Bio:          p.Bio,
		Image:        p.Image,
		Email:        p.Email,
		Status:       p.Status,
		IsReserve:    p.IsReserve,
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
	if player.TeamID != "" {
		mainCount, err := s.repo.GetMainPlayerCount(ctx, player.TeamID)
		if err == nil && mainCount >= 25 {
			return fmt.Errorf("cannot add player: team already has %d main players (max 25). Team must move active players to reserves or release players first", mainCount)
		}
	}
	return s.repo.CreatePlayer(ctx, player)
}

func (s *PlayerService) MovePlayerToReserve(ctx context.Context, teamID, playerID string) error {
	return s.repo.MovePlayerToReserve(ctx, teamID, playerID)
}

func (s *PlayerService) GraduatePlayerFromReserve(ctx context.Context, teamID, playerID string) error {
	return s.repo.GraduatePlayerFromReserve(ctx, teamID, playerID)
}

func (s *PlayerService) GetTeamRosterSummary(ctx context.Context, teamID string) (*dto.RosterSummaryResponse, error) {
	return s.repo.GetTeamRosterSummary(ctx, teamID)
}

func (s *PlayerService) UpdatePlayer(ctx context.Context, player *domain.Player) error {
	if s.storage != nil {
		existing, err := s.repo.GetPlayerByID(ctx, player.ID)
		if err == nil && existing != nil && existing.Image != "" && existing.Image != player.Image {
			oldImage := existing.Image
			log := logger.GetSingletonLogger()
			log.Info("Scheduling background delete of old player image", map[string]any{"old_url": oldImage})
			if jobErr := SubmitJob(func() {
				if delErr := s.storage.DeleteObject(context.Background(), oldImage); delErr != nil {
					logger.GetSingletonLogger().Error("Failed to delete old player image", map[string]any{"url": oldImage, "error": delErr.Error()})
				} else {
					logger.GetSingletonLogger().Info("Deleted old player image from R2", map[string]any{"url": oldImage})
				}
			}); jobErr != nil {
				log.Error(fmt.Sprintf("Failed to submit delete job for player image: %v", jobErr), nil)
			}
		}
	}
	return s.repo.UpdatePlayer(ctx, player)
}

// DeletePlayer deactivates a player. The row, its id and its whole history stay
// put; the player simply stops appearing anywhere current.
//
// The image is deliberately left in R2. It used to be scheduled for deletion
// here, which made sense when the record was going away, but a deactivated
// player still shows up in last season's results and on their own profile page,
// and a broken portrait on a historical page is worse than an unused object in
// a bucket. Reactivating cannot un-delete an image either, so removing it made
// the operation quietly irreversible.
func (s *PlayerService) DeletePlayer(ctx context.Context, id string) error {
	return s.repo.DeletePlayer(ctx, id)
}

// RestorePlayer reactivates a player deactivated by DeletePlayer.
func (s *PlayerService) RestorePlayer(ctx context.Context, id string) error {
	return s.repo.RestorePlayer(ctx, id)
}

func (s *PlayerService) AssignRandomJerseyNumbers(ctx context.Context, teamID string) (int, error) {
	return s.repo.AssignRandomJerseyNumbers(ctx, teamID)
}

