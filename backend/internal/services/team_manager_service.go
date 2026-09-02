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
	ListTeamHeadCandidates(ctx context.Context) ([]domain.TeamHeadCandidate, error)
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

	// A team_head can only manage one team at a time (DB UNIQUE(user_id)); the
	// repo's INSERT ... ON CONFLICT would otherwise silently MOVE them from
	// their current team with no warning. Block it here with a message an
	// admin can act on instead.
	existingTeamID, existingTeamName, found, err := s.tmRepo.GetManagerAssignment(ctx, userID)
	if err != nil {
		return err
	}
	if found && existingTeamID != teamID {
		return fmt.Errorf("this is the manager of %s — remove them from that team first", existingTeamName)
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

func (s *TeamManagerService) ListTeamHeadCandidates(ctx context.Context) ([]domain.TeamHeadCandidate, error) {
	return s.tmRepo.ListTeamHeadCandidates(ctx)
}
