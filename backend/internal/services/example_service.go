package services

import (
	"context"
	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
	"time"
)

type IExampleService interface {
	CreateExample(ctx context.Context, req dto.InviteRequest) error
	// RevokeExample(ctx context.Context, req dto.EmailRequest) error
	// AcceptExample(ctx context.Context, req dto.RegisterRequest) error
	// ResendExample(ctx context.Context, req dto.EmailRequest) error
}

type ExampleService struct {
	repo ports.ExampleRepository
}

func NewExampleService(
	repo ports.ExampleRepository,
) IExampleService {
	return &ExampleService{
		repo: repo,
	}
}

func (s *ExampleService) CreateExample(ctx context.Context, req dto.InviteRequest) error {

	// inviteTokenDuration, err := time.ParseDuration(os.Getenv("INVITE_TOKEN_DURATION"))
	// if err != nil {
	// 	inviteTokenDuration = time.Hour * 24 * 3
	// }
	inviteTokenDuration := time.Hour * 24 * 3
	// baseUrl := os.Getenv("INVITE_BASE_URL")

	// Check for existing valid example
	// existing, err := s.repo.FindByEmail(ctx, req.Email)
	// if err != nil && !errors.Is(err, appErrors.ErrExampleNotFound) {
	// 	return err
	// }

	// if existing != nil {
	// 	if existing.Status == domain.ExampleValid && existing.ExpiresAt.After(time.Now()) {
	// 		return appErrors.ErrDuplicateExample
	// 	}
	// 	if time.Now().After(existing.ExpiresAt) {
	// 		// Auto-update status if expired
	// 		_ = s.repo.UpdateStatus(ctx, existing.ID, domain.ExampleExpired)
	// 		return fmt.Errorf("example has expired")
	// 	}
	// }

	// token, err := helpers.GenerateToken()
	token := "dummy_token" // placeholder until helpers is available
	// if err != nil {
	// 	return fmt.Errorf("failed to generate token: %w", err)
	// }

	example := &domain.Example{
		Email:     req.Email,
		Token:     token,
		InviterID: req.InviterId,
		Roles:     req.Roles,
		ExpiresAt: time.Now().Add(inviteTokenDuration),
		Status:    domain.ExampleValid,
	}

	if err := s.repo.Create(ctx, example); err != nil {
		return err
	}

	// // Send email in background
	return nil
}

// func (s *InvitationService) RevokeInvitation(ctx context.Context, req dto.EmailRequest) error {
// 	return s.inviteRepo.Revoke(ctx, req.Email)
// }

// func (s *InvitationService) ValidateInvitation(ctx context.Context, req dto.EmailRequest, token, atype string) (*domain.Invitation, error) {

// 	var invitation *domain.Invitation
// 	var err error
// 	if atype == "email" {
// 		invitation, err = s.inviteRepo.FindByEmail(ctx, req.Email)
// 		if err != nil {
// 			return nil, err
// 		}
// 	} else {
// 		invitation, err = s.inviteRepo.FindByToken(ctx, token)
// 		if err != nil {
// 			return nil, err
// 		}
// 	}

// 	// Check status
// 	switch invitation.Status {
// 	case domain.InvitationRevoked:
// 		return nil, fmt.Errorf("invitation has been revoked")
// 	case domain.InvitationUsed:
// 		return nil, fmt.Errorf("invitation has already been used")
// 	}

// 	// Check expiration
// 	if time.Now().After(invitation.ExpiresAt) {
// 		// Auto-update status if expired
// 		_ = s.inviteRepo.UpdateStatus(ctx, invitation.ID, domain.InvitationExpired)
// 		return nil, fmt.Errorf("invitation has expired")
// 	}
// 	return invitation, nil
// }

// func (s *InvitationService) AcceptInvitation(ctx context.Context, req dto.RegisterRequest) error {
// 	// 1. Validate invitation

// 	invitation, err := s.ValidateInvitation(ctx, dto.EmailRequest{}, req.Token, "")
// 	if err != nil {
// 		return err
// 	}

// 	// // 2. Check if email already registered
// 	// existingUser, err := s.userRepo.GetByEmail(ctx, invitation.Email)
// 	// if err != nil && !errors.Is(err, appErrors.ErrInviteNotFound) {
// 	// 	return nil, fmt.Errorf("failed to check user existence: %w", err)
// 	// }
// 	// if existingUser != nil {
// 	// 	return nil, fmt.Errorf("user already exists with this email")
// 	// }

// 	// 3. Create user (implementation depends on your user creation flow)

// 	err = s.userService.Register(ctx, dto.RegisterRequest{
// 		Email:      invitation.Email,
// 		Password:   req.Password,
// 		InviteCode: invitation.InviterID,
// 		Roles:      invitation.Roles,
// 	})
// 	if err != nil {
// 		return err
// 	}

// 	// 4. Mark invitation as used
// 	if err := s.inviteRepo.MarkAsUsed(ctx, req.Token); err != nil {
// 		fmt.Printf("failed to mark invitation as used: %v\n", err)
// 	}

// 	return nil
// }

// func (s *InvitationService) ResendInvitation(ctx context.Context, req dto.EmailRequest) error {

// 	// Check for existing valid invitation
// 	existing, err := s.inviteRepo.FindByEmail(ctx, req.Email)
// 	if err != nil && !errors.Is(err, appErrors.ErrInviteNotFound) {
// 		return err
// 	}

// 	if existing == nil {
// 		return fmt.Errorf("no valid invitation for this user")
// 	}

// 	if existing.Status == domain.InvitationUsed {
// 		return fmt.Errorf("invitation has been used")
// 	}
// 	if time.Now().After(existing.ExpiresAt) {
// 		// Auto-update status if expired
// 		_ = s.inviteRepo.UpdateStatus(ctx, existing.ID, domain.InvitationExpired)
// 		return fmt.Errorf("invitation has expired")
// 	}

// 	// // Send email in background
// 	return nil
// }
