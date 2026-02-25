package services

import (
	"context"
	"crypto/rand"
	"fmt"
	"math/big"
	"strings"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"

	"github.com/google/uuid"
)

type ITicketService interface {
	// Event Days
	CreateEventDay(ctx context.Context, req dto.CreateEventDayRequest) (*dto.EventDayResponse, error)
	UpdateEventDay(ctx context.Context, id string, req dto.UpdateEventDayRequest) error
	DeleteEventDay(ctx context.Context, id string) error
	GetEventDayByID(ctx context.Context, id string) (*dto.EventDayResponse, error)
	GetEventDayByDate(ctx context.Context, date string) (*dto.EventDayResponse, error)
	ListActiveEventDays(ctx context.Context) ([]dto.EventDayResponse, error)
	ListAllEventDays(ctx context.Context) ([]dto.EventDayResponse, error)

	// Tiers
	CreateTier(ctx context.Context, eventDayID string, req dto.CreateTicketTierRequest) (*dto.TicketTierResponse, error)
	ListTiers(ctx context.Context, eventDayID string) ([]dto.TicketTierResponse, error)

	// Tickets
	Purchase(ctx context.Context, req dto.PurchaseTicketRequest, callbackURL string) (*dto.TicketResponse, error)
	HandleWebhook(ctx context.Context, reference string) error
	VerifyAndUpdate(ctx context.Context, reference string) (*dto.TicketResponse, error)
	GetByReference(ctx context.Context, reference string) (*dto.TicketResponse, error)
	GetByCode(ctx context.Context, code string) (*dto.TicketResponse, error)
	SearchByEmail(ctx context.Context, email string) ([]dto.TicketResponse, error)
	Checkin(ctx context.Context, id string, checkedInBy string) error
	AdminCheckin(ctx context.Context, id string, checkedInBy string) error
	List(ctx context.Context, eventDayID string, status string, page int, limit int) ([]dto.TicketResponse, int, error)
}

type TicketService struct {
	eventDayRepo ports.EventDayRepository
	tierRepo     ports.TicketTierRepository
	ticketRepo   ports.TicketRepository
	matchRepo    ports.MatchRepository
	paystack     *PaystackClient
}

