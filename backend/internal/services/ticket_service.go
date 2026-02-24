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
)

type ITicketService interface {
	Purchase(ctx context.Context, req dto.PurchaseTicketRequest, callbackURL string) (*dto.TicketResponse, error)
	HandleWebhook(ctx context.Context, reference string) error
	GetByReference(ctx context.Context, reference string) (*dto.TicketResponse, error)
	GetByCode(ctx context.Context, code string) (*dto.TicketResponse, error)
	Checkin(ctx context.Context, id string, checkedInBy string) error
	List(ctx context.Context, matchID string, status string, page int, limit int) ([]dto.TicketResponse, int, error)
}

type TicketService struct {
	repo     ports.TicketRepository
	paystack *PaystackClient
}

func NewTicketService(repo ports.TicketRepository, paystack *PaystackClient) *TicketService {
	return &TicketService{repo: repo, paystack: paystack}
}

func (s *TicketService) Purchase(ctx context.Context, req dto.PurchaseTicketRequest, callbackURL string) (*dto.TicketResponse, error) {
	totalAmount := req.UnitPrice * req.Quantity

	ticket := &domain.Ticket{
		MatchID:     req.MatchID,
		Email:       req.Email,
		Quantity:    req.Quantity,
		UnitPrice:   req.UnitPrice,
		TotalAmount: totalAmount,
		Status:      domain.TicketStatusPending,
	}

	// Initialize Paystack transaction
	paystackReq := PaystackInitRequest{
		Email:       req.Email,
		Amount:      totalAmount * 100, // Convert to kobo
		CallbackURL: callbackURL,
	}

	paystackResp, err := s.paystack.InitializeTransaction(paystackReq)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize payment: %w", err)
	}

	ticket.PaystackReference = paystackResp.Data.Reference
	ticket.PaystackAccessCode = paystackResp.Data.AccessCode
	ticket.TicketCode = generateTicketCode()

	if err := s.repo.Create(ctx, ticket); err != nil {
		return nil, fmt.Errorf("failed to create ticket: %w", err)
	}

	return &dto.TicketResponse{
		ID:                ticket.ID,
		MatchID:           ticket.MatchID,
		Email:             ticket.Email,
		Quantity:          ticket.Quantity,
		UnitPrice:         ticket.UnitPrice,
		TotalAmount:       ticket.TotalAmount,
		Status:            string(ticket.Status),
		PaystackReference: ticket.PaystackReference,
		AuthorizationURL:  paystackResp.Data.AuthorizationURL,
		CreatedAt:         ticket.CreatedAt.Format("2006-01-02T15:04:05Z"),
	}, nil
}

func (s *TicketService) HandleWebhook(ctx context.Context, reference string) error {
	// Verify with Paystack
	verifyResp, err := s.paystack.VerifyTransaction(reference)
	if err != nil {
		return fmt.Errorf("failed to verify transaction: %w", err)
	}

	ticket, err := s.repo.GetByReference(ctx, reference)
	if err != nil {
		return fmt.Errorf("ticket not found for reference %s: %w", reference, err)
	}

	if verifyResp.Data.Status == "success" {
		return s.repo.UpdateStatus(ctx, ticket.ID, domain.TicketStatusPaid, ticket.PaystackAccessCode, ticket.TicketCode)
	}

	return s.repo.UpdateStatus(ctx, ticket.ID, domain.TicketStatusFailed, ticket.PaystackAccessCode, ticket.TicketCode)
}

func (s *TicketService) GetByReference(ctx context.Context, reference string) (*dto.TicketResponse, error) {
	ticket, err := s.repo.GetByReference(ctx, reference)
	if err != nil {
		return nil, err
	}
	return ticketToResponse(ticket), nil
}

func (s *TicketService) GetByCode(ctx context.Context, code string) (*dto.TicketResponse, error) {
	ticket, err := s.repo.GetByCode(ctx, code)
	if err != nil {
		return nil, err
	}
	return ticketToResponse(ticket), nil
}

func (s *TicketService) Checkin(ctx context.Context, id string, checkedInBy string) error {
	return s.repo.Checkin(ctx, id, checkedInBy)
}

func (s *TicketService) List(ctx context.Context, matchID string, status string, page int, limit int) ([]dto.TicketResponse, int, error) {
	tickets, total, err := s.repo.List(ctx, matchID, status, page, limit)
	if err != nil {
		return nil, 0, err
	}

	var responses []dto.TicketResponse
	for i := range tickets {
		responses = append(responses, *ticketToResponse(&tickets[i]))
	}
	return responses, total, nil
}

func ticketToResponse(t *domain.Ticket) *dto.TicketResponse {
	res := &dto.TicketResponse{
		ID:                t.ID,
		MatchID:           t.MatchID,
		Email:             t.Email,
		Quantity:          t.Quantity,
		UnitPrice:         t.UnitPrice,
		TotalAmount:       t.TotalAmount,
		Status:            string(t.Status),
		PaystackReference: t.PaystackReference,
		TicketCode:        t.TicketCode,
		CreatedAt:         t.CreatedAt.Format("2006-01-02T15:04:05Z"),
	}

	if t.CheckedInAt != nil {
		formatted := t.CheckedInAt.Format("2006-01-02T15:04:05Z")
		res.CheckedInAt = &formatted
	}
	res.CheckedInBy = t.CheckedInBy

	if t.Match != nil {
		if t.Match.HomeTeam != nil {
			res.HomeTeam = t.Match.HomeTeam.Name
		}
		if t.Match.AwayTeam != nil {
			res.AwayTeam = t.Match.AwayTeam.Name
		}
		res.MatchVenue = t.Match.Venue
		res.MatchDate = t.Match.Date.Format("2006-01-02")
		res.MatchTitle = res.HomeTeam + " vs " + res.AwayTeam
	}

	return res
}

func generateTicketCode() string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	code := make([]byte, 6)
	for i := range code {
		n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(chars))))
		code[i] = chars[n.Int64()]
	}
	return "SFFL-" + strings.ToUpper(string(code))
}
