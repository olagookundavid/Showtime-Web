package services

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	appErrors "showtime-backend/internal/errors"
	"showtime-backend/internal/ports"
	"showtime-backend/pkg/email"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// IGamePassService owns the Game Pass bundle product: the season admission
// rates and the discount bands it is priced from.
type IGamePassService interface {
	// Season admission tiers
	ListSeasonTiers(ctx context.Context, activeOnly bool) ([]dto.SeasonAdmissionTierResponse, error)
	CreateSeasonTier(ctx context.Context, req dto.CreateSeasonAdmissionTierRequest) (*dto.SeasonAdmissionTierResponse, error)
	UpdateSeasonTier(ctx context.Context, id string, req dto.UpdateSeasonAdmissionTierRequest) (*dto.SeasonAdmissionTierResponse, error)
	DeleteSeasonTier(ctx context.Context, id string) error

	// Discount bands
	ListDiscountBands(ctx context.Context, activeOnly bool) ([]dto.GamePassDiscountBandResponse, error)
	GetDiscountBand(ctx context.Context, id string) (*dto.GamePassDiscountBandResponse, error)
	CreateDiscountBand(ctx context.Context, req dto.CreateGamePassDiscountBandRequest) (*dto.GamePassDiscountBandResponse, error)
	UpdateDiscountBand(ctx context.Context, id string, req dto.UpdateGamePassDiscountBandRequest) (*dto.GamePassDiscountBandResponse, error)
	SetDiscountBandStatus(ctx context.Context, id string, isActive bool) (*dto.GamePassDiscountBandResponse, error)
	DeleteDiscountBand(ctx context.Context, id string) error

	// Leads
	CreateLead(ctx context.Context, req dto.CreateGamePassLeadRequest) (*dto.GamePassLeadResponse, error)
	ListLeads(ctx context.Context, status, email string, page, limit int) ([]dto.GamePassLeadResponse, int, error)
	UpdateLeadStatus(ctx context.Context, id string, status string) (*dto.GamePassLeadResponse, error)

	// Orders. Checkout returns the order with a Paystack authorization_url; the
	// webhook and verify settle it. Both settle paths are idempotent.
	Checkout(ctx context.Context, req dto.GamePassCheckoutRequest, callbackURL string, userID *string) (*dto.GamePassOrderResponse, error)
	HandleWebhook(ctx context.Context, reference string) error
	VerifyPayment(ctx context.Context, reference string) (*dto.GamePassOrderResponse, error)
	GetOrderByReference(ctx context.Context, reference string) (*dto.GamePassOrderResponse, error)
	ListOrders(ctx context.Context, status, email string, page, limit int) ([]dto.GamePassOrderResponse, int, error)
	GetOrder(ctx context.Context, id string) (*dto.GamePassOrderResponse, error)
}

type GamePassService struct {
	seasonTierRepo ports.SeasonAdmissionTierRepository
	bandRepo       ports.GamePassDiscountBandRepository
	leadRepo       ports.GamePassLeadRepository
	eventDayRepo   ports.EventDayRepository
	ticketTierRepo ports.TicketTierRepository
	orderRepo      ports.GamePassOrderRepository
	paystack       *PaystackClient
	email          ports.EmailService
}

