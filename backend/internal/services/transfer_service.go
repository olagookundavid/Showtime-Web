package services

import (
	"context"
	"fmt"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

type ITransferService interface {
	CreateTransferRequest(ctx context.Context, managerUserID string, fromTeamID string, req dto.CreateTransferRequestDTO) (*dto.TransferResponse, error)
	CreatePlayerListing(ctx context.Context, managerUserID string, teamID string, req dto.CreatePlayerListingDTO) (*dto.TransferResponse, error)
	CreateDirectSale(ctx context.Context, managerUserID string, fromTeamID string, req dto.CreateDirectSaleDTO) (*dto.TransferResponse, error)
	RespondToTransfer(ctx context.Context, transferID string, managerUserID string, teamID string, req dto.TransferActionDTO) (*dto.TransferResponse, error)
	PlaceBid(ctx context.Context, transferID string, managerUserID string, bidderTeamID string, req dto.CreateBidDTO) (*dto.BidResponse, error)
	RespondToBid(ctx context.Context, transferID string, bidID string, managerUserID string, sellerTeamID string, action string) error
	GetMarketListings(ctx context.Context, search string, page, limit int) (dto.PaginatedResult[dto.TransferResponse], error)
	GetTeamTransfers(ctx context.Context, teamID string, transferType string, status string, page, limit int) (dto.PaginatedResult[dto.TransferResponse], error)
	GetPlayerTransfers(ctx context.Context, playerID string, page, limit int) (dto.PaginatedResult[dto.TransferResponse], error)
	GetTransferByID(ctx context.Context, id string) (*dto.TransferResponse, error)
	GetTeamBudget(ctx context.Context, teamID string) (*dto.TeamBudgetResponse, error)
	GetAllTeamBudgets(ctx context.Context) ([]dto.TeamBudgetResponse, error)
	AdminOverrideTransfer(ctx context.Context, id string, status string, notes string) error
	AdminAdjustBudget(ctx context.Context, teamID string, totalBudget int64) error
	AdminSeedBudgets(ctx context.Context) error
}

type TransferService struct {
	repo         ports.ITransferRepository
	contractRepo ports.IContractRepository
	playerRepo   ports.PlayerRepository
	windowRepo   ports.ITransferWindowRepository
	notifService INotificationService
	tmRepo       ports.ITeamManagerRepository
}

func NewTransferService(
	repo ports.ITransferRepository,
	contractRepo ports.IContractRepository,
	playerRepo ports.PlayerRepository,
	windowRepo ports.ITransferWindowRepository,
	notifService INotificationService,
	tmRepo ports.ITeamManagerRepository,
) ITransferService {
	return &TransferService{
		repo:         repo,
		contractRepo: contractRepo,
		playerRepo:   playerRepo,
		windowRepo:   windowRepo,
		notifService: notifService,
		tmRepo:       tmRepo,
	}
}

func (s *TransferService) ensureWindowOpen(ctx context.Context) error {
	open, err := s.windowRepo.IsWindowOpen(ctx)
	if err != nil {
		return fmt.Errorf("failed to check transfer window: %w", err)
	}
	if !open {
		return fmt.Errorf("transfer window is currently closed")
	}
	return nil
}

func (s *TransferService) CreateTransferRequest(ctx context.Context, managerUserID string, fromTeamID string, req dto.CreateTransferRequestDTO) (*dto.TransferResponse, error) {
	if err := s.ensureWindowOpen(ctx); err != nil {
		return nil, err
	}

	// 1. Verify player
	player, err := s.playerRepo.GetPlayerByID(ctx, req.PlayerID)
	if err != nil || player == nil {
		return nil, fmt.Errorf("player not found")
	}

	targetTeamID := player.TeamID
	if targetTeamID == "" || targetTeamID == fromTeamID {
		return nil, fmt.Errorf("invalid target team for player")
	}

	// 2. Check player's active contract
	activeContract, err := s.contractRepo.GetActiveContractByPlayerID(ctx, req.PlayerID)
	if err != nil || activeContract == nil {
		return nil, fmt.Errorf("player does not have an active contract to transfer")
	}

	// 3. Budget check: ensure requesting team has budget for player's value
	budget, err := s.repo.GetTeamBudget(ctx, fromTeamID)
	if err != nil {
		return nil, fmt.Errorf("failed to load team budget: %w", err)
	}
	if activeContract.PlayerValue > budget.Remaining {
		return nil, fmt.Errorf("insufficient budget: remaining budget is %d, but player value is %d", budget.Remaining, activeContract.PlayerValue)
	}

	transfer := &domain.Transfer{
		Type:         "REQUEST",
		Status:       "PENDING",
		PlayerID:     req.PlayerID,
		FromTeamID:   fromTeamID, // Requester team
		ToTeamID:     &targetTeamID, // Target team owning the player
		InitiatedBy:  managerUserID,
		AskingPrice:  &activeContract.PlayerValue,
		Notes:        req.Notes,
	}

	if err := s.repo.CreateTransfer(ctx, transfer); err != nil {
		return nil, fmt.Errorf("failed to create transfer request: %w", err)
	}

	// Notify target team managers
	managers, _ := s.tmRepo.GetManagersByTeamID(ctx, targetTeamID)
	for _, m := range managers {
		msg := fmt.Sprintf("A transfer request was submitted for your player %s.", player.Name)
		refID := transfer.ID
		_ = s.notifService.Send(ctx, m.UserID, "TRANSFER_REQUEST", "Transfer Request Received", msg, "transfer", &refID)
	}

	return s.GetTransferByID(ctx, transfer.ID)
}

func (s *TransferService) CreatePlayerListing(ctx context.Context, managerUserID string, teamID string, req dto.CreatePlayerListingDTO) (*dto.TransferResponse, error) {
	if err := s.ensureWindowOpen(ctx); err != nil {
		return nil, err
	}

	player, err := s.playerRepo.GetPlayerByID(ctx, req.PlayerID)
	if err != nil || player == nil {
		return nil, fmt.Errorf("player not found")
	}

	if player.TeamID != teamID {
		return nil, fmt.Errorf("player does not belong to your team")
	}

	activeContract, err := s.contractRepo.GetActiveContractByPlayerID(ctx, req.PlayerID)
	if err != nil || activeContract == nil {
		return nil, fmt.Errorf("player does not have an active contract to list")
	}

	if req.AskingPrice <= 0 {
		return nil, fmt.Errorf("asking price must be greater than 0")
	}

	transfer := &domain.Transfer{
		Type:             "LISTING",
		Status:           "PENDING",
		PlayerID:         req.PlayerID,
		FromTeamID:       teamID,
		InitiatedBy:      managerUserID,
		AskingPrice:      &req.AskingPrice,
		FromTeamApproved: true,
	}

	if err := s.repo.CreateTransfer(ctx, transfer); err != nil {
		return nil, fmt.Errorf("failed to list player for transfer: %w", err)
	}

	return s.GetTransferByID(ctx, transfer.ID)
}

func (s *TransferService) CreateDirectSale(ctx context.Context, managerUserID string, fromTeamID string, req dto.CreateDirectSaleDTO) (*dto.TransferResponse, error) {
	if err := s.ensureWindowOpen(ctx); err != nil {
		return nil, err
	}

	player, err := s.playerRepo.GetPlayerByID(ctx, req.PlayerID)
	if err != nil || player == nil {
		return nil, fmt.Errorf("player not found")
	}

	if player.TeamID != fromTeamID {
		return nil, fmt.Errorf("player does not belong to your team")
	}

	if req.ToTeamID == fromTeamID {
		return nil, fmt.Errorf("cannot sell player to your own team")
	}

	// Budget check on buyer
	buyerBudget, err := s.repo.GetTeamBudget(ctx, req.ToTeamID)
	if err != nil {
		return nil, fmt.Errorf("failed to load buyer team budget: %w", err)
	}

	if req.Price > buyerBudget.Remaining {
		return nil, fmt.Errorf("buyer team has insufficient budget (remaining: %d, required: %d)", buyerBudget.Remaining, req.Price)
	}

	transfer := &domain.Transfer{
		Type:             "DIRECT_SALE",
		Status:           "PENDING",
		PlayerID:         req.PlayerID,
		FromTeamID:       fromTeamID,
		ToTeamID:         &req.ToTeamID,
		InitiatedBy:      managerUserID,
		AskingPrice:      &req.Price,
		FromTeamApproved: true,
		ToTeamApproved:   false,
	}

	if err := s.repo.CreateTransfer(ctx, transfer); err != nil {
		return nil, fmt.Errorf("failed to create direct sale: %w", err)
	}

	// Notify buyer team manager
	managers, _ := s.tmRepo.GetManagersByTeamID(ctx, req.ToTeamID)
	for _, m := range managers {
		msg := fmt.Sprintf("Direct sale proposal received for player %s at price %d.", player.Name, req.Price)
		refID := transfer.ID
		_ = s.notifService.Send(ctx, m.UserID, "DIRECT_SALE_PENDING", "Direct Sale Proposal", msg, "transfer", &refID)
	}

	return s.GetTransferByID(ctx, transfer.ID)
}

func (s *TransferService) RespondToTransfer(ctx context.Context, transferID string, managerUserID string, teamID string, req dto.TransferActionDTO) (*dto.TransferResponse, error) {
	t, err := s.repo.GetTransferByID(ctx, transferID)
	if err != nil || t == nil {
		return nil, fmt.Errorf("transfer not found")
	}

	if t.Type == "REQUEST" {
		// Response by the team owning the player (t.ToTeamID) or requester (t.FromTeamID)
		if req.Action == "accept" {
			if err := s.ensureWindowOpen(ctx); err != nil {
				return nil, err
			}

			// Complete the transfer: buyer is FromTeamID, seller is ToTeamID
			buyerTeamID := t.FromTeamID
			sellerTeamID := ""
			if t.ToTeamID != nil {
				sellerTeamID = *t.ToTeamID
			}

			price := int64(1000000)
			if t.AskingPrice != nil {
				price = *t.AskingPrice
			}

			if err := s.executeTransferCompletion(ctx, t, buyerTeamID, sellerTeamID, price); err != nil {
				return nil, err
			}

			now := time.Now()
			_ = s.repo.UpdateTransferStatus(ctx, transferID, "COMPLETED", req.Notes, "", &now)

			// Notify requester manager
			msg := fmt.Sprintf("Transfer request for player %s was accepted!", t.Player.Name)
			refID := transferID
			_ = s.notifService.Send(ctx, t.InitiatedBy, "TRANSFER_ACCEPTED", "Transfer Approved", msg, "transfer", &refID)

		} else if req.Action == "review" {
			_ = s.repo.UpdateTransferStatus(ctx, transferID, "REVIEW", "", req.Notes, nil)

			msg := fmt.Sprintf("Transfer request for player %s requires review: %s", t.Player.Name, req.Notes)
			refID := transferID
			_ = s.notifService.Send(ctx, t.InitiatedBy, "TRANSFER_REVIEW", "Transfer Under Review", msg, "transfer", &refID)

		} else if req.Action == "reject" {
			_ = s.repo.UpdateTransferStatus(ctx, transferID, "REJECTED", req.Notes, "", nil)

			msg := fmt.Sprintf("Transfer request for player %s was rejected.", t.Player.Name)
			refID := transferID
			_ = s.notifService.Send(ctx, t.InitiatedBy, "TRANSFER_REJECTED", "Transfer Rejected", msg, "transfer", &refID)
		}
	} else if t.Type == "DIRECT_SALE" {
		if req.Action == "accept" {
			if err := s.ensureWindowOpen(ctx); err != nil {
				return nil, err
			}

			// Mark buyer approved
			_ = s.repo.SetTeamApproval(ctx, transferID, t.FromTeamApproved, true)

			buyerTeamID := ""
			if t.ToTeamID != nil {
				buyerTeamID = *t.ToTeamID
			}
			sellerTeamID := t.FromTeamID

			price := int64(0)
			if t.AskingPrice != nil {
				price = *t.AskingPrice
			}

			if err := s.executeTransferCompletion(ctx, t, buyerTeamID, sellerTeamID, price); err != nil {
				return nil, err
			}

			now := time.Now()
			_ = s.repo.UpdateTransferStatus(ctx, transferID, "COMPLETED", req.Notes, "", &now)

			msg := fmt.Sprintf("Direct sale of player %s completed successfully.", t.Player.Name)
			refID := transferID
			_ = s.notifService.Send(ctx, t.InitiatedBy, "TRANSFER_COMPLETED", "Direct Sale Completed", msg, "transfer", &refID)

		} else if req.Action == "reject" {
			_ = s.repo.UpdateTransferStatus(ctx, transferID, "REJECTED", req.Notes, "", nil)

			msg := fmt.Sprintf("Direct sale proposal for player %s was rejected.", t.Player.Name)
			refID := transferID
			_ = s.notifService.Send(ctx, t.InitiatedBy, "TRANSFER_REJECTED", "Direct Sale Rejected", msg, "transfer", &refID)
		}
	}

	return s.GetTransferByID(ctx, transferID)
}

func (s *TransferService) PlaceBid(ctx context.Context, transferID string, managerUserID string, bidderTeamID string, req dto.CreateBidDTO) (*dto.BidResponse, error) {
	if err := s.ensureWindowOpen(ctx); err != nil {
		return nil, err
	}

	t, err := s.repo.GetTransferByID(ctx, transferID)
	if err != nil || t == nil {
		return nil, fmt.Errorf("transfer listing not found")
	}

	if t.Type != "LISTING" || t.Status != "PENDING" {
		return nil, fmt.Errorf("listing is not active for bidding")
	}

	if t.FromTeamID == bidderTeamID {
		return nil, fmt.Errorf("cannot bid on your own player listing")
	}

	if req.BidValue <= 0 {
		return nil, fmt.Errorf("bid value must be greater than 0")
	}

	// Budget check: bidder team must have remaining budget >= BidValue
	budget, err := s.repo.GetTeamBudget(ctx, bidderTeamID)
	if err != nil {
		return nil, fmt.Errorf("failed to load team budget: %w", err)
	}

	if req.BidValue > budget.Remaining {
		return nil, fmt.Errorf("insufficient team budget: remaining is %d, but bid is %d", budget.Remaining, req.BidValue)
	}

	bid := &domain.TransferBid{
		TransferID:   transferID,
		BidderTeamID: bidderTeamID,
		BidValue:     req.BidValue,
		Status:       "PENDING",
		BidderID:     managerUserID,
	}

	if err := s.repo.CreateBid(ctx, bid); err != nil {
		return nil, fmt.Errorf("failed to place bid: %w", err)
	}

	// Notify seller manager
	managers, _ := s.tmRepo.GetManagersByTeamID(ctx, t.FromTeamID)
	for _, m := range managers {
		msg := fmt.Sprintf("New bid of %d placed for player %s.", req.BidValue, t.Player.Name)
		refID := transferID
		_ = s.notifService.Send(ctx, m.UserID, "BID_RECEIVED", "New Bid Placed", msg, "transfer", &refID)
	}

	b, _ := s.repo.GetBidByID(ctx, bid.ID)
	res := dto.BidResponse{
		ID:           b.ID,
		TransferID:   b.TransferID,
		BidderTeamID: b.BidderTeamID,
		BidValue:     b.BidValue,
		Status:       b.Status,
		BidderID:     b.BidderID,
		CreatedAt:    b.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
	return &res, nil
}

func (s *TransferService) RespondToBid(ctx context.Context, transferID string, bidID string, managerUserID string, sellerTeamID string, action string) error {
	t, err := s.repo.GetTransferByID(ctx, transferID)
	if err != nil || t == nil {
		return fmt.Errorf("transfer listing not found")
	}

	if t.FromTeamID != sellerTeamID {
		return fmt.Errorf("forbidden: only seller team manager can respond to bids")
	}

	bid, err := s.repo.GetBidByID(ctx, bidID)
	if err != nil || bid == nil {
		return fmt.Errorf("bid not found")
	}

	if action == "accept" {
		if err := s.ensureWindowOpen(ctx); err != nil {
			return err
		}

		// Accept this bid
		_ = s.repo.UpdateBidStatus(ctx, bidID, "ACCEPTED")

		// Reject all other bids for this listing
		bids, _ := s.repo.GetBidsByTransferID(ctx, transferID)
		for _, b := range bids {
			if b.ID != bidID {
				_ = s.repo.UpdateBidStatus(ctx, b.ID, "REJECTED")
				_ = s.notifService.Send(ctx, b.BidderID, "BID_REJECTED", "Bid Rejected", fmt.Sprintf("Your bid for %s was rejected.", t.Player.Name), "transfer", &transferID)
			}
		}

		// Complete transfer
		buyerTeamID := bid.BidderTeamID
		sellerTeamID := t.FromTeamID

		if err := s.executeTransferCompletion(ctx, t, buyerTeamID, sellerTeamID, bid.BidValue); err != nil {
			return err
		}

		now := time.Now()
		_ = s.repo.UpdateTransferStatus(ctx, transferID, "COMPLETED", "", "", &now)

		// Notify winning bidder
		msg := fmt.Sprintf("Your bid of %d for player %s was accepted! Transfer complete.", bid.BidValue, t.Player.Name)
		_ = s.notifService.Send(ctx, bid.BidderID, "BID_ACCEPTED", "Bid Accepted", msg, "transfer", &transferID)

		return nil
	} else if action == "reject" {
		_ = s.repo.UpdateBidStatus(ctx, bidID, "REJECTED")
		_ = s.notifService.Send(ctx, bid.BidderID, "BID_REJECTED", "Bid Rejected", fmt.Sprintf("Your bid for %s was rejected.", t.Player.Name), "transfer", &transferID)
		return nil
	}

	return fmt.Errorf("invalid action: accept or reject required")
}

func (s *TransferService) executeTransferCompletion(ctx context.Context, t *domain.Transfer, buyerTeamID string, sellerTeamID string, price int64) error {
	// Budget check & update
	if buyerTeamID != "" {
		buyerBudget, err := s.repo.GetTeamBudget(ctx, buyerTeamID)
		if err != nil {
			return fmt.Errorf("failed to get buyer budget: %w", err)
		}
		if price > buyerBudget.Remaining {
			return fmt.Errorf("buyer team has insufficient remaining budget (%d remaining, %d needed)", buyerBudget.Remaining, price)
		}
		if err := s.repo.UpdateTeamBudget(ctx, buyerTeamID, buyerBudget.Spent+price); err != nil {
			return fmt.Errorf("failed to update buyer budget: %w", err)
		}
	}

	if sellerTeamID != "" {
		sellerBudget, err := s.repo.GetTeamBudget(ctx, sellerTeamID)
		if err == nil && sellerBudget != nil {
			newSpent := sellerBudget.Spent - price
			if newSpent < 0 {
				newSpent = 0
			}
			_ = s.repo.UpdateTeamBudget(ctx, sellerTeamID, newSpent)
		}
	}

	// Terminate active contract with seller
	activeContract, err := s.contractRepo.GetActiveContractByPlayerID(ctx, t.PlayerID)
	now := time.Now()
	if err == nil && activeContract != nil {
		_ = s.contractRepo.UpdateContractStatus(ctx, activeContract.ID, "TERMINATED", "TRANSFERRED", nil, nil, &now)
	}

	// Update player's team_id to buyerTeamID
	player, pErr := s.playerRepo.GetPlayerByID(ctx, t.PlayerID)
	if pErr == nil && player != nil {
		player.TeamID = buyerTeamID
		_ = s.playerRepo.UpdatePlayer(ctx, player)

		// Create a new PENDING contract for buyer team (13 games, player value = price)
		matchesAtStart, _ := s.contractRepo.GetTeamFinishedMatchCount(ctx, buyerTeamID)
		newContract := &domain.Contract{
			PlayerID:       t.PlayerID,
			TeamID:         buyerTeamID,
			Status:         "PENDING",
			ContractLength: 13,
			MatchesAtStart: matchesAtStart,
			PlayerValue:    price,
			OfferedBy:      t.InitiatedBy,
			Notes:          "Transfer Contract Offer",
		}
		_ = s.contractRepo.CreateContract(ctx, newContract)

		if player.UserID != nil && *player.UserID != "" {
			msg := fmt.Sprintf("Your transfer to a new team is complete! Please review and accept your new contract.")
			refID := newContract.ID
			_ = s.notifService.Send(ctx, *player.UserID, "CONTRACT_OFFER", "New Team Contract", msg, "contract", &refID)
		}
	}

	return nil
}

func (s *TransferService) GetMarketListings(ctx context.Context, search string, page, limit int) (dto.PaginatedResult[dto.TransferResponse], error) {
	transfers, total, err := s.repo.GetActiveListings(ctx, search, page, limit)
	if err != nil {
		return dto.PaginatedResult[dto.TransferResponse]{}, err
	}

	res := make([]dto.TransferResponse, 0, len(transfers))
	for _, t := range transfers {
		trResp := s.mapTransferToResponse(&t)
		bids, _ := s.repo.GetBidsByTransferID(ctx, t.ID)
		trResp.Bids = s.mapBidsToResponse(bids)
		res = append(res, trResp)
	}

	totalPages := 0
	if limit > 0 {
		totalPages = int((total + int64(limit) - 1) / int64(limit))
	}

	return dto.PaginatedResult[dto.TransferResponse]{
		Data:       res,
		Total:      int(total),
		Page:       page,
		Limit:      limit,
		TotalPages: totalPages,
	}, nil
}

func (s *TransferService) GetTeamTransfers(ctx context.Context, teamID string, transferType string, status string, page, limit int) (dto.PaginatedResult[dto.TransferResponse], error) {
	transfers, total, err := s.repo.GetTransfersByTeamID(ctx, teamID, transferType, status, page, limit)
	if err != nil {
		return dto.PaginatedResult[dto.TransferResponse]{}, err
	}

	res := make([]dto.TransferResponse, 0, len(transfers))
	for _, t := range transfers {
		trResp := s.mapTransferToResponse(&t)
		bids, _ := s.repo.GetBidsByTransferID(ctx, t.ID)
		trResp.Bids = s.mapBidsToResponse(bids)
		res = append(res, trResp)
	}

	totalPages := 0
	if limit > 0 {
		totalPages = int((total + int64(limit) - 1) / int64(limit))
	}

	return dto.PaginatedResult[dto.TransferResponse]{
		Data:       res,
		Total:      int(total),
		Page:       page,
		Limit:      limit,
		TotalPages: totalPages,
	}, nil
}

func (s *TransferService) GetPlayerTransfers(ctx context.Context, playerID string, page, limit int) (dto.PaginatedResult[dto.TransferResponse], error) {
	transfers, total, err := s.repo.GetTransfersByPlayerID(ctx, playerID, page, limit)
	if err != nil {
		return dto.PaginatedResult[dto.TransferResponse]{}, err
	}

	res := make([]dto.TransferResponse, 0, len(transfers))
	for _, t := range transfers {
		trResp := s.mapTransferToResponse(&t)
		bids, _ := s.repo.GetBidsByTransferID(ctx, t.ID)
		trResp.Bids = s.mapBidsToResponse(bids)
		res = append(res, trResp)
	}

	totalPages := 0
	if limit > 0 {
		totalPages = int((total + int64(limit) - 1) / int64(limit))
	}

	return dto.PaginatedResult[dto.TransferResponse]{
		Data:       res,
		Total:      int(total),
		Page:       page,
		Limit:      limit,
		TotalPages: totalPages,
	}, nil
}

func (s *TransferService) GetTransferByID(ctx context.Context, id string) (*dto.TransferResponse, error) {
	t, err := s.repo.GetTransferByID(ctx, id)
	if err != nil || t == nil {
		return nil, fmt.Errorf("transfer not found")
	}

	trResp := s.mapTransferToResponse(t)
	bids, _ := s.repo.GetBidsByTransferID(ctx, t.ID)
	trResp.Bids = s.mapBidsToResponse(bids)
	return &trResp, nil
}

func (s *TransferService) GetTeamBudget(ctx context.Context, teamID string) (*dto.TeamBudgetResponse, error) {
	b, err := s.repo.GetTeamBudget(ctx, teamID)
	if err != nil {
		return nil, err
	}
	res := s.mapBudgetToResponse(b)
	return &res, nil
}

func (s *TransferService) GetAllTeamBudgets(ctx context.Context) ([]dto.TeamBudgetResponse, error) {
	budgets, err := s.repo.GetAllTeamBudgets(ctx)
	if err != nil {
		return nil, err
	}

	res := make([]dto.TeamBudgetResponse, 0, len(budgets))
	for _, b := range budgets {
		res = append(res, s.mapBudgetToResponse(&b))
	}
	return res, nil
}

func (s *TransferService) AdminOverrideTransfer(ctx context.Context, id string, status string, notes string) error {
	now := time.Now()
	var completedAt *time.Time
	if status == "COMPLETED" {
		completedAt = &now
	}

	return s.repo.UpdateTransferStatus(ctx, id, status, notes, "", completedAt)
}

func (s *TransferService) AdminAdjustBudget(ctx context.Context, teamID string, totalBudget int64) error {
	return s.repo.InitTeamBudget(ctx, teamID, totalBudget)
}

func (s *TransferService) AdminSeedBudgets(ctx context.Context) error {
	budgets, err := s.repo.GetAllTeamBudgets(ctx)
	if err != nil {
		return err
	}
	for _, b := range budgets {
		_ = s.repo.InitTeamBudget(ctx, b.TeamID, 15000000)
	}
	return nil
}

func (s *TransferService) mapTransferToResponse(t *domain.Transfer) dto.TransferResponse {
	resp := dto.TransferResponse{
		ID:               t.ID,
		Type:             t.Type,
		Status:           t.Status,
		PlayerID:         t.PlayerID,
		FromTeamID:       t.FromTeamID,
		ToTeamID:         t.ToTeamID,
		InitiatedBy:      t.InitiatedBy,
		AskingPrice:      t.AskingPrice,
		Notes:            t.Notes,
		ReviewNotes:      t.ReviewNotes,
		FromTeamApproved: t.FromTeamApproved,
		ToTeamApproved:   t.ToTeamApproved,
		CreatedAt:        t.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:        t.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}

	if t.CompletedAt != nil {
		cStr := t.CompletedAt.Format("2006-01-02T15:04:05Z07:00")
		resp.CompletedAt = &cStr
	}

	if t.Player != nil {
		resp.Player = &dto.PlayerResponse{
			ID:           t.Player.ID,
			Name:         t.Player.Name,
			JerseyNumber: t.Player.JerseyNumber,
			Position:     t.Player.Position,
			Image:        t.Player.Image,
		}
	}

	if t.FromTeam != nil {
		resp.FromTeam = &dto.TeamResponse{
			ID:        t.FromTeam.ID,
			Name:      t.FromTeam.Name,
			ShortName: t.FromTeam.ShortName,
			Logo:      t.FromTeam.Logo,
		}
	}

	if t.ToTeam != nil {
		resp.ToTeam = &dto.TeamResponse{
			ID:        t.ToTeam.ID,
			Name:      t.ToTeam.Name,
			ShortName: t.ToTeam.ShortName,
			Logo:      t.ToTeam.Logo,
		}
	}

	return resp
}

func (s *TransferService) mapBidsToResponse(bids []domain.TransferBid) []dto.BidResponse {
	res := make([]dto.BidResponse, 0, len(bids))
	for _, b := range bids {
		bResp := dto.BidResponse{
			ID:           b.ID,
			TransferID:   b.TransferID,
			BidderTeamID: b.BidderTeamID,
			BidValue:     b.BidValue,
			Status:       b.Status,
			BidderID:     b.BidderID,
			CreatedAt:    b.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		}
		if b.BidderTeam != nil {
			bResp.BidderTeam = &dto.TeamResponse{
				ID:        b.BidderTeam.ID,
				Name:      b.BidderTeam.Name,
				ShortName: b.BidderTeam.ShortName,
				Logo:      b.BidderTeam.Logo,
			}
		}
		res = append(res, bResp)
	}
	return res
}

func (s *TransferService) mapBudgetToResponse(b *domain.TeamBudget) dto.TeamBudgetResponse {
	resp := dto.TeamBudgetResponse{
		ID:          b.ID,
		TeamID:      b.TeamID,
		TotalBudget: b.TotalBudget,
		Spent:       b.Spent,
		Remaining:   b.Remaining,
		CreatedAt:   b.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:   b.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
	if b.Team != nil {
		resp.Team = &dto.TeamResponse{
			ID:        b.Team.ID,
			Name:      b.Team.Name,
			ShortName: b.Team.ShortName,
			Logo:      b.Team.Logo,
		}
	}
	return resp
}
