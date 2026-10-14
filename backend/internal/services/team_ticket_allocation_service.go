package services

import (
	"context"
	"fmt"
	"strings"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
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
	productRepo    ports.TicketProductRepository
	fulfiller      ticketFulfiller
}

// ticketFulfiller does what follows a ticket becoming paid: the confirmation
// email and the reminders. It is the ticket service, passed in so a team ticket
// is treated exactly like any other.
type ticketFulfiller interface {
	OnTicketPaid(ctx context.Context, ticket *domain.Ticket)
}

type CreateOrUpdateAllocationReq struct {
	EventDayID     string
	TeamID         string
	AllocatedCount int
}

func NewTeamTicketAllocationService(
	allocationRepo ports.TeamTicketAllocationRepository,
	ticketRepo ports.TicketRepository,
	productRepo ports.TicketProductRepository,
	fulfiller ticketFulfiller,
) *TeamTicketAllocationService {
	return &TeamTicketAllocationService{
		allocationRepo: allocationRepo,
		ticketRepo:     ticketRepo,
		productRepo:    productRepo,
		fulfiller:      fulfiller,
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

	// Team tickets are free, so they are issued from a free ticket product that is
	// on sale for the match day.
	products, err := s.productRepo.ListProducts(ctx, true)
	if err != nil {
		return nil, fmt.Errorf("failed to load tickets: %w", err)
	}
	var product *domain.TicketProduct
	for i := range products {
		for _, d := range products[i].Days {
			if d.EventDayID == req.EventDayID && d.Price == 0 {
				product = &products[i]
				break
			}
		}
		if product != nil {
			break
		}
	}
	if product == nil {
		return nil, fmt.Errorf("no free ticket is configured to issue these allocated tickets from")
	}
	// Give the day its seat-lock row, so the seat is counted like any other.
	days, err := s.productRepo.ResolveProductDays(ctx, product.ID, []string{req.EventDayID})
	if err != nil || len(days) != 1 {
		return nil, fmt.Errorf("that match day is not on sale for the free ticket")
	}
	productDay := days[0]

	// Create ticket with collision protection
	var ticket *domain.Ticket
	maxRetries := 5
	var lastErr error

	for i := 0; i < maxRetries; i++ {
		productID := product.ID
		ticket = &domain.Ticket{
			ProductID:    &productID,
			ProductName:  product.Name,
			PurchaseType: domain.PurchaseTypeGamePass,
			Email:        req.Email,
			Quantity:     1,
			Status:       domain.TicketStatusPaid,
			TicketCode:   GenerateTicketCode(),
			TeamID:       &teamID,
			Name:         req.Name,
			Days: []domain.TicketDay{{
				EventDayID:   req.EventDayID,
				ProductDayID: productDay.ID,
				UnitPrice:    0,
			}},
		}

		if err := s.ticketRepo.Create(ctx, ticket); err != nil {
			// Check if it's a unique constraint violation on ticket_code
			if strings.Contains(err.Error(), "tickets_ticket_code_key") || strings.Contains(err.Error(), "duplicate key value") {
				lastErr = err
				continue
			}
			return nil, fmt.Errorf("failed to insert ticket: %w", err)
		}

		// Success
		lastErr = nil
		break
	}

	if lastErr != nil {
		return nil, fmt.Errorf("failed to generate unique ticket code after %d attempts: %w", maxRetries, lastErr)
	}

	s.fulfiller.OnTicketPaid(ctx, ticket)

	// Returning the generated ticket
	return ticketToResponse(ticket), nil
}