func NewGamePassService(
	seasonTierRepo ports.SeasonAdmissionTierRepository,
	bandRepo ports.GamePassDiscountBandRepository,
	leadRepo ports.GamePassLeadRepository,
	eventDayRepo ports.EventDayRepository,
	ticketTierRepo ports.TicketTierRepository,
	orderRepo ports.GamePassOrderRepository,
	paystack *PaystackClient,
	emailService ports.EmailService,
) IGamePassService {
	return &GamePassService{
		seasonTierRepo: seasonTierRepo,
		bandRepo:       bandRepo,
		leadRepo:       leadRepo,
		eventDayRepo:   eventDayRepo,
		ticketTierRepo: ticketTierRepo,
		orderRepo:      orderRepo,
		paystack:       paystack,
		email:          emailService,
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// Season Admission Tiers
// ═══════════════════════════════════════════════════════════════════════════════

func (s *GamePassService) ListSeasonTiers(ctx context.Context, activeOnly bool) ([]dto.SeasonAdmissionTierResponse, error) {
	tiers, err := s.seasonTierRepo.List(ctx, activeOnly)
	if err != nil {
		return nil, err
	}
	res := make([]dto.SeasonAdmissionTierResponse, 0, len(tiers))
	for i := range tiers {
		res = append(res, seasonTierToResponse(&tiers[i]))
	}
	return res, nil
}

func (s *GamePassService) CreateSeasonTier(ctx context.Context, req dto.CreateSeasonAdmissionTierRequest) (*dto.SeasonAdmissionTierResponse, error) {
	t := &domain.SeasonAdmissionTier{
		Name:         strings.TrimSpace(req.Name),
		Price:        req.Price,
		Description:  req.Description,
		DisplayOrder: req.DisplayOrder,
		IsActive:     true,
	}
	if req.IsActive != nil {
		t.IsActive = *req.IsActive
	}
	if err := validateSeasonTier(t); err != nil {
		return nil, err
	}
	if err := s.seasonTierRepo.Create(ctx, t); err != nil {
		return nil, err
	}
	res := seasonTierToResponse(t)
	return &res, nil
}

func (s *GamePassService) UpdateSeasonTier(ctx context.Context, id string, req dto.UpdateSeasonAdmissionTierRequest) (*dto.SeasonAdmissionTierResponse, error) {
	t, err := s.seasonTierRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if req.Name != nil {
		t.Name = strings.TrimSpace(*req.Name)
	}
	if req.Price != nil {
		t.Price = *req.Price
	}
	if req.Description != nil {
		t.Description = *req.Description
	}
	if req.DisplayOrder != nil {
		t.DisplayOrder = *req.DisplayOrder
	}
	if req.IsActive != nil {
		t.IsActive = *req.IsActive
	}
	if err := validateSeasonTier(t); err != nil {
		return nil, err
	}
	if err := s.seasonTierRepo.Update(ctx, t); err != nil {
		return nil, err
	}
	res := seasonTierToResponse(t)
	return &res, nil
}

func (s *GamePassService) DeleteSeasonTier(ctx context.Context, id string) error {
	return s.seasonTierRepo.Delete(ctx, id)
}

func validateSeasonTier(t *domain.SeasonAdmissionTier) error {
	if t.Name == "" {
		return appErrors.InvalidGamePassConfig("tier name cannot be empty")
	}
	if t.Price < 0 {
		return appErrors.InvalidGamePassConfig("tier price cannot be negative")
	}
	return nil
}

func seasonTierToResponse(t *domain.SeasonAdmissionTier) dto.SeasonAdmissionTierResponse {
	return dto.SeasonAdmissionTierResponse{
		ID:           t.ID,
		Name:         t.Name,
		Price:        t.Price,
		Description:  t.Description,
		DisplayOrder: t.DisplayOrder,
		IsActive:     t.IsActive,
		CreatedAt:    t.CreatedAt,
		UpdatedAt:    t.UpdatedAt,
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// Discount Bands
// ═══════════════════════════════════════════════════════════════════════════════

func (s *GamePassService) ListDiscountBands(ctx context.Context, activeOnly bool) ([]dto.GamePassDiscountBandResponse, error) {
	bands, err := s.bandRepo.List(ctx, activeOnly)
	if err != nil {
		return nil, err
	}
	res := make([]dto.GamePassDiscountBandResponse, 0, len(bands))
	for i := range bands {
		res = append(res, discountBandToResponse(&bands[i]))
	}
	return res, nil
}

func (s *GamePassService) GetDiscountBand(ctx context.Context, id string) (*dto.GamePassDiscountBandResponse, error) {
	b, err := s.bandRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	res := discountBandToResponse(b)
	return &res, nil
}

func (s *GamePassService) CreateDiscountBand(ctx context.Context, req dto.CreateGamePassDiscountBandRequest) (*dto.GamePassDiscountBandResponse, error) {
	b := &domain.GamePassDiscountBand{
		MinGamedays:     req.MinGamedays,
		MaxGamedays:     req.MaxGamedays,
		DiscountPercent: req.DiscountPercent,
		DisplayOrder:    req.DisplayOrder,
		IsActive:        true,
	}
	if req.IsActive != nil {
		b.IsActive = *req.IsActive
	}
	return s.saveDiscountBand(ctx, b)
}

// UpdateDiscountBand applies a partial edit: omitted fields keep their stored
// value, and max_gamedays sent as null makes the band open ended.
func (s *GamePassService) UpdateDiscountBand(ctx context.Context, id string, req dto.UpdateGamePassDiscountBandRequest) (*dto.GamePassDiscountBandResponse, error) {
	b, err := s.bandRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if req.MinGamedays != nil {
		b.MinGamedays = *req.MinGamedays
	}
	if req.MaxGamedays.Set {
		b.MaxGamedays = req.MaxGamedays.Value
	}
	if req.DiscountPercent != nil {
		b.DiscountPercent = *req.DiscountPercent
	}
	if req.DisplayOrder != nil {
		b.DisplayOrder = *req.DisplayOrder
	}
	if req.IsActive != nil {
		b.IsActive = *req.IsActive
	}
	return s.saveDiscountBand(ctx, b)
}

func (s *GamePassService) SetDiscountBandStatus(ctx context.Context, id string, isActive bool) (*dto.GamePassDiscountBandResponse, error) {
	b, err := s.bandRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	b.IsActive = isActive
	return s.saveDiscountBand(ctx, b)
}

func (s *GamePassService) DeleteDiscountBand(ctx context.Context, id string) error {
	return s.bandRepo.Delete(ctx, id)
}

// saveDiscountBand is the one write path for create, edit and status changes,
// so every one of them goes through the same validation. The check runs inside
// the repository's locked transaction against the bands as they stand then.
func (s *GamePassService) saveDiscountBand(ctx context.Context, b *domain.GamePassDiscountBand) (*dto.GamePassDiscountBandResponse, error) {
	err := s.bandRepo.Save(ctx, b, func(all []domain.GamePassDiscountBand) error {
		if err := domain.ValidateDiscountBand(*b, all); err != nil {
			return appErrors.InvalidGamePassConfig("%s", err.Error())
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	res := discountBandToResponse(b)
	return &res, nil
}

func discountBandToResponse(b *domain.GamePassDiscountBand) dto.GamePassDiscountBandResponse {
	return dto.GamePassDiscountBandResponse{
		ID:              b.ID,
		MinGamedays:     b.MinGamedays,
		MaxGamedays:     b.MaxGamedays,
		DiscountPercent: b.DiscountPercent,
		DisplayOrder:    b.DisplayOrder,
		IsActive:        b.IsActive,
		CreatedAt:       b.CreatedAt,
		UpdatedAt:       b.UpdatedAt,
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// Quote
// ═══════════════════════════════════════════════════════════════════════════════

// GamePassQuote is a bundle priced server side from the stored season rate and
// active bands. Anything the buyer saw before this is only a preview.
type GamePassQuote struct {
	Tier     domain.SeasonAdmissionTier
	Gamedays []domain.EventDay
	Price    domain.GamePassPrice
}

// quote validates a bundle selection and prices it. The caller sends only the
// tier, gamedays and holders; every figure comes from the database. Repeated
// gameday IDs are counted once.
func (s *GamePassService) quote(ctx context.Context, tierID string, gamedayIDs []string, holders int) (*GamePassQuote, error) {
	if holders < 1 || holders > domain.MaxGamePassHolders {
		return nil, appErrors.InvalidGamePassConfig("a Game Pass covers 1 to %d pass holders", domain.MaxGamePassHolders)
	}

	ids := make([]string, 0, len(gamedayIDs))
	seen := map[string]bool{}
	for _, id := range gamedayIDs {
		id = strings.ToLower(strings.TrimSpace(id))
		if id != "" && !seen[id] {
			seen[id] = true
			ids = append(ids, id)
		}
	}
	if len(ids) < domain.MinGamePassGamedays {
		return nil, appErrors.InvalidGamePassConfig("pick at least %d gamedays for a Game Pass", domain.MinGamePassGamedays)
	}

	tier, err := s.seasonTierRepo.GetByID(ctx, tierID)
	if err != nil {
		if errors.Is(err, appErrors.ErrNotFound) {
			return nil, appErrors.InvalidGamePassConfig("that admission tier isn't available")
		}
		return nil, err
	}
	if !tier.IsActive {
		return nil, appErrors.InvalidGamePassConfig("the %s tier isn't available for Game Pass", tier.Name)
	}

	// Same "not in the past" rule single ticket purchases use.
	today := time.Now().Truncate(24 * time.Hour)
	gamedays := make([]domain.EventDay, 0, len(ids))
	for _, id := range ids {
		ed, err := s.eventDayRepo.GetByID(ctx, id)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, appErrors.InvalidGamePassConfig("one of the selected gamedays no longer exists")
			}
			return nil, err
		}
		if !ed.IsActive {
			return nil, appErrors.InvalidGamePassConfig("%s isn't on sale", ed.Title)
		}
		if ed.Date.Truncate(24 * time.Hour).Before(today) {
			return nil, appErrors.InvalidGamePassConfig("%s has already taken place", ed.Title)
		}
		gamedays = append(gamedays, *ed)
	}

	bands, err := s.bandRepo.List(ctx, true)
	if err != nil {
		return nil, err
	}

	return &GamePassQuote{
		Tier:     *tier,
		Gamedays: gamedays,
		Price:    domain.PriceGamePass(tier.Price, len(gamedays), holders, bands),
	}, nil
}

// ═══════════════════════════════════════════════════════════════════════════════
// Leads
// ═══════════════════════════════════════════════════════════════════════════════

func (s *GamePassService) CreateLead(ctx context.Context, req dto.CreateGamePassLeadRequest) (*dto.GamePassLeadResponse, error) {
	name := strings.TrimSpace(req.Name)
	phone := strings.TrimSpace(req.Phone)
	if name == "" || phone == "" {
		return nil, appErrors.InvalidGamePassConfig("name and phone are required")
	}

	q, err := s.quote(ctx, req.TierID, req.GamedayIDs, req.Holders)
	if err != nil {
		return nil, err
	}

	lead := &domain.GamePassLead{
		Name:     name,
		Email:    strings.TrimSpace(req.Email),
		Phone:    phone,
		TierName: q.Tier.Name,
		Price:    q.Price,
		Status:   domain.GamePassLeadNew,
		Gamedays: q.Gamedays,
	}
	for _, ed := range q.Gamedays {
		lead.GamedayIDs = append(lead.GamedayIDs, ed.ID)
	}

	if err := s.leadRepo.Create(ctx, lead); err != nil {
		return nil, err
	}
	res := leadToResponse(lead)
	return &res, nil
}

func (s *GamePassService) ListLeads(ctx context.Context, status, email string, page, limit int) ([]dto.GamePassLeadResponse, int, error) {
	if status != "" && !domain.GamePassLeadStatus(status).Valid() {
		return nil, 0, appErrors.InvalidGamePassConfig("unknown lead status %q", status)
	}
	leads, total, err := s.leadRepo.List(ctx, status, strings.TrimSpace(email), page, limit)
	if err != nil {
		return nil, 0, err
	}
	res := make([]dto.GamePassLeadResponse, 0, len(leads))
	for i := range leads {
		res = append(res, leadToResponse(&leads[i]))
	}
	return res, total, nil
}

func (s *GamePassService) UpdateLeadStatus(ctx context.Context, id string, status string) (*dto.GamePassLeadResponse, error) {
	st := domain.GamePassLeadStatus(status)
	if !st.Valid() {
		return nil, appErrors.InvalidGamePassConfig("unknown lead status %q", status)
	}
	if err := s.leadRepo.UpdateStatus(ctx, id, st); err != nil {
		return nil, err
	}
	lead, err := s.leadRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	res := leadToResponse(lead)
	return &res, nil
}

func leadToResponse(l *domain.GamePassLead) dto.GamePassLeadResponse {
	res := dto.GamePassLeadResponse{
		ID:              l.ID,
		Name:            l.Name,
		Email:           l.Email,
		Phone:           l.Phone,
		TierName:        l.TierName,
		GamedayIDs:      l.GamedayIDs,
		Gamedays:        make([]dto.GamePassGameday, 0, len(l.Gamedays)),
		Holders:         l.Price.Holders,
		StandardTotal:   l.Price.StandardTotal,
		DiscountPercent: l.Price.DiscountPercent,
		DiscountAmount:  l.Price.DiscountAmount,
		Total:           l.Price.Total,
		Status:          string(l.Status),
		CreatedAt:       l.CreatedAt,
		UpdatedAt:       l.UpdatedAt,
	}
	for _, ed := range l.Gamedays {
		res.Gamedays = append(res.Gamedays, dto.GamePassGameday{
			ID:    ed.ID,
			Title: ed.Title,
			Date:  ed.Date.Format("2006-01-02"),
		})
	}
	return res
}

// ═══════════════════════════════════════════════════════════════════════════════
// Orders
// ═══════════════════════════════════════════════════════════════════════════════

// Checkout prices the bundle server side, reserves one seat per holder on each
// gameday, and opens a Paystack transaction for the total. The client's own
// preview total is never read.
func (s *GamePassService) Checkout(ctx context.Context, req dto.GamePassCheckoutRequest, callbackURL string, userID *string) (*dto.GamePassOrderResponse, error) {
	name := strings.TrimSpace(req.Name)
	phone := strings.TrimSpace(req.Phone)
	if name == "" || phone == "" {
		return nil, appErrors.InvalidGamePassConfig("name and phone are required")
	}

	q, err := s.quote(ctx, req.TierID, req.GamedayIDs, req.Holders)
	if err != nil {
		return nil, err
	}

	// Each gameday must sell the chosen tier, matched by name, as a visible
	// ticket tier: that tier carries the capacity and check-in for the tickets.
	lines := make([]domain.GamePassOrderLine, 0, len(q.Gamedays))
	for _, ed := range q.Gamedays {
		tiers, err := s.ticketTierRepo.ListByEventDay(ctx, ed.ID)
		if err != nil {
			return nil, err
		}
		var match *domain.TicketTier
		for i := range tiers {
			if !tiers[i].IsHidden && strings.EqualFold(strings.TrimSpace(tiers[i].Name), strings.TrimSpace(q.Tier.Name)) {
				match = &tiers[i]
				break
			}
		}
		if match == nil {
			return nil, appErrors.InvalidGamePassConfig("%s doesn't offer %s admission", ed.Title, q.Tier.Name)
		}
		lines = append(lines, domain.GamePassOrderLine{EventDayID: ed.ID, TicketTierID: match.ID})
	}

	reference := domain.GamePassReferencePrefix + strings.ToUpper(uuid.New().String()[:12])
	tierID := q.Tier.ID
	order := &domain.GamePassOrder{
		Name:              name,
		Email:             strings.TrimSpace(req.Email),
		Phone:             phone,
		UserID:            userID,
		SeasonTierID:      &tierID,
		TierName:          q.Tier.Name,
		Price:             q.Price,
		PaystackReference: &reference,
	}

	// Reserve before talking to Paystack, so a sold-out gameday fails fast and
	// never leaves an orphan Paystack transaction behind.
	const maxAttempts = 5
	for attempt := 1; ; attempt++ {
		codes := make([]string, len(lines)*q.Price.Holders)
		for i := range codes {
			codes[i] = GenerateTicketCode()
		}
		err = s.orderRepo.Create(ctx, order, lines, codes)
		if !errors.Is(err, ports.ErrTicketCodeTaken) || attempt == maxAttempts {
			break
		}
	}
	if err != nil {
		return nil, err
	}

	// A free bundle (a ₦0 season rate) never goes through Paystack.
	if q.Price.Total == 0 {
		if err := s.settlePaid(ctx, order.ID); err != nil {
			return nil, err
		}
		return s.GetOrderByReference(ctx, reference)
	}

	init, err := s.paystack.InitializeTransaction(PaystackInitRequest{
		Email:       order.Email,
		Amount:      q.Price.Total * 100, // naira to kobo
		Reference:   reference,
		CallbackURL: callbackURL,
	})
	if err != nil {
		// Hand the reserved seats back rather than holding them for the window.
		if mErr := s.orderRepo.MarkFailed(ctx, order.ID); mErr != nil {
			fmt.Printf("⚠️ WARNING: failed to release game pass order %s: %s\n", order.ID, mErr.Error())
		}
		return nil, fmt.Errorf("failed to initialize payment: %w", err)
	}
	if err := s.orderRepo.SetAccessCode(ctx, order.ID, init.Data.AccessCode); err != nil {
		fmt.Printf("⚠️ WARNING: failed to store access code on game pass order %s: %s\n", order.ID, err.Error())
	}

	order.Gamedays = q.Gamedays
	res := orderToResponse(order, false)
	res.AuthorizationURL = init.Data.AuthorizationURL
	return &res, nil
}

// HandleWebhook settles a Game Pass order from Paystack's charge.success.
// Idempotent: a paid order is left alone, and settlePaid only acts once.
func (s *GamePassService) HandleWebhook(ctx context.Context, reference string) error {
	order, err := s.orderRepo.GetByReference(ctx, reference)
	if err != nil {
		return fmt.Errorf("game pass order not found for reference %s: %w", reference, err)
	}
	_, err = s.confirmPayment(ctx, order)
	return err
}

// VerifyPayment is the buyer's return from Paystack: it settles the order if
// the webhook hasn't yet, and returns it (with ticket codes once paid).
func (s *GamePassService) VerifyPayment(ctx context.Context, reference string) (*dto.GamePassOrderResponse, error) {
	order, err := s.orderRepo.GetByReference(ctx, reference)
	if err != nil {
		return nil, err
	}
	if _, err := s.confirmPayment(ctx, order); err != nil {
		return nil, err
	}
	return s.GetOrderByReference(ctx, reference)
}

// confirmPayment checks the money with Paystack — status, amount and currency,
// not status alone — and settles the order either way. It reports whether the
// order is paid.
func (s *GamePassService) confirmPayment(ctx context.Context, order *domain.GamePassOrder) (bool, error) {
	if order.PaymentStatus == domain.GamePassOrderPaid {
		return true, nil
	}
	if order.PaystackReference == nil {
		return false, fmt.Errorf("game pass order %s has no payment reference", order.ID)
	}

	resp, err := s.paystack.VerifyTransaction(*order.PaystackReference)
	if err != nil {
		return false, fmt.Errorf("failed to verify transaction: %w", err)
	}
	if err := verifyPaystackAmount(resp, order.Price.Total); err != nil {
		fmt.Printf("⚠️ WARNING: game pass order %s not paid: %s\n", order.ID, err.Error())
		return false, s.orderRepo.MarkFailed(ctx, order.ID)
	}
	return true, s.settlePaid(ctx, order.ID)
}

// settlePaid marks the order and its tickets paid and, only if this call is
// the one that did it, emails the buyer their codes.
func (s *GamePassService) settlePaid(ctx context.Context, orderID string) error {
	changed, err := s.orderRepo.MarkPaid(ctx, orderID)
	if err != nil || !changed {
		return err
	}
	order, err := s.orderRepo.GetByID(ctx, orderID)
	if err != nil {
		fmt.Printf("⚠️ WARNING: game pass order %s paid but could not be reloaded for email: %s\n", orderID, err.Error())
		return nil
	}
	s.sendConfirmationEmail(order)
	return nil
}

func (s *GamePassService) sendConfirmationEmail(order *domain.GamePassOrder) {
	if s.email == nil {
		return
	}

	// Group the codes by gameday, in date order.
	var days []email.GamePassEmailDay
	index := map[string]int{}
	for _, t := range order.Tickets {
		if t.Status != domain.TicketStatusPaid {
			continue
		}
		key := t.EventDayID
		i, ok := index[key]
		if !ok {
			d := email.GamePassEmailDay{}
			if t.EventDay != nil {
				d.Title = t.EventDay.Title
				d.Venue = t.EventDay.Venue
				if !t.EventDay.Date.IsZero() {
					d.Date = t.EventDay.Date.Format("Mon, Jan 02 2006")
				}
			}
			days = append(days, d)
			i = len(days) - 1
			index[key] = i
		}
		days[i].Codes = append(days[i].Codes, t.TicketCode)
	}
	if len(days) == 0 {
		return
	}

	subject := fmt.Sprintf("IT'S SHOWTIME 🏈, Your %s Game Pass", order.TierName)
	body := email.GamePassEmailHTML(order.Name, order.TierName, order.Price.Holders, order.Price.DiscountPercent, order.Price.Total, days)
	to := order.Email
	_ = SubmitJob(func() {
		if err := s.email.SendEmail(to, subject, body); err != nil {
			fmt.Printf("Failed to send game pass email to %s: %v\n", to, err)
		}
	})
}

// GetOrderByReference is the public lookup behind the payment return page.
// Ticket codes are only shown once the order is paid.
func (s *GamePassService) GetOrderByReference(ctx context.Context, reference string) (*dto.GamePassOrderResponse, error) {
	order, err := s.orderRepo.GetByReference(ctx, reference)
	if err != nil {
		return nil, err
	}
	res := orderToResponse(order, order.PaymentStatus == domain.GamePassOrderPaid)
	return &res, nil
}

func (s *GamePassService) ListOrders(ctx context.Context, status, email string, page, limit int) ([]dto.GamePassOrderResponse, int, error) {
	switch domain.GamePassOrderStatus(status) {
	case "", domain.GamePassOrderPending, domain.GamePassOrderPaid, domain.GamePassOrderFailed:
	default:
		return nil, 0, appErrors.InvalidGamePassConfig("unknown payment status %q", status)
	}
	orders, total, err := s.orderRepo.List(ctx, status, strings.TrimSpace(email), page, limit)
	if err != nil {
		return nil, 0, err
	}
	res := make([]dto.GamePassOrderResponse, 0, len(orders))
	for i := range orders {
		res = append(res, orderToResponse(&orders[i], false))
	}
	return res, total, nil
}

// GetOrder is the admin detail: the order with its gamedays and every bundled
// ticket, whatever the payment status.
func (s *GamePassService) GetOrder(ctx context.Context, id string) (*dto.GamePassOrderResponse, error) {
	order, err := s.orderRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	res := orderToResponse(order, true)
	return &res, nil
}

func orderToResponse(o *domain.GamePassOrder, withTickets bool) dto.GamePassOrderResponse {
	res := dto.GamePassOrderResponse{
		ID:              o.ID,
		Name:            o.Name,
		Email:           o.Email,
		Phone:           o.Phone,
		TierName:        o.TierName,
		UnitPrice:       o.Price.UnitPrice,
		GamedayCount:    o.Price.Gamedays,
		Holders:         o.Price.Holders,
		StandardTotal:   o.Price.StandardTotal,
		DiscountPercent: o.Price.DiscountPercent,
		DiscountAmount:  o.Price.DiscountAmount,
		Total:           o.Price.Total,
		PaymentStatus:   string(o.PaymentStatus),
		PaidAt:          o.PaidAt,
		CreatedAt:       o.CreatedAt,
		UpdatedAt:       o.UpdatedAt,
		Gamedays:        make([]dto.GamePassGameday, 0, len(o.Gamedays)),
	}
	if o.PaystackReference != nil {
		res.PaystackReference = *o.PaystackReference
	}
	for _, ed := range o.Gamedays {
		res.Gamedays = append(res.Gamedays, dto.GamePassGameday{
			ID:    ed.ID,
			Title: ed.Title,
			Date:  ed.Date.Format("2006-01-02"),
			Venue: ed.Venue,
		})
	}
	if withTickets {
		for _, t := range o.Tickets {
			ticket := dto.GamePassOrderTicket{
				ID:          t.ID,
				TicketCode:  t.TicketCode,
				EventDayID:  t.EventDayID,
				Status:      string(t.Status),
				TotalAmount: t.TotalAmount,
				CheckedInAt: t.CheckedInAt,
			}
			if t.EventDay != nil {
				ticket.EventTitle = t.EventDay.Title
				ticket.EventVenue = t.EventDay.Venue
				if !t.EventDay.Date.IsZero() {
					ticket.EventDate = t.EventDay.Date.Format("2006-01-02")
				}
			}
			if t.Tier != nil {
				ticket.TierName = t.Tier.Name
			}
			res.Tickets = append(res.Tickets, ticket)
		}
	}
	return res
}