func NewTicketService(
	eventDayRepo ports.EventDayRepository,
	tierRepo ports.TicketTierRepository,
	ticketRepo ports.TicketRepository,
	matchRepo ports.MatchRepository,
	paystack *PaystackClient,
) *TicketService {
	return &TicketService{
		eventDayRepo: eventDayRepo,
		tierRepo:     tierRepo,
		ticketRepo:   ticketRepo,
		matchRepo:    matchRepo,
		paystack:     paystack,
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// Event Days
// ═══════════════════════════════════════════════════════════════════════════════

func (s *TicketService) CreateEventDay(ctx context.Context, req dto.CreateEventDayRequest) (*dto.EventDayResponse, error) {
	date, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		return nil, fmt.Errorf("invalid date format, use YYYY-MM-DD: %w", err)
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	ed := &domain.EventDay{
		Title:    req.Title,
		Date:     date,
		Venue:    req.Venue,
		IsActive: isActive,
	}

	if err := s.eventDayRepo.Create(ctx, ed); err != nil {
		return nil, fmt.Errorf("failed to create event day: %w", err)
	}

	return eventDayToResponse(ed, nil, nil), nil
}

func (s *TicketService) UpdateEventDay(ctx context.Context, id string, req dto.UpdateEventDayRequest) error {
	return s.eventDayRepo.Update(ctx, id, req.Title, req.Venue, req.IsActive)
}

func (s *TicketService) GetEventDayByID(ctx context.Context, id string) (*dto.EventDayResponse, error) {
	ed, err := s.eventDayRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	tiers, _ := s.tierRepo.ListByEventDay(ctx, ed.ID)
	matches := s.getMatchesForDate(ctx, ed.Date)

	return eventDayToResponse(ed, tiers, matches), nil
}

func (s *TicketService) GetEventDayByDate(ctx context.Context, date string) (*dto.EventDayResponse, error) {
	ed, err := s.eventDayRepo.GetByDate(ctx, date)
	if err != nil {
		return nil, err
	}

	tiers, _ := s.tierRepo.ListByEventDay(ctx, ed.ID)
	matches := s.getMatchesForDate(ctx, ed.Date)

	return eventDayToResponse(ed, tiers, matches), nil
}

func (s *TicketService) ListActiveEventDays(ctx context.Context) ([]dto.EventDayResponse, error) {
	eventDays, err := s.eventDayRepo.ListActive(ctx)
	if err != nil {
		return nil, err
	}

	var responses []dto.EventDayResponse
	for i := range eventDays {
		tiers, _ := s.tierRepo.ListByEventDay(ctx, eventDays[i].ID)
		matches := s.getMatchesForDate(ctx, eventDays[i].Date)
		responses = append(responses, *eventDayToResponse(&eventDays[i], tiers, matches))
	}
	return responses, nil
}

func (s *TicketService) ListAllEventDays(ctx context.Context) ([]dto.EventDayResponse, error) {
	eventDays, err := s.eventDayRepo.ListAll(ctx)
	if err != nil {
		return nil, err
	}

	var responses []dto.EventDayResponse
	for i := range eventDays {
		tiers, _ := s.tierRepo.ListByEventDay(ctx, eventDays[i].ID)
		responses = append(responses, *eventDayToResponse(&eventDays[i], tiers, nil))
	}
	return responses, nil
}

func (s *TicketService) DeleteEventDay(ctx context.Context, id string) error {
	return s.eventDayRepo.Delete(ctx, id)
}

func (s *TicketService) SearchByEmail(ctx context.Context, email string) ([]dto.TicketResponse, error) {
	tickets, err := s.ticketRepo.SearchByEmail(ctx, email)
	if err != nil {
		return nil, err
	}

	var responses []dto.TicketResponse
	for i := range tickets {
		responses = append(responses, *ticketToResponse(&tickets[i]))
	}
	return responses, nil
}
func (s *TicketService) getMatchesForDate(ctx context.Context, date time.Time) []domain.Match {
	dateStr := date.Format("2006-01-02")
	matches, _, _ := s.matchRepo.GetMatches(ctx, "", "", 1, 50, dateStr)
	return matches
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tiers
// ═══════════════════════════════════════════════════════════════════════════════

func (s *TicketService) CreateTier(ctx context.Context, eventDayID string, req dto.CreateTicketTierRequest) (*dto.TicketTierResponse, error) {
	// Verify event day exists
	if _, err := s.eventDayRepo.GetByID(ctx, eventDayID); err != nil {
		return nil, fmt.Errorf("event day not found: %w", err)
	}

	tier := &domain.TicketTier{
		EventDayID:  eventDayID,
		Name:        req.Name,
		Price:       req.Price,
		Capacity:    req.Capacity,
		Description: req.Description,
	}

	if err := s.tierRepo.Create(ctx, tier); err != nil {
		return nil, fmt.Errorf("failed to create tier: %w", err)
	}

	return tierToResponse(tier), nil
}

func (s *TicketService) ListTiers(ctx context.Context, eventDayID string) ([]dto.TicketTierResponse, error) {
	tiers, err := s.tierRepo.ListByEventDay(ctx, eventDayID)
	if err != nil {
		return nil, err
	}
	var responses []dto.TicketTierResponse
	for i := range tiers {
		responses = append(responses, *tierToResponse(&tiers[i]))
	}
	return responses, nil
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tickets
// ═══════════════════════════════════════════════════════════════════════════════

func (s *TicketService) Purchase(ctx context.Context, req dto.PurchaseTicketRequest, callbackURL string) (*dto.TicketResponse, error) {
	// 1. Look up tier for price
	tier, err := s.tierRepo.GetByID(ctx, req.TierID)
	if err != nil {
		return nil, fmt.Errorf("tier not found: %w", err)
	}

	// Verify tier belongs to the event day
	if tier.EventDayID != req.EventDayID {
		return nil, fmt.Errorf("tier does not belong to this event day")
	}

	// 2. Check capacity
	if tier.Capacity > 0 && (tier.SoldCount+req.Quantity) > tier.Capacity {
		remaining := tier.Capacity - tier.SoldCount
		return nil, fmt.Errorf("not enough tickets available, only %d remaining", remaining)
	}

	// 3. Calculate total
	totalAmount := tier.Price * req.Quantity

	// 4. Generate unique reference
	reference := "SFFL-" + uuid.New().String()[:12]

	// 5. Initialize Paystack transaction
	paystackReq := PaystackInitRequest{
		Email:       req.Email,
		Amount:      totalAmount * 100, // Convert Naira to kobo
		Reference:   reference,
		CallbackURL: callbackURL,
	}

	paystackResp, err := s.paystack.InitializeTransaction(paystackReq)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize payment: %w", err)
	}

	// 6. Create ticket with PENDING status
	ticket := &domain.Ticket{
		EventDayID:         req.EventDayID,
		TierID:             req.TierID,
		Email:              req.Email,
		Quantity:           req.Quantity,
		UnitPrice:          tier.Price,
		TotalAmount:        totalAmount,
		Status:             domain.TicketStatusPending,
		PaystackReference:  paystackResp.Data.Reference,
		PaystackAccessCode: paystackResp.Data.AccessCode,
		TicketCode:         generateTicketCode(),
	}

	if err := s.ticketRepo.Create(ctx, ticket); err != nil {
		return nil, fmt.Errorf("failed to create ticket: %w", err)
	}

	return &dto.TicketResponse{
		ID:                ticket.ID,
		EventDayID:        ticket.EventDayID,
		TierID:            ticket.TierID,
		Email:             ticket.Email,
		Quantity:          ticket.Quantity,
		UnitPrice:         ticket.UnitPrice,
		TotalAmount:       ticket.TotalAmount,
		Status:            string(ticket.Status),
		PaystackReference: ticket.PaystackReference,
		AuthorizationURL:  paystackResp.Data.AuthorizationURL,
		TierName:          tier.Name,
		CreatedAt:         ticket.CreatedAt.Format("2006-01-02T15:04:05Z"),
	}, nil
}

func (s *TicketService) HandleWebhook(ctx context.Context, reference string) error {
	// 1. Verify with Paystack
	verifyResp, err := s.paystack.VerifyTransaction(reference)
	if err != nil {
		return fmt.Errorf("failed to verify transaction: %w", err)
	}

	// 2. Get ticket
	ticket, err := s.ticketRepo.GetByReference(ctx, reference)
	if err != nil {
		return fmt.Errorf("ticket not found for reference %s: %w", reference, err)
	}

	// 3. Idempotency: if already paid, skip
	if ticket.Status == domain.TicketStatusPaid {
		return nil
	}

	// 4. Update based on payment status
	if verifyResp.Data.Status == "success" {
		if err := s.ticketRepo.UpdateStatus(ctx, ticket.ID, domain.TicketStatusPaid); err != nil {
			return err
		}
		// Increment sold count on tier
		return s.tierRepo.IncrementSoldCount(ctx, ticket.TierID, ticket.Quantity)
	}

	return s.ticketRepo.UpdateStatus(ctx, ticket.ID, domain.TicketStatusFailed)
}

func (s *TicketService) GetByReference(ctx context.Context, reference string) (*dto.TicketResponse, error) {
	ticket, err := s.ticketRepo.GetByReference(ctx, reference)
	if err != nil {
		return nil, err
	}
	return ticketToResponse(ticket), nil
}

func (s *TicketService) GetByCode(ctx context.Context, code string) (*dto.TicketResponse, error) {
	ticket, err := s.ticketRepo.GetByCode(ctx, code)
	if err != nil {
		return nil, err
	}
	return ticketToResponse(ticket), nil
}

func (s *TicketService) Checkin(ctx context.Context, id string, checkedInBy string) error {
	return s.ticketRepo.Checkin(ctx, id, checkedInBy)
}

func (s *TicketService) VerifyAndUpdate(ctx context.Context, reference string) (*dto.TicketResponse, error) {
	// 1. Find the ticket
	ticket, err := s.ticketRepo.GetByReference(ctx, reference)
	if err != nil {
		return nil, fmt.Errorf("ticket not found for reference %s: %w", reference, err)
	}

	// 2. If already paid, just return
	if ticket.Status == domain.TicketStatusPaid {
		return ticketToResponse(ticket), nil
	}

	// 3. Verify with Paystack
	verifyResp, err := s.paystack.VerifyTransaction(reference)
	if err != nil {
		return nil, fmt.Errorf("failed to verify transaction: %w", err)
	}

	// 4. Update status based on Paystack response
	if verifyResp.Data.Status == "success" {
		if err := s.ticketRepo.UpdateStatus(ctx, ticket.ID, domain.TicketStatusPaid); err != nil {
			return nil, err
		}
		_ = s.tierRepo.IncrementSoldCount(ctx, ticket.TierID, ticket.Quantity)
		ticket.Status = domain.TicketStatusPaid
	} else {
		if err := s.ticketRepo.UpdateStatus(ctx, ticket.ID, domain.TicketStatusFailed); err != nil {
			return nil, err
		}
		ticket.Status = domain.TicketStatusFailed
	}

	return ticketToResponse(ticket), nil
}

func (s *TicketService) AdminCheckin(ctx context.Context, id string, checkedInBy string) error {
	ticket, err := s.ticketRepo.GetByID(ctx, id)
	if err != nil {
		return fmt.Errorf("ticket not found: %w", err)
	}

	if ticket.Status == domain.TicketStatusUsed {
		return fmt.Errorf("ticket already checked in")
	}

	// If already paid, go straight to check-in
	if ticket.Status == domain.TicketStatusPaid {
		return s.ticketRepo.AdminCheckin(ctx, id, checkedInBy)
	}

	// If pending, try to verify payment first
	if ticket.Status == domain.TicketStatusPending && ticket.PaystackReference != "" {
		verifyResp, verifyErr := s.paystack.VerifyTransaction(ticket.PaystackReference)
		if verifyErr == nil && verifyResp.Data.Status == "success" {
			_ = s.ticketRepo.UpdateStatus(ctx, ticket.ID, domain.TicketStatusPaid)
			_ = s.tierRepo.IncrementSoldCount(ctx, ticket.TierID, ticket.Quantity)
			return s.ticketRepo.AdminCheckin(ctx, id, checkedInBy)
		}
		return fmt.Errorf("could not verify that this ticket has been paid for")
	}

	return fmt.Errorf("ticket is %s and payment could not be verified", ticket.Status)
}

func (s *TicketService) List(ctx context.Context, eventDayID string, status string, page int, limit int) ([]dto.TicketResponse, int, error) {
	tickets, total, err := s.ticketRepo.List(ctx, eventDayID, status, page, limit)
	if err != nil {
		return nil, 0, err
	}

	var responses []dto.TicketResponse
	for i := range tickets {
		responses = append(responses, *ticketToResponse(&tickets[i]))
	}
	return responses, total, nil
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

func eventDayToResponse(ed *domain.EventDay, tiers []domain.TicketTier, matches []domain.Match) *dto.EventDayResponse {
	res := &dto.EventDayResponse{
		ID:        ed.ID,
		Title:     ed.Title,
		Date:      ed.Date.Format("2006-01-02"),
		Venue:     ed.Venue,
		IsActive:  ed.IsActive,
		CreatedAt: ed.CreatedAt.Format("2006-01-02T15:04:05Z"),
	}

	for i := range tiers {
		res.Tiers = append(res.Tiers, *tierToResponse(&tiers[i]))
	}

	for i := range matches {
		m := matches[i]
		edm := dto.EventDayMatch{
			ID:        m.ID,
			StartTime: m.StartTime.Format("2006-01-02T15:04:05Z"),
			Status:    string(m.Status),
			Venue:     m.Venue,
		}
		if m.HomeTeam != nil {
			edm.HomeTeam = m.HomeTeam.Name
		}
		if m.AwayTeam != nil {
			edm.AwayTeam = m.AwayTeam.Name
		}
		res.Matches = append(res.Matches, edm)
	}

	return res
}

func tierToResponse(t *domain.TicketTier) *dto.TicketTierResponse {
	available := 0
	if t.Capacity > 0 {
		available = t.Capacity - t.SoldCount
		if available < 0 {
			available = 0
		}
	}
	return &dto.TicketTierResponse{
		ID:          t.ID,
		EventDayID:  t.EventDayID,
		Name:        t.Name,
		Price:       t.Price,
		Capacity:    t.Capacity,
		SoldCount:   t.SoldCount,
		Available:   available,
		Description: t.Description,
	}
}

func ticketToResponse(t *domain.Ticket) *dto.TicketResponse {
	res := &dto.TicketResponse{
		ID:                t.ID,
		EventDayID:        t.EventDayID,
		TierID:            t.TierID,
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

	if t.EventDay != nil {
		res.EventTitle = t.EventDay.Title
		res.EventDate = t.EventDay.Date.Format("2006-01-02")
		res.EventVenue = t.EventDay.Venue
	}

	if t.Tier != nil {
		res.TierName = t.Tier.Name
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
