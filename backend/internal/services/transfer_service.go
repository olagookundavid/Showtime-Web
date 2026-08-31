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

// transferPlayerName is used in notification copy. The player relation is
// populated by the repository joins but is still a pointer, so fall back to a
// neutral noun rather than risking a nil dereference inside a message.
func transferPlayerName(t *domain.Transfer) string {
	if t.Player != nil && t.Player.Name != "" {
		return t.Player.Name
	}
	return "the player"
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

	if t.Status != "PENDING" && t.Status != "REVIEW" {
		return nil, fmt.Errorf("transfer is no longer pending or open for review")
	}

	playerName := transferPlayerName(t)

	if t.Type == "REQUEST" {
		// A request is negotiated in two stages. While it is PENDING the club
		// holding the player answers, and may send it back for review. Once it
		// is in REVIEW the requesting club answers the revised terms and, per
		// the transfer rules, may only accept or reject — it cannot bounce the
		// request back a second time.
		reviewStage := t.Status == "REVIEW"

		if reviewStage {
			if teamID == "" || t.FromTeamID != teamID {
				return nil, fmt.Errorf("forbidden: this request is awaiting a response from the requesting club")
			}
			if req.Action == "review" {
				return nil, fmt.Errorf("a transfer request can only be sent back for review once")
			}
		} else if teamID == "" || t.ToTeamID == nil || *t.ToTeamID != teamID {
			return nil, fmt.Errorf("forbidden: transfer request is not addressed to your team")
		}

		// Whichever club did not just act is the one that needs telling.
		notifyCounterparty := func(notifType, title, msg string) {
			refID := transferID
			if !reviewStage {
				_ = s.notifService.Send(ctx, t.InitiatedBy, notifType, title, msg, "transfer", &refID)
				return
			}
			if t.ToTeamID == nil {
				return
			}
			managers, _ := s.tmRepo.GetManagersByTeamID(ctx, *t.ToTeamID)
			for _, m := range managers {
				_ = s.notifService.Send(ctx, m.UserID, notifType, title, msg, "transfer", &refID)
			}
		}

		if req.Action == "accept" {
			if err := s.ensureWindowOpen(ctx); err != nil {
				return nil, err
			}

			// Claim the transfer first: the guarded update is what stops two
			// managers completing the same request concurrently.
			now := time.Now()
			if err := s.repo.UpdateTransferStatus(ctx, transferID, "COMPLETED", req.Notes, "", &now); err != nil {
				return nil, fmt.Errorf("transfer status update failed: %w", err)
			}

			// The requesting club buys; the club holding the player sells.
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
				// The claim was a lock, not a commitment. Hand the request back
				// so it can be retried once the cause (usually an unaffordable
				// fee) has been dealt with.
				_ = s.repo.RestoreTransferStatus(ctx, transferID, t.Status)
				return nil, err
			}

			notifyCounterparty("TRANSFER_ACCEPTED", "Transfer Approved", fmt.Sprintf("Transfer request for player %s was accepted!", playerName))

		} else if req.Action == "review" {
			if err := s.repo.UpdateTransferStatus(ctx, transferID, "REVIEW", "", req.Notes, nil); err != nil {
				return nil, err
			}

			notifyCounterparty("TRANSFER_REVIEW", "Transfer Under Review", fmt.Sprintf("Transfer request for player %s requires review: %s", playerName, req.Notes))

		} else if req.Action == "reject" {
			if err := s.repo.UpdateTransferStatus(ctx, transferID, "REJECTED", req.Notes, "", nil); err != nil {
				return nil, err
			}

			notifyCounterparty("TRANSFER_REJECTED", "Transfer Rejected", fmt.Sprintf("Transfer request for player %s was rejected.", playerName))
		} else {
			return nil, fmt.Errorf("invalid action for transfer request: %s", req.Action)
		}
	} else if t.Type == "DIRECT_SALE" {
		// Response must be by the target buyer team (t.ToTeamID)
		if teamID == "" || t.ToTeamID == nil || *t.ToTeamID != teamID {
			return nil, fmt.Errorf("forbidden: direct sale proposal is not addressed to your team")
		}

		if req.Action == "accept" {
			if err := s.ensureWindowOpen(ctx); err != nil {
				return nil, err
			}

			// Claim the transfer first so two managers cannot complete the same
			// sale concurrently.
			now := time.Now()
			if err := s.repo.UpdateTransferStatus(ctx, transferID, "COMPLETED", req.Notes, "", &now); err != nil {
				return nil, fmt.Errorf("transfer status update failed: %w", err)
			}

			// The sale is only struck once both clubs have approved; the seller
			// approved on creation, this is the buyer signing off.
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
				// Undo the claim and the buyer's approval so the proposal can be
				// answered again once the cause has been dealt with.
				_ = s.repo.RestoreTransferStatus(ctx, transferID, t.Status)
				_ = s.repo.SetTeamApproval(ctx, transferID, t.FromTeamApproved, false)
				return nil, err
			}

			msg := fmt.Sprintf("Direct sale of player %s completed successfully.", playerName)
			refID := transferID
			_ = s.notifService.Send(ctx, t.InitiatedBy, "TRANSFER_COMPLETED", "Direct Sale Completed", msg, "transfer", &refID)

		} else if req.Action == "reject" {
			if err := s.repo.UpdateTransferStatus(ctx, transferID, "REJECTED", req.Notes, "", nil); err != nil {
				return nil, err
			}

			msg := fmt.Sprintf("Direct sale proposal for player %s was rejected.", playerName)
			refID := transferID
			_ = s.notifService.Send(ctx, t.InitiatedBy, "TRANSFER_REJECTED", "Direct Sale Rejected", msg, "transfer", &refID)
		} else {
			return nil, fmt.Errorf("invalid action for direct sale: '%s' is not supported (only accept or reject are allowed)", req.Action)
		}
	} else {
		// LISTING is settled by accepting one of its bids, not through here.
		// Falling through silently would report success for a no-op.
		return nil, fmt.Errorf("a %s transfer cannot be answered here; respond to one of its bids instead", t.Type)
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
		msg := fmt.Sprintf("New bid of %d placed for player %s.", req.BidValue, transferPlayerName(t))
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

	if t.Status != "PENDING" && t.Status != "REVIEW" {
		return fmt.Errorf("transfer listing is no longer active")
	}

	if t.FromTeamID != sellerTeamID {
		return fmt.Errorf("forbidden: only seller team manager can respond to bids")
	}

	bid, err := s.repo.GetBidByID(ctx, bidID)
	if err != nil || bid == nil {
		return fmt.Errorf("bid not found")
	}

	if bid.Status != "PENDING" {
		return fmt.Errorf("bid is no longer pending")
	}

	playerName := transferPlayerName(t)

	if action == "accept" {
		if err := s.ensureWindowOpen(ctx); err != nil {
			return err
		}

		// Claim the winning bid and the listing before doing any work. Both
		// updates are guarded, so two managers racing to accept — whether the
		// same bid or competing bids on one listing — cannot both get through.
		if err := s.repo.UpdateBidStatus(ctx, bidID, "ACCEPTED"); err != nil {
			return fmt.Errorf("failed to accept bid: %w", err)
		}

		now := time.Now()
		if err := s.repo.UpdateTransferStatus(ctx, transferID, "COMPLETED", "", "", &now); err != nil {
			_ = s.repo.RestoreBidStatus(ctx, bidID, "PENDING")
			return fmt.Errorf("failed to complete transfer listing: %w", err)
		}

		if err := s.executeTransferCompletion(ctx, t, bid.BidderTeamID, t.FromTeamID, bid.BidValue); err != nil {
			// The losing bidders have not been told anything yet, so the
			// listing can simply go back on the market untouched.
			_ = s.repo.RestoreTransferStatus(ctx, transferID, t.Status)
			_ = s.repo.RestoreBidStatus(ctx, bidID, "PENDING")
			return err
		}

		// Only now that the move has actually gone through, turn down the rest.
		bids, _ := s.repo.GetBidsByTransferID(ctx, transferID)
		for _, b := range bids {
			if b.ID == bidID {
				continue
			}
			if err := s.repo.UpdateBidStatus(ctx, b.ID, "REJECTED"); err != nil {
				// Already resolved by an earlier pass — don't notify twice.
				continue
			}
			_ = s.notifService.Send(ctx, b.BidderID, "BID_REJECTED", "Bid Rejected", fmt.Sprintf("Your bid for %s was rejected.", playerName), "transfer", &transferID)
		}

		// Notify winning bidder
		msg := fmt.Sprintf("Your bid of %d for player %s was accepted! Transfer complete.", bid.BidValue, playerName)
		_ = s.notifService.Send(ctx, bid.BidderID, "BID_ACCEPTED", "Bid Accepted", msg, "transfer", &transferID)

		return nil
	} else if action == "reject" {
		if err := s.repo.UpdateBidStatus(ctx, bidID, "REJECTED"); err != nil {
			return err
		}
		_ = s.notifService.Send(ctx, bid.BidderID, "BID_REJECTED", "Bid Rejected", fmt.Sprintf("Your bid for %s was rejected.", playerName), "transfer", &transferID)
		return nil
	}

	return fmt.Errorf("invalid action: accept or reject required")
}

