package services

import (
	"context"
	"crypto/rand"
	"fmt"
	"math/big"
	"strings"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
	"showtime-backend/pkg/email"
)

type ITeamTicketAllocationService interface {
	// Admin Methods
	CreateOrUpdateAllocation(ctx context.Context, req CreateOrUpdateAllocationReq) error
	GetAllocationsByEventDay(ctx context.Context, eventDayID string) ([]domain.TeamTicketAllocation, error)
	DeleteAllocation(ctx context.Context, allocationID string) error

	// Team Head Methods
	GetAllocationsByTeam(ctx context.Context, teamID string) ([]domain.TeamTicketAllocation, error)
	GetAllocatedAndIssuedTicketsCount(ctx context.Context, eventDayID string, teamID string) (allocated int, issued int, err error)
	IssueTeamTicket(ctx context.Context, req dto.IssueTeamTicketRequest, teamID string) (*dto.TicketResponse, error)
}

type TeamTicketAllocationService struct {
	allocationRepo ports.TeamTicketAllocationRepository
	ticketRepo     ports.TicketRepository
	tierRepo       ports.TicketTierRepository
	eventDayRepo   ports.EventDayRepository
	emailService   ports.EmailService
}

type CreateOrUpdateAllocationReq struct {
	EventDayID     string
	TeamID         string
	AllocatedCount int
}

func NewTeamTicketAllocationService(
	allocationRepo ports.TeamTicketAllocationRepository,
	ticketRepo ports.TicketRepository,
	tierRepo ports.TicketTierRepository,
	eventDayRepo ports.EventDayRepository,
	emailService ports.EmailService,
) *TeamTicketAllocationService {
	return &TeamTicketAllocationService{
		allocationRepo: allocationRepo,
		ticketRepo:     ticketRepo,
		tierRepo:       tierRepo,
		eventDayRepo:   eventDayRepo,
		emailService:   emailService,
	}
}

func (s *TeamTicketAllocationService) CreateOrUpdateAllocation(ctx context.Context, req CreateOrUpdateAllocationReq) error {
	allocation := &domain.TeamTicketAllocation{
		EventDayID:     req.EventDayID,
		TeamID:         req.TeamID,
		AllocatedCount: req.AllocatedCount,
	}
	return s.allocationRepo.CreateOrUpdate(ctx, allocation)
}

func (s *TeamTicketAllocationService) GetAllocationsByEventDay(ctx context.Context, eventDayID string) ([]domain.TeamTicketAllocation, error) {
	return s.allocationRepo.ListByEventDay(ctx, eventDayID)
}

func (s *TeamTicketAllocationService) DeleteAllocation(ctx context.Context, id string) error {
	return s.allocationRepo.Delete(ctx, id)
}

func (s *TeamTicketAllocationService) GetAllocationsByTeam(ctx context.Context, teamID string) ([]domain.TeamTicketAllocation, error) {
	return s.allocationRepo.ListByTeam(ctx, teamID)
}

func (s *TeamTicketAllocationService) GetAllocatedAndIssuedTicketsCount(ctx context.Context, eventDayID string, teamID string) (int, int, error) {
	allocation, err := s.allocationRepo.GetByTeamAndEventDay(ctx, teamID, eventDayID)
	if err != nil {
		return 0, 0, err
	}

	issuedCount, err := s.ticketRepo.CountByTeamAndEventDay(ctx, teamID, eventDayID)
	if err != nil {
		return allocation.AllocatedCount, 0, err
	}

	return allocation.AllocatedCount, issuedCount, nil
}

func (s *TeamTicketAllocationService) IssueTeamTicket(ctx context.Context, req dto.IssueTeamTicketRequest, teamID string) (*dto.TicketResponse, error) {
	allocated, issued, err := s.GetAllocatedAndIssuedTicketsCount(ctx, req.EventDayID, teamID)
	if err != nil {
		return nil, fmt.Errorf("failed to get allocation stats: %w", err)
	}
	if allocated == 0 || issued >= allocated {
		return nil, fmt.Errorf("allocation exhausted or zero: %d allocated, %d issued", allocated, issued)
	}

	tiers, err := s.tierRepo.ListByEventDay(ctx, req.EventDayID)
	if err != nil || len(tiers) == 0 {
		return nil, fmt.Errorf("no ticket tiers found for this event day")
	}

	var selectedTier *domain.TicketTier
	for i := range tiers {
		if tiers[i].Price == 0 {
			selectedTier = &tiers[i]
			break
		}
	}
	if selectedTier == nil {
		return nil, fmt.Errorf("no free tier is configured to issue these allocated tickets from")
	}

	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	code := make([]byte, 6)
	for i := range code {
		n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(chars))))
		code[i] = chars[n.Int64()]
	}
	ticketCode := "SFFL-" + strings.ToUpper(string(code))

	ticket := &domain.Ticket{
		EventDayID:  req.EventDayID,
		TierID:      selectedTier.ID,
		Email:       req.Email,
		Quantity:    1,
		UnitPrice:   0,
		TotalAmount: 0,
		Status:      domain.TicketStatusPaid,
		TicketCode:  ticketCode,
		TeamID:      &teamID,
	}

	if err := s.ticketRepo.Create(ctx, ticket); err != nil {
		return nil, fmt.Errorf("failed to insert ticket: %w", err)
	}

	_ = s.tierRepo.IncrementSoldCount(ctx, selectedTier.ID, 1)

	// Populate nested entities for email dispatch
	ticket.Tier = selectedTier
	if ed, err := s.eventDayRepo.GetByID(ctx, ticket.EventDayID); err == nil {
		ticket.EventDay = ed
	}
	s.sendTeamTicketEmail(ticket)

	// Returning the generated ticket
	return &dto.TicketResponse{
		ID:          ticket.ID,
		EventDayID:  ticket.EventDayID,
		TierID:      ticket.TierID,
		Email:       ticket.Email,
		Quantity:    ticket.Quantity,
		UnitPrice:   ticket.UnitPrice,
		TotalAmount: ticket.TotalAmount,
		Status:      string(ticket.Status),
		TicketCode:  ticket.TicketCode,
		TierName:    selectedTier.Name,
		CreatedAt:   ticket.CreatedAt.Format("2006-01-02T15:04:05Z"),
	}, nil
}

func (s *TeamTicketAllocationService) sendTeamTicketEmail(ticket *domain.Ticket) {
	if s.emailService == nil || ticket.EventDay == nil || ticket.Tier == nil {
		return
	}
	subject := fmt.Sprintf("IT'S SHOWTIME 🏈, Your Ticket for %s", ticket.EventDay.Title)
	body := email.PurchaseEmailHTML(
		ticket.EventDay.Title,
		ticket.EventDay.Date.Format("Mon, Jan 02 2006"),
		ticket.EventDay.Venue,
		ticket.Tier.Name,
		ticket.Quantity,
		ticket.TotalAmount,
		ticket.TicketCode,
	)

	go func() {
		if err := s.emailService.SendEmail(ticket.Email, subject, body); err != nil {
			fmt.Printf("Failed to send team ticket email to %s: %v\n", ticket.Email, err)
		}
	}()
}
