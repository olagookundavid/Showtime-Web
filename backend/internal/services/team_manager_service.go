package services

import (
	"context"
	"fmt"
	"showtime-backend/internal/domain"
	"showtime-backend/internal/ports"
)

type ITeamManagerService interface {
	AssignManager(ctx context.Context, userID, teamID string) error
	RemoveManager(ctx context.Context, userID string) error
	GetManagerByUserID(ctx context.Context, userID string) (*domain.TeamManager, error)
	GetManagersByTeamID(ctx context.Context, teamID string) ([]domain.TeamManager, error)
}

type TeamManagerService struct {
	tmRepo   ports.ITeamManagerRepository
	authRepo ports.IAuthRepository
}

func NewTeamManagerService(tmRepo ports.ITeamManagerRepository, authRepo ports.IAuthRepository) ITeamManagerService {
	return &TeamManagerService{tmRepo: tmRepo, authRepo: authRepo}
}

func (s *TeamManagerService) AssignManager(ctx context.Context, userID, teamID string) error {
	// Verify the user exists and has team_head role
	user, err := s.authRepo.GetUserByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("user not found")
	}
	if user.Role != "team_head" && user.Role != "admin" {
		return fmt.Errorf("user must have team_head or admin role to be a team manager")
	}

	return s.tmRepo.AssignManager(ctx, userID, teamID)
}

func (s *TeamManagerService) RemoveManager(ctx context.Context, userID string) error {
	return s.tmRepo.RemoveManager(ctx, userID)
}

func (s *TeamManagerService) GetManagerByUserID(ctx context.Context, userID string) (*domain.TeamManager, error) {
	return s.tmRepo.GetManagerByUserID(ctx, userID)
}

func (s *TeamManagerService) GetManagersByTeamID(ctx context.Context, teamID string) ([]domain.TeamManager, error) {
	return s.tmRepo.GetManagersByTeamID(ctx, teamID)
}