// executeTransferCompletion moves the money, the contract and the squad
// membership for a transfer whose status has already been claimed by the caller.
//
// The three repositories involved hold separate connections, so there is no
// surrounding SQL transaction to lean on. Instead every mutation is recorded and
// undone in reverse order if a later one fails, leaving the caller free to roll
// the transfer status back. The buyer's debit runs first because insufficient
// funds is the only failure expected during normal play, and failing there
// leaves nothing to unwind.
func (s *TransferService) executeTransferCompletion(ctx context.Context, t *domain.Transfer, buyerTeamID string, sellerTeamID string, price int64) error {
	// Pre-flight read: resolve the player before mutating anything, so a missing
	// player aborts before any money moves.
	player, pErr := s.playerRepo.GetPlayerByID(ctx, t.PlayerID)
	if pErr != nil || player == nil {
		return fmt.Errorf("failed to fetch player for transfer: %w", pErr)
	}
	previousTeamID := player.TeamID

	// Atomic buyer budget check & debit — this doubles as the affordability gate.
	buyerDebited := false
	if buyerTeamID != "" && price > 0 {
		if err := s.repo.UpdateTeamBudgetDelta(ctx, buyerTeamID, price); err != nil {
			return fmt.Errorf("failed to process buyer budget deduction: %w", err)
		}
		buyerDebited = true
	}

	// Atomic seller budget credit. A missing budget row is tolerated — the
	// selling club may never have been seeded — and must not block the transfer.
	sellerCredited := false
	if sellerTeamID != "" && price > 0 {
		if err := s.repo.UpdateTeamBudgetDelta(ctx, sellerTeamID, -price); err == nil {
			sellerCredited = true
		}
	}

	terminatedContractID := ""
	playerMoved := false

	unwind := func() {
		if playerMoved {
			player.TeamID = previousTeamID
			_ = s.playerRepo.UpdatePlayer(ctx, player)
		}
		if terminatedContractID != "" {
			_ = s.contractRepo.ReactivateContract(ctx, terminatedContractID)
		}
		if sellerCredited {
			_ = s.repo.UpdateTeamBudgetDelta(ctx, sellerTeamID, price)
		}
		if buyerDebited {
			_ = s.repo.UpdateTeamBudgetDelta(ctx, buyerTeamID, -price)
		}
	}

	// Terminate the player's contract with the selling club.
	activeContract, err := s.contractRepo.GetActiveContractByPlayerID(ctx, t.PlayerID)
	now := time.Now()
	if err == nil && activeContract != nil {
		if err := s.contractRepo.UpdateContractStatus(ctx, activeContract.ID, "TERMINATED", "TRANSFERRED", nil, nil, &now); err != nil {
			unwind()
			return fmt.Errorf("failed to terminate previous contract: %w", err)
		}
		terminatedContractID = activeContract.ID
	}

	// Move the player to the buying club.
	player.TeamID = buyerTeamID
	if err := s.playerRepo.UpdatePlayer(ctx, player); err != nil {
		unwind()
		return fmt.Errorf("failed to update player team assignment: %w", err)
	}
	playerMoved = true

	// Offer the player a fresh contract at the buying club (13 games, value = fee).
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
	if err := s.contractRepo.CreateContract(ctx, newContract); err != nil {
		unwind()
		return fmt.Errorf("failed to create contract for transferred player: %w", err)
	}

	if player.UserID != nil && *player.UserID != "" {
		refID := newContract.ID
		_ = s.notifService.Send(ctx, *player.UserID, "CONTRACT_OFFER", "New Team Contract", "Your transfer to a new team is complete! Please review and accept your new contract.", "contract", &refID)
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

	return s.repo.AdminUpdateTransferStatus(ctx, id, status, notes, "", completedAt)
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
			Gender:       t.Player.Gender,
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
