package services

import (
	"context"
	"fmt"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

type IContractService interface {
	IssueContract(ctx context.Context, managerUserID string, teamID string, req dto.IssueContractRequest) (*dto.ContractResponse, error)
	RespondToContract(ctx context.Context, contractID string, userID string, action string, notes string) error
	RenewContract(ctx context.Context, contractID string, managerUserID string, managerTeamID string, req dto.RenewContractRequest) (*dto.ContractResponse, error)
	ReleasePlayer(ctx context.Context, contractID string, managerUserID string, managerTeamID string) error
	GetTeamContracts(ctx context.Context, teamID string, status string, page, limit int) (dto.PaginatedResult[dto.ContractResponse], error)
	GetMyContracts(ctx context.Context, userID string) ([]dto.ContractResponse, error)
	GetFreeAgents(ctx context.Context, search string, page, limit int) (dto.PaginatedResult[dto.PlayerResponse], error)
	GetContractByID(ctx context.Context, id string) (*dto.ContractResponse, error)
	CheckAndExpireContracts(ctx context.Context, teamIDs ...string) (int, error)
	AdminOverrideContract(ctx context.Context, id string, status string, reason string) error
}

type ContractService struct {
	repo         ports.IContractRepository
	playerRepo   ports.PlayerRepository
	notifService INotificationService
}

func NewContractService(repo ports.IContractRepository, playerRepo ports.PlayerRepository, notifService INotificationService) IContractService {
	return &ContractService{
		repo:         repo,
		playerRepo:   playerRepo,
		notifService: notifService,
	}
}

func (s *ContractService) IssueContract(ctx context.Context, managerUserID string, teamID string, req dto.IssueContractRequest) (*dto.ContractResponse, error) {
	// Verify player exists
	player, err := s.playerRepo.GetPlayerByID(ctx, req.PlayerID)
	if err != nil || player == nil {
		return nil, fmt.Errorf("player not found")
	}

	// Verify no active contract exists for player
	active, _ := s.repo.GetActiveContractByPlayerID(ctx, req.PlayerID)
	if active != nil {
		return nil, fmt.Errorf("player already has an active contract with team %s", active.TeamID)
	}

	contractLength := 13
	if req.ContractLength != nil && *req.ContractLength > 0 {
		contractLength = *req.ContractLength
	}

	playerValue := int64(1000000)
	if req.PlayerValue != nil && *req.PlayerValue > 0 {
		playerValue = *req.PlayerValue
	}

	matchesAtStart, _ := s.repo.GetTeamFinishedMatchCount(ctx, teamID)

	c := &domain.Contract{
		PlayerID:       req.PlayerID,
		TeamID:         teamID,
		Status:         "PENDING",
		ContractLength: contractLength,
		MatchesAtStart: matchesAtStart,
		PlayerValue:    playerValue,
		OfferedBy:      managerUserID,
		Notes:          req.Notes,
	}

	if err := s.repo.CreateContract(ctx, c); err != nil {
		return nil, fmt.Errorf("failed to issue contract: %w", err)
	}

	// Send notification if player has user_id
	if player.UserID != nil && *player.UserID != "" {
		msg := fmt.Sprintf("You have received a new contract offer of %d games.", contractLength)
		refID := c.ID
		_ = s.notifService.Send(ctx, *player.UserID, "CONTRACT_OFFER", "New Contract Offer", msg, "contract", &refID)
	}

	return s.GetContractByID(ctx, c.ID)
}

func (s *ContractService) RespondToContract(ctx context.Context, contractID string, userID string, action string, notes string) error {
	contract, err := s.repo.GetContractByID(ctx, contractID)
	if err != nil || contract == nil {
		return fmt.Errorf("contract not found")
	}

	if contract.Status != "PENDING" {
		return fmt.Errorf("contract is no longer pending (current status: %s)", contract.Status)
	}

	// Verify user is linked to the player
	player, err := s.playerRepo.GetPlayerByID(ctx, contract.PlayerID)
	if err != nil || player == nil {
		return fmt.Errorf("player not found")
	}

	if player.UserID == nil || *player.UserID != userID {
		return fmt.Errorf("forbidden: contract offer is not addressed to you")
	}

	now := time.Now()
	if action == "accept" {
		// Check for existing active contract
		active, _ := s.repo.GetActiveContractByPlayerID(ctx, contract.PlayerID)
		if active != nil {
			if active.TeamID != contract.TeamID {
				return fmt.Errorf("you already have an active contract with another team")
			}
			// Same-team renewal/extension: terminate previous active contract
			_ = s.repo.UpdateContractStatus(ctx, active.ID, "TERMINATED", "RENEWED", nil, nil, &now)
		}

		// Snapshot team match count at activation time
		matchesAtStart, _ := s.repo.GetTeamFinishedMatchCount(ctx, contract.TeamID)
		contract.MatchesAtStart = matchesAtStart

		err = s.repo.UpdateContractStatus(ctx, contractID, "ACTIVE", "", &now, nil, nil)
		if err != nil {
			return err
		}

		// Update player's team_id
		player.TeamID = contract.TeamID
		_ = s.playerRepo.UpdatePlayer(ctx, player)

		// Send notification to offering manager
		msg := fmt.Sprintf("Player %s accepted your contract offer.", player.Name)
		refID := contractID
		_ = s.notifService.Send(ctx, contract.OfferedBy, "CONTRACT_ACCEPTED", "Contract Accepted", msg, "contract", &refID)

		return nil
	} else if action == "reject" {
		err = s.repo.UpdateContractStatus(ctx, contractID, "REJECTED", "", nil, nil, nil)
		if err != nil {
			return err
		}

		msg := fmt.Sprintf("Player %s rejected your contract offer.", player.Name)
		refID := contractID
		_ = s.notifService.Send(ctx, contract.OfferedBy, "CONTRACT_REJECTED", "Contract Rejected", msg, "contract", &refID)
		return nil
	}

	return fmt.Errorf("invalid action: must be accept or reject")
}

func (s *ContractService) RenewContract(ctx context.Context, contractID string, managerUserID string, managerTeamID string, req dto.RenewContractRequest) (*dto.ContractResponse, error) {
	current, err := s.repo.GetContractByID(ctx, contractID)
	if err != nil || current == nil {
		return nil, fmt.Errorf("contract not found")
	}

	if managerTeamID != "" && current.TeamID != managerTeamID {
		return nil, fmt.Errorf("forbidden: contract does not belong to your team")
	}

	if current.Status != "ACTIVE" {
		return nil, fmt.Errorf("can only extend or renew an ACTIVE contract")
	}

	contractLength := current.ContractLength
	if req.ContractLength != nil && *req.ContractLength > 0 {
		contractLength = *req.ContractLength
	}

	playerValue := current.PlayerValue
	if req.PlayerValue != nil && *req.PlayerValue > 0 {
		playerValue = *req.PlayerValue
	}

	matchesAtStart, _ := s.repo.GetTeamFinishedMatchCount(ctx, current.TeamID)

	newContract := &domain.Contract{
		PlayerID:       current.PlayerID,
		TeamID:         current.TeamID,
		Status:         "PENDING",
		ContractLength: contractLength,
		MatchesAtStart: matchesAtStart,
		PlayerValue:    playerValue,
		OfferedBy:      managerUserID,
		Notes:          "Contract Renewal/Extension",
	}

	if err := s.repo.CreateContract(ctx, newContract); err != nil {
		return nil, fmt.Errorf("failed to create renewal contract: %w", err)
	}

	// Notify player
	player, _ := s.playerRepo.GetPlayerByID(ctx, current.PlayerID)
	if player != nil && player.UserID != nil && *player.UserID != "" {
		msg := fmt.Sprintf("Your team offered a contract extension of %d games at value %d.", contractLength, playerValue)
		refID := newContract.ID
		_ = s.notifService.Send(ctx, *player.UserID, "CONTRACT_OFFER", "Contract Extension Offered", msg, "contract", &refID)
	}

	return s.GetContractByID(ctx, newContract.ID)
}

func (s *ContractService) ReleasePlayer(ctx context.Context, contractID string, managerUserID string, managerTeamID string) error {
	c, err := s.repo.GetContractByID(ctx, contractID)
	if err != nil || c == nil {
		return fmt.Errorf("contract not found")
	}

	if managerTeamID != "" && c.TeamID != managerTeamID {
		return fmt.Errorf("forbidden: contract does not belong to your team")
	}

	if c.Status != "ACTIVE" {
		return fmt.Errorf("can only release a player with an ACTIVE contract")
	}

	now := time.Now()
	if err := s.repo.UpdateContractStatus(ctx, contractID, "TERMINATED", "RELEASED", nil, nil, &now); err != nil {
		return err
	}

	// Clear player team_id and remove from scheduled match team sheets
	player, err := s.playerRepo.GetPlayerByID(ctx, c.PlayerID)
	if err == nil && player != nil {
		oldTeamID := player.TeamID
		player.TeamID = ""
		_ = s.playerRepo.UpdatePlayer(ctx, player)

		if oldTeamID != "" {
			_ = s.repo.RemovePlayerFromScheduledTeamSheets(ctx, player.ID, oldTeamID)
		}

		if player.UserID != nil && *player.UserID != "" {
			msg := "You have been released from your contract and are now a free agent."
			refID := contractID
			_ = s.notifService.Send(ctx, *player.UserID, "PLAYER_RELEASED", "Contract Terminated", msg, "contract", &refID)
		}
	}

	return nil
}

func (s *ContractService) GetTeamContracts(ctx context.Context, teamID string, status string, page, limit int) (dto.PaginatedResult[dto.ContractResponse], error) {
	contracts, total, err := s.repo.GetContractsByTeamID(ctx, teamID, status, page, limit)
	if err != nil {
		return dto.PaginatedResult[dto.ContractResponse]{}, err
	}

	currentMatches, _ := s.repo.GetTeamFinishedMatchCount(ctx, teamID)

	res := make([]dto.ContractResponse, 0, len(contracts))
	for _, c := range contracts {
		res = append(res, s.mapContractToResponse(&c, currentMatches))
	}

	totalPages := 0
	if limit > 0 {
		totalPages = int((total + int64(limit) - 1) / int64(limit))
	}

	return dto.PaginatedResult[dto.ContractResponse]{
		Data:       res,
		Total:      int(total),
		Page:       page,
		Limit:      limit,
		TotalPages: totalPages,
	}, nil
}

func (s *ContractService) GetMyContracts(ctx context.Context, userID string) ([]dto.ContractResponse, error) {
	player, err := s.playerRepo.GetPlayerByUserID(ctx, userID)
	if err != nil || player == nil {
		return []dto.ContractResponse{}, nil
	}

	contracts, err := s.repo.GetContractsByPlayerID(ctx, player.ID)
	if err != nil {
		return nil, err
	}

	res := make([]dto.ContractResponse, 0, len(contracts))
	for _, c := range contracts {
		currentMatches, _ := s.repo.GetTeamFinishedMatchCount(ctx, c.TeamID)
		res = append(res, s.mapContractToResponse(&c, currentMatches))
	}

	return res, nil
}

func (s *ContractService) GetFreeAgents(ctx context.Context, search string, page, limit int) (dto.PaginatedResult[dto.PlayerResponse], error) {
	players, total, err := s.repo.GetFreeAgents(ctx, search, page, limit)
	if err != nil {
		return dto.PaginatedResult[dto.PlayerResponse]{}, err
	}

	res := make([]dto.PlayerResponse, 0, len(players))
	for _, p := range players {
		res = append(res, dto.PlayerResponse{
			ID:           p.ID,
			Name:         p.Name,
			JerseyNumber: p.JerseyNumber,
			Position:     p.Position,
			Bio:          p.Bio,
			Image:        p.Image,
			Email:        p.Email,
		})
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

func (s *ContractService) GetContractByID(ctx context.Context, id string) (*dto.ContractResponse, error) {
	c, err := s.repo.GetContractByID(ctx, id)
	if err != nil || c == nil {
		return nil, fmt.Errorf("contract not found")
	}

	currentMatches, _ := s.repo.GetTeamFinishedMatchCount(ctx, c.TeamID)
	res := s.mapContractToResponse(c, currentMatches)
	return &res, nil
}

func (s *ContractService) CheckAndExpireContracts(ctx context.Context, teamIDs ...string) (int, error) {
	contracts, err := s.repo.GetExpiringContracts(ctx, teamIDs...)
	if err != nil {
		return 0, err
	}

	expiredCount := 0
	now := time.Now()

	for _, c := range contracts {
		currentMatches, err := s.repo.GetTeamFinishedMatchCount(ctx, c.TeamID)
		if err != nil {
			continue
		}

		matchesPlayed := currentMatches - c.MatchesAtStart
		remainingMatches := c.ContractLength - matchesPlayed
		if remainingMatches < 0 {
			remainingMatches = 0
		}

		player, pErr := s.playerRepo.GetPlayerByID(ctx, c.PlayerID)

		// 1. Contract reached/exceeded length -> Expire it
		if remainingMatches <= 0 {
			if err := s.repo.UpdateContractStatus(ctx, c.ID, "EXPIRED", "EXPIRED", nil, &now, nil); err == nil {
				expiredCount++

				// Clear player team_id and remove from scheduled match team sheets
				if pErr == nil && player != nil {
					teamName := ""
					if player.Team != nil {
						teamName = player.Team.Name
					}
					oldTeamID := player.TeamID
					player.TeamID = ""
					_ = s.playerRepo.UpdatePlayer(ctx, player)

					if oldTeamID != "" {
						_ = s.repo.RemovePlayerFromScheduledTeamSheets(ctx, player.ID, oldTeamID)
					}

					if player.UserID != nil && *player.UserID != "" {
						msg := "Your contract has expired. You are now a free agent."
						if teamName != "" {
							msg = fmt.Sprintf("Your contract with %s has expired. You are now a free agent.", teamName)
						}
						refID := c.ID
						_ = s.notifService.Send(ctx, *player.UserID, "CONTRACT_EXPIRED", "Contract Expired", msg, "contract", &refID)
					}

					// Notify manager
					if c.OfferedBy != "" {
						msg := fmt.Sprintf("Player %s's contract has expired. They are now a free agent.", player.Name)
						refID := c.ID
						_ = s.notifService.Send(ctx, c.OfferedBy, "CONTRACT_EXPIRED", "Player Contract Expired", msg, "contract", &refID)
					}
				}

				_ = s.repo.UpdateLastNotifiedRemaining(ctx, c.ID, 0)
			}
			continue
		}

		// 2. Send 3-matches, 2-matches, 1-match remaining notifications (only once per threshold)
		if remainingMatches <= 3 && c.LastNotifiedRemaining != remainingMatches {
			matchText := "matches"
			if remainingMatches == 1 {
				matchText = "match"
			}

			// Notify Player
			if pErr == nil && player != nil && player.UserID != nil && *player.UserID != "" {
				msg := fmt.Sprintf("Your contract has %d %s remaining.", remainingMatches, matchText)
				refID := c.ID
				_ = s.notifService.Send(ctx, *player.UserID, "CONTRACT_WARNING", "Contract Expiring Soon", msg, "contract", &refID)
			}

			// Notify Manager
			if c.OfferedBy != "" && player != nil {
				msg := fmt.Sprintf("Player %s's contract has %d %s remaining.", player.Name, remainingMatches, matchText)
				refID := c.ID
				_ = s.notifService.Send(ctx, c.OfferedBy, "CONTRACT_WARNING", "Player Contract Expiring Soon", msg, "contract", &refID)
			}

			_ = s.repo.UpdateLastNotifiedRemaining(ctx, c.ID, remainingMatches)
		}
	}

	return expiredCount, nil
}

func (s *ContractService) AdminOverrideContract(ctx context.Context, id string, status string, reason string) error {
	now := time.Now()
	var acceptedAt, expiredAt, terminatedAt *time.Time
	if status == "ACTIVE" {
		acceptedAt = &now
	} else if status == "EXPIRED" {
		expiredAt = &now
	} else if status == "TERMINATED" {
		terminatedAt = &now
	}

	err := s.repo.UpdateContractStatus(ctx, id, status, reason, acceptedAt, expiredAt, terminatedAt)
	if err != nil {
		return err
	}

	if status == "EXPIRED" || status == "TERMINATED" {
		c, err := s.repo.GetContractByID(ctx, id)
		if err == nil && c != nil {
			player, pErr := s.playerRepo.GetPlayerByID(ctx, c.PlayerID)
			if pErr == nil && player != nil {
				oldTeamID := player.TeamID
				player.TeamID = ""
				_ = s.playerRepo.UpdatePlayer(ctx, player)
				if oldTeamID != "" {
					_ = s.repo.RemovePlayerFromScheduledTeamSheets(ctx, player.ID, oldTeamID)
				}
			}
		}
	}
	return nil
}

func (s *ContractService) mapContractToResponse(c *domain.Contract, currentTeamMatches int) dto.ContractResponse {
	matchesPlayed := currentTeamMatches - c.MatchesAtStart
	if matchesPlayed < 0 {
		matchesPlayed = 0
	}
	matchesRemaining := c.ContractLength - matchesPlayed
	if matchesRemaining < 0 {
		matchesRemaining = 0
	}

	resp := dto.ContractResponse{
		ID:                c.ID,
		PlayerID:          c.PlayerID,
		TeamID:            c.TeamID,
		Status:            c.Status,
		ContractLength:    c.ContractLength,
		MatchesAtStart:    c.MatchesAtStart,
		MatchesPlayed:     matchesPlayed,
		MatchesRemaining:  matchesRemaining,
		PlayerValue:       c.PlayerValue,
		OfferedBy:         c.OfferedBy,
		OfferedAt:         c.OfferedAt.Format("2006-01-02T15:04:05Z07:00"),
		TerminationReason: c.TerminationReason,
		Notes:             c.Notes,
		CreatedAt:         c.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:         c.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}

	if c.AcceptedAt != nil {
		tStr := c.AcceptedAt.Format("2006-01-02T15:04:05Z07:00")
		resp.AcceptedAt = &tStr
	}
	if c.ExpiredAt != nil {
		tStr := c.ExpiredAt.Format("2006-01-02T15:04:05Z07:00")
		resp.ExpiredAt = &tStr
	}
	if c.TerminatedAt != nil {
		tStr := c.TerminatedAt.Format("2006-01-02T15:04:05Z07:00")
		resp.TerminatedAt = &tStr
	}

	if c.Player != nil {
		resp.Player = &dto.PlayerResponse{
			ID:           c.Player.ID,
			Name:         c.Player.Name,
			JerseyNumber: c.Player.JerseyNumber,
			Position:     c.Player.Position,
			Image:        c.Player.Image,
		}
	}

	if c.Team != nil {
		resp.Team = &dto.TeamResponse{
			ID:        c.Team.ID,
			Name:      c.Team.Name,
			ShortName: c.Team.ShortName,
			Logo:      c.Team.Logo,
		}
	}

	return resp
}
