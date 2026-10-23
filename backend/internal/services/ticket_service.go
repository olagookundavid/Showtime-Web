package services

import (
	"context"
	"fmt"
	"os"
	"sort"
	"strings"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
	"showtime-backend/pkg/email"

	"github.com/google/uuid"
)

type ITicketService interface {
	// Match days (event days)
	CreateEventDay(ctx context.Context, req dto.CreateEventDayRequest) (*dto.EventDayResponse, error)
	UpdateEventDay(ctx context.Context, id string, req dto.UpdateEventDayRequest) error
	DeleteEventDay(ctx context.Context, id string) error
	GetEventDayByID(ctx context.Context, id string) (*dto.EventDayResponse, error)
	GetEventDayByDate(ctx context.Context, date string) (*dto.EventDayResponse, error)
	ListActiveEventDays(ctx context.Context) ([]dto.EventDayResponse, error)
	ListAllEventDays(ctx context.Context, search string, page, limit int) ([]dto.EventDayResponse, int, error)

	// Products
	CreateProduct(ctx context.Context, req dto.CreateTicketProductRequest) (*dto.TicketProductResponse, error)
	UpdateProduct(ctx context.Context, id string, req dto.UpdateTicketProductRequest) (*dto.TicketProductResponse, error)
	DeleteProduct(ctx context.Context, id string) error
	ListProductsAdmin(ctx context.Context) ([]dto.TicketProductResponse, error)
	ListPublicProducts(ctx context.Context, accessCode string) ([]dto.TicketProductResponse, error)
	GetGamePassRules(ctx context.Context) ([]dto.GamePassRuleResponse, error)
	SaveGamePassRules(ctx context.Context, req dto.SaveGamePassRulesRequest) ([]dto.GamePassRuleResponse, error)
	QuotePrice(ctx context.Context, req dto.PriceQuoteRequest) (*dto.PriceQuoteResponse, error)

	// Season passes
	CreateSeasonPass(ctx context.Context, req dto.CreateSeasonPassRequest) (*dto.SeasonPassResponse, error)
	UpdateSeasonPass(ctx context.Context, id string, req dto.UpdateSeasonPassRequest) (*dto.SeasonPassResponse, error)
	DeleteSeasonPass(ctx context.Context, id string) error
	ListSeasonPassesAdmin(ctx context.Context) ([]dto.SeasonPassResponse, error)
	ListSeasonPasses(ctx context.Context) ([]dto.SeasonPassResponse, error)
	GetSeasonPass(ctx context.Context, id string) (*dto.SeasonPassResponse, error)
	PurchaseSeasonPass(ctx context.Context, req dto.PurchaseSeasonPassRequest, callbackURL string, userID *string) (*dto.TicketResponse, error)

	// Tickets
	Purchase(ctx context.Context, req dto.PurchaseTicketRequest, callbackURL string, userID *string) (*dto.TicketResponse, error)
	GiftTicket(ctx context.Context, req dto.GiftTicketRequest) (*dto.TicketResponse, error)
	HandleWebhook(ctx context.Context, reference string) error
	VerifyAndUpdate(ctx context.Context, reference string) (*dto.TicketResponse, error)
	GetByReference(ctx context.Context, reference string) (*dto.TicketResponse, error)
	GetByCode(ctx context.Context, code string) (*dto.TicketResponse, error)
	SearchByEmail(ctx context.Context, email string, page, limit int) ([]dto.TicketResponse, int, error)
	Checkin(ctx context.Context, id string, checkedInBy string, eventDayID string) error
	AdminCheckin(ctx context.Context, id string, checkedInBy string, eventDayID string) error
	List(ctx context.Context, eventDayID string, status string, page int, limit int) ([]dto.TicketResponse, int, error)
	ExpirePastTickets(ctx context.Context) error
	CreateReferralCode(ctx context.Context, req dto.CreateReferralRequest) (*dto.ReferralResponse, error)
	LookupReferralByName(ctx context.Context, name string) ([]dto.ReferralResponse, error)
	ListReferralStats(ctx context.Context, search string, page int, limit int) ([]dto.ReferralStatsResponse, int, error)
}

type TicketService struct {
	eventDayRepo  ports.EventDayRepository
	productRepo   ports.TicketProductRepository
	ticketRepo    ports.TicketRepository
	scheduledRepo ports.ScheduledEmailRepository
	seasonRepo    ports.SeasonPassRepository
	// userPhones is optional: when set, a signed-in buyer's phone is kept on their
	// profile after they pay.
	userPhones      UserPhoneSaver
	matchRepo       ports.MatchRepository
	paystack        *PaystackClient
	email           ports.EmailService
	discountService IDiscountService
	discountRepo    ports.IDiscountRepository
}

func NewTicketService(
	eventDayRepo ports.EventDayRepository,
	productRepo ports.TicketProductRepository,
	ticketRepo ports.TicketRepository,
	scheduledRepo ports.ScheduledEmailRepository,
	seasonRepo ports.SeasonPassRepository,
	matchRepo ports.MatchRepository,
	paystack *PaystackClient,
	emailService ports.EmailService,
	discountService IDiscountService,
	discountRepo ports.IDiscountRepository,
) *TicketService {
	return &TicketService{
		discountService: discountService,
		discountRepo:    discountRepo,
		eventDayRepo:    eventDayRepo,
		productRepo:     productRepo,
		ticketRepo:      ticketRepo,
		scheduledRepo:   scheduledRepo,
		seasonRepo:      seasonRepo,
		matchRepo:       matchRepo,
		paystack:        paystack,
		email:           emailService,
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// Match days (event days)
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

	return eventDayToResponse(ed, nil), nil
}

func (s *TicketService) UpdateEventDay(ctx context.Context, id string, req dto.UpdateEventDayRequest) error {
	var parsedDate *time.Time
	if req.Date != nil && strings.TrimSpace(*req.Date) != "" {
		d, err := time.Parse("2006-01-02", *req.Date)
		if err != nil {
			return fmt.Errorf("invalid date format, use YYYY-MM-DD: %w", err)
		}
		parsedDate = &d
	}
	if err := s.eventDayRepo.Update(ctx, id, req.Title, parsedDate, req.Venue, req.IsActive); err != nil {
		return err
	}
	// A moved match day moves the reminders that are waiting on it.
	if parsedDate != nil && s.scheduledRepo != nil {
		if err := s.scheduledRepo.RescheduleForEventDay(ctx, id, reminderDaysBefore, reminderHour); err != nil {
			fmt.Printf("⚠️ WARNING: failed to reschedule reminders for event day %s: %s\n", id, err.Error())
		}
	}
	return nil
}

func (s *TicketService) GetEventDayByID(ctx context.Context, id string) (*dto.EventDayResponse, error) {
	ed, err := s.eventDayRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return eventDayToResponse(ed, s.getMatchesForDate(ctx, ed.Date)), nil
}

func (s *TicketService) GetEventDayByDate(ctx context.Context, date string) (*dto.EventDayResponse, error) {
	ed, err := s.eventDayRepo.GetByDate(ctx, date)
	if err != nil {
		return nil, err
	}
	return eventDayToResponse(ed, s.getMatchesForDate(ctx, ed.Date)), nil
}

func (s *TicketService) ListActiveEventDays(ctx context.Context) ([]dto.EventDayResponse, error) {
	eventDays, err := s.eventDayRepo.ListActive(ctx)
	if err != nil {
		return nil, err
	}

	responses := make([]dto.EventDayResponse, 0, len(eventDays))
	for i := range eventDays {
		responses = append(responses, *eventDayToResponse(&eventDays[i], nil))
	}
	return responses, nil
}

func (s *TicketService) ListAllEventDays(ctx context.Context, search string, page, limit int) ([]dto.EventDayResponse, int, error) {
	eventDays, total, err := s.eventDayRepo.ListAll(ctx, search, page, limit)
	if err != nil {
		return nil, 0, err
	}

	responses := make([]dto.EventDayResponse, 0, len(eventDays))
	for i := range eventDays {
		responses = append(responses, *eventDayToResponse(&eventDays[i], nil))
	}
	return responses, total, nil
}

func (s *TicketService) DeleteEventDay(ctx context.Context, id string) error {
	return s.eventDayRepo.Delete(ctx, id)
}

func (s *TicketService) SearchByEmail(ctx context.Context, email string, page, limit int) ([]dto.TicketResponse, int, error) {
	tickets, total, err := s.ticketRepo.SearchByEmail(ctx, email, page, limit)
	if err != nil {
		return nil, 0, err
	}

	responses := make([]dto.TicketResponse, 0, len(tickets))
	for i := range tickets {
		responses = append(responses, *ticketToResponse(&tickets[i]))
	}
	return responses, total, nil
}

func (s *TicketService) getMatchesForDate(ctx context.Context, date time.Time) []domain.Match {
	dateStr := date.Format("2006-01-02")
	// dateStr is the trailing variadic `date` argument, NOT `search`. Passing it
	// positionally landed it in search, which looks for a team or competition
	// *named* "2026-08-15" — so this always came back empty and event days showed
	// no fixtures.
	matches, _, _ := s.matchRepo.GetMatches(ctx, "", "", "", 1, 50, "", "", dateStr)
	return matches
}

// ═══════════════════════════════════════════════════════════════════════════════
// Purchasing
// ═══════════════════════════════════════════════════════════════════════════════

// maxPassDays bounds a Game Pass so a request cannot lock an unbounded number of
// rows in one transaction.
const maxPassDays = 30

// selection is a validated ticket plus the match days it is being bought for.
type selection struct {
	product *domain.TicketProduct
	days    []domain.TicketProductDay // sorted by date
}

func (sel *selection) dayPrices() []int {
	prices := make([]int, len(sel.days))
	for i, d := range sel.days {
		prices[i] = d.Price
	}
	return prices
}

func uniqueIDs(ids []string) []string {
	seen := make(map[string]bool, len(ids))
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		id = strings.TrimSpace(id)
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true
		out = append(out, id)
	}
	return out
}

// resolveSelection checks that a ticket can be bought for the requested match
// days and returns the priced days. It is the single gate in front of quoting,
// purchasing and gifting, so all three agree on what is allowed.
//
// A match day is on sale for a ticket when it has a match in a competition the
// ticket is linked to, so a day outside those competitions is refused here.
//
// adminIssue skips the hidden-ticket access code, which an admin issuing a
// complimentary ticket has no need for.
func (s *TicketService) resolveSelection(ctx context.Context, productID string, eventDayIDs []string, quantity int, accessCode string, adminIssue bool) (*selection, error) {
	ids := uniqueIDs(eventDayIDs)
	if len(ids) == 0 {
		return nil, fmt.Errorf("choose at least one match day")
	}
	if len(ids) > maxPassDays {
		return nil, fmt.Errorf("a Game Pass can cover at most %d match days", maxPassDays)
	}
	// Ids come from the browser; refuse a malformed one here rather than let the
	// database's own error message reach a buyer.
	if _, err := uuid.Parse(productID); err != nil {
		return nil, fmt.Errorf("ticket not found")
	}
	for _, id := range ids {
		if _, err := uuid.Parse(id); err != nil {
			return nil, fmt.Errorf("one of the selected match days is not valid")
		}
	}

	product, err := s.productRepo.GetProduct(ctx, productID)
	if err != nil {
		return nil, fmt.Errorf("ticket not found")
	}
	if !product.IsActive {
		return nil, fmt.Errorf("%s is not on sale", product.Name)
	}
	if product.IsHidden && !adminIssue && !accessCodeMatches(product.AccessCode, accessCode) {
		return nil, fmt.Errorf("ticket not found")
	}

	days, err := s.productRepo.ResolveProductDays(ctx, productID, ids)
	if err != nil {
		return nil, fmt.Errorf("failed to load match days: %w", err)
	}
	if len(days) != len(ids) {
		return nil, fmt.Errorf("%s is not on sale for one of the selected match days", product.Name)
	}

	today := todayLagos(time.Now())
	for _, d := range days {
		title := d.EventDay.Title
		if !d.EventDay.IsActive {
			return nil, fmt.Errorf("tickets are not on sale for %s", title)
		}
		if dateOnly(d.EventDay.Date).Before(today) {
			return nil, fmt.Errorf("cannot buy tickets for a past match day (%s)", d.EventDay.Date.Format("2006-01-02"))
		}
		if avail := d.Available(); avail >= 0 && quantity > avail {
			return nil, fmt.Errorf("not enough tickets available for %s, only %d remaining", title, avail)
		}
	}

	sort.SliceStable(days, func(i, j int) bool {
		return days[i].EventDay.Date.Before(days[j].EventDay.Date)
	})
	return &selection{product: product, days: days}, nil
}

func accessCodeMatches(productCode *string, given string) bool {
	if productCode == nil || strings.TrimSpace(*productCode) == "" {
		return false
	}
	return strings.EqualFold(strings.TrimSpace(*productCode), strings.TrimSpace(given))
}

// ticketDaysFor builds the TicketDay rows a Create call needs from a selection.
func ticketDaysFor(sel *selection) []domain.TicketDay {
	days := make([]domain.TicketDay, len(sel.days))
	for i, d := range sel.days {
		days[i] = domain.TicketDay{
			EventDayID:   d.EventDayID,
			ProductDayID: d.ID,
			UnitPrice:    d.Price,
		}
	}
	return days
}

// QuotePrice prices a selection with the same code the purchase uses, so the
// number shown while choosing is the number that is charged.
func (s *TicketService) QuotePrice(ctx context.Context, req dto.PriceQuoteRequest) (*dto.PriceQuoteResponse, error) {
	sel, err := s.resolveSelection(ctx, req.ProductID, req.EventDayIDs, req.Quantity, "", true)
	if err != nil {
		return nil, err
	}
	rules, err := s.productRepo.ListGamePassRules(ctx)
	if err != nil {
		return nil, err
	}
	p := PriceTicket(sel.dayPrices(), req.Quantity, rules)
	return &dto.PriceQuoteResponse{
		UnitPrice:               p.UnitPrice,
		Subtotal:                p.Subtotal,
		GamePassDiscountPercent: p.GamePassPercent,
		GamePassDiscountAmount:  p.GamePassAmount,
		Total:                   p.Total,
		Days:                    len(sel.days),
	}, nil
}

// Purchase books a ticket. userID is the authenticated buyer when there is one
// and nil for a guest checkout; it is taken from the caller's token, never from
// the request body.
func (s *TicketService) Purchase(ctx context.Context, req dto.PurchaseTicketRequest, callbackURL string, userID *string) (*dto.TicketResponse, error) {
	// Codes are not accepted on tickets for now. Refuse one rather than quietly
	// charge full price to someone who thinks they have a discount.
	if strings.TrimSpace(req.DiscountCode) != "" {
		return nil, fmt.Errorf("discount codes can't be used on tickets right now. A Game Pass gets a percentage off when you add more match days")
	}

	// 1. Validate the ticket, the match days and availability.
	sel, err := s.resolveSelection(ctx, req.ProductID, req.EventDayIDs, req.Quantity, req.AccessCode, false)
	if err != nil {
		return nil, err
	}

	// 2. Price it server-side. Nothing here trusts a client-sent amount.
	rules, err := s.productRepo.ListGamePassRules(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to load Game Pass pricing: %w", err)
	}
	pricing := PriceTicket(sel.dayPrices(), req.Quantity, rules)

	return s.checkout(ctx, checkoutInput{
		sel:          sel,
		pricing:      pricing,
		purchaseType: domain.PurchaseTypeGamePass,
		productName:  sel.product.Name,
		email:        req.Email,
		name:         req.Name,
		phone:        req.Phone,
		quantity:     req.Quantity,
		referralCode: req.ReferralCode,
		callbackURL:  callbackURL,
		userID:       userID,
	})
}

// checkoutInput is a priced selection ready to be paid for, whichever kind of pass
// it is. Purchase and PurchaseSeasonPass differ only in how they arrive here.
type checkoutInput struct {
	sel          *selection
	pricing      TicketPricing
	purchaseType domain.PurchaseType
	seasonPassID *string
	// productName is what the ticket is called on the receipt and in sales
	// reports: the ticket's name, or the season pass's.
	productName  string
	email, name  string
	phone        string
	quantity     int
	referralCode *string
	callbackURL  string
	userID       *string
}

// checkout starts payment (or settles a free pass at once) and creates the
// ticket with its seats. It is the one place money is taken.
func (s *TicketService) checkout(ctx context.Context, in checkoutInput) (*dto.TicketResponse, error) {
	sel, pricing, totalAmount := in.sel, in.pricing, in.pricing.Total
	var days []domain.TicketDay
	if sel != nil {
		days = ticketDaysFor(sel)
	}
	req := struct {
		Email, Name, Phone string
		Quantity           int
		ReferralCode       *string
	}{in.email, in.name, in.phone, in.quantity, in.referralCode}
	callbackURL, userID := in.callbackURL, in.userID

	// Generate unique reference
	reference := "SFFL-" + uuid.New().String()[:12]

	var paystackRef *string
	var paystackAccessCode *string
	var authURL string
	var ticketStatus = domain.TicketStatusPending

	// If the ticket is free, bypass Paystack entirely
	if totalAmount == 0 {
		paystackRef = &reference
		ticketStatus = domain.TicketStatusPaid
	} else {
		// 4. Initialize Paystack transaction
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

		paystackRef = &paystackResp.Data.Reference
		paystackAccessCode = &paystackResp.Data.AccessCode
		authURL = paystackResp.Data.AuthorizationURL
	}

	var referralCode *string
	if req.ReferralCode != nil && *req.ReferralCode != "" {
		rc, err := s.ticketRepo.GetReferralCode(ctx, *req.ReferralCode)
		if err == nil && rc != nil {
			referralCode = &rc.Code
		}
	}

	// 5. Create ticket with collision protection
	var ticket *domain.Ticket
	maxRetries := 5
	var lastErr error

	for i := 0; i < maxRetries; i++ {
		// A season pass is not made from a ticket, so it has no product.
		var productID *string
		if sel != nil {
			id := sel.product.ID
			productID = &id
		}
		ticket = &domain.Ticket{
			ProductID:               productID,
			ProductName:             in.productName,
			PurchaseType:            in.purchaseType,
			SeasonPassID:            in.seasonPassID,
			Email:                   req.Email,
			Phone:                   req.Phone,
			Name:                    req.Name,
			UserID:                  userID,
			Quantity:                req.Quantity,
			UnitPrice:               pricing.UnitPrice,
			Subtotal:                pricing.Subtotal,
			TotalAmount:             totalAmount,
			Status:                  ticketStatus,
			PaystackReference:       paystackRef,
			PaystackAccessCode:      paystackAccessCode,
			TicketCode:              GenerateTicketCode(),
			ReferralCode:            referralCode,
			GamePassDiscountPercent: pricing.GamePassPercent,
			GamePassDiscountAmount:  pricing.GamePassAmount,
			Days:                    days,
		}

		if err := s.ticketRepo.Create(ctx, ticket); err != nil {
			// Check if it's a unique constraint violation on ticket_code
			// If so, loop and try again with a new code
			if strings.Contains(err.Error(), "tickets_ticket_code_key") || strings.Contains(err.Error(), "duplicate key value") {
				lastErr = err
				continue
			}
			return nil, fmt.Errorf("failed to create ticket: %w", err)
		}

		// Success
		lastErr = nil
		break
	}

	if lastErr != nil {
		return nil, fmt.Errorf("failed to generate unique ticket code after %d attempts: %w", maxRetries, lastErr)
	}

	if ticket.Status == domain.TicketStatusPaid {
		s.OnTicketPaid(ctx, ticket)
	}

	res := ticketToResponse(ticket)
	res.AuthorizationURL = authURL
	// The code is only revealed once the ticket is paid.
	if ticket.Status != domain.TicketStatusPaid {
		res.TicketCode = ""
	}
	return res, nil
}

// GiftTicket issues a complimentary ticket without going through payment.
// The ticket is created as PAID immediately and the standard confirmation
// email (with the ticket code) is sent, exactly like a normal purchase.
func (s *TicketService) GiftTicket(ctx context.Context, req dto.GiftTicketRequest) (*dto.TicketResponse, error) {
	ids := uniqueIDs(req.EventDayIDs)

	sel, err := s.resolveSelection(ctx, req.ProductID, ids, req.Quantity, "", true)
	if err != nil {
		return nil, err
	}
	pricing := PriceTicket(sel.dayPrices(), req.Quantity, nil)

	// Create the ticket as a free, already-paid comp ticket.
	// Retry on the (extremely unlikely) ticket_code / reference collision.
	reference := "SFFL-GIFT-" + uuid.New().String()[:8]

	var ticket *domain.Ticket
	maxRetries := 5
	var lastErr error

	for i := 0; i < maxRetries; i++ {
		ref := reference
		productID := sel.product.ID
		ticket = &domain.Ticket{
			ProductID:         &productID,
			ProductName:       sel.product.Name,
			PurchaseType:      domain.PurchaseTypeGamePass,
			Email:             req.Email,
			Phone:             req.Phone,
			Name:              req.Name,
			Quantity:          req.Quantity,
			UnitPrice:         pricing.UnitPrice,
			Subtotal:          pricing.Subtotal,
			TotalAmount:       pricing.Total,
			Status:            domain.TicketStatusPaid,
			PaystackReference: &ref,
			TicketCode:        GenerateTicketCode(),
			Days:              ticketDaysFor(sel),
		}

		if err := s.ticketRepo.Create(ctx, ticket); err != nil {
			if strings.Contains(err.Error(), "tickets_ticket_code_key") || strings.Contains(err.Error(), "duplicate key value") {
				lastErr = err
				reference = "SFFL-GIFT-" + uuid.New().String()[:8]
				continue
			}
			return nil, fmt.Errorf("failed to create ticket: %w", err)
		}

		lastErr = nil
		break
	}

	if lastErr != nil {
		return nil, fmt.Errorf("failed to generate unique ticket after %d attempts: %w", maxRetries, lastErr)
	}

	s.OnTicketPaid(ctx, ticket)
	return ticketToResponse(ticket), nil
}

// OnTicketPaid does what has to happen once a ticket is confirmed paid, whichever
// way it got there (webhook, verify, free checkout, gift, team allocation): send
// the confirmation and queue a reminder ahead of each match day.
func (s *TicketService) OnTicketPaid(ctx context.Context, ticket *domain.Ticket) {
	s.sendPurchaseEmail(ticket)
	s.scheduleReminders(ctx, ticket)
	rememberBuyerPhone(ctx, s.userPhones, ticket.UserID, ticket.Phone)
}

// WithUserPhoneSaver wires in where a signed-in buyer's phone is kept. Separate
// from the constructor because environments that only read tickets do not need it.
func (s *TicketService) WithUserPhoneSaver(saver UserPhoneSaver) *TicketService {
	s.userPhones = saver
	return s
}

// verifyTicketPayment is the authoritative money check before a ticket is
// marked PAID. A "success" status from Paystack is NOT enough on its own — we
// must confirm the amount actually charged matches the ticket's total (in
// kobo) and the currency is NGN. Without this, an underpaid or mismatched
// transaction could fulfill a ticket. Returns nil only when the payment is
// genuinely valid for this ticket.
func verifyTicketPayment(verifyResp *PaystackVerifyResponse, ticket *domain.Ticket) error {
	if verifyResp == nil || verifyResp.Data.Status != "success" {
		return fmt.Errorf("payment not successful")
	}
	expectedKobo := ticket.TotalAmount * 100
	if verifyResp.Data.Amount < expectedKobo {
		return fmt.Errorf("payment amount mismatch: charged %d kobo, expected %d kobo", verifyResp.Data.Amount, expectedKobo)
	}
	// Currency may be empty on older/edge responses; only reject a definite mismatch.
	if verifyResp.Data.Currency != "" && verifyResp.Data.Currency != "NGN" {
		return fmt.Errorf("unexpected payment currency %q", verifyResp.Data.Currency)
	}
	return nil
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

	// 4. Update based on payment status — verify the money, not just the status.
	if err := verifyTicketPayment(verifyResp, ticket); err == nil {
		if err := s.ticketRepo.UpdateStatus(ctx, ticket.ID, domain.TicketStatusPaid); err != nil {
			return err
		}
		ticket.Status = domain.TicketStatusPaid
		// Settle the discount hold. Only 'reserved' rows move, so a webhook retry
		// changes nothing.
		if err := s.discountRepo.ConfirmRedemption(ctx, nil, &ticket.ID); err != nil {
			fmt.Printf("⚠️ WARNING: failed to confirm discount on ticket %s: %s\n", ticket.ID, err.Error())
		}
		s.OnTicketPaid(ctx, ticket)
		return nil
	}

	// Payment failed — hand the code use back rather than burning it.
	if err := s.discountRepo.ReleaseRedemption(ctx, nil, &ticket.ID); err != nil {
		fmt.Printf("⚠️ WARNING: failed to release discount on ticket %s: %s\n", ticket.ID, err.Error())
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

	// 4. Update status based on Paystack response — verify the money, not just status.
	if err := verifyTicketPayment(verifyResp, ticket); err == nil {
		if err := s.ticketRepo.UpdateStatus(ctx, ticket.ID, domain.TicketStatusPaid); err != nil {
			return nil, err
		}
		if err := s.discountRepo.ConfirmRedemption(ctx, nil, &ticket.ID); err != nil {
			fmt.Printf("⚠️ WARNING: failed to confirm discount on ticket %s: %s\n", ticket.ID, err.Error())
		}
		ticket.Status = domain.TicketStatusPaid
		s.OnTicketPaid(ctx, ticket)
	} else {
		if err := s.ticketRepo.UpdateStatus(ctx, ticket.ID, domain.TicketStatusFailed); err != nil {
			return nil, err
		}
		if err := s.discountRepo.ReleaseRedemption(ctx, nil, &ticket.ID); err != nil {
			fmt.Printf("⚠️ WARNING: failed to release discount on ticket %s: %s\n", ticket.ID, err.Error())
		}
		ticket.Status = domain.TicketStatusFailed
	}

	return ticketToResponse(ticket), nil
}

func (s *TicketService) List(ctx context.Context, eventDayID string, status string, page int, limit int) ([]dto.TicketResponse, int, error) {
	tickets, total, err := s.ticketRepo.List(ctx, eventDayID, status, page, limit)
	if err != nil {
		return nil, 0, err
	}

	responses := make([]dto.TicketResponse, 0, len(tickets))
	for i := range tickets {
		responses = append(responses, *ticketToResponse(&tickets[i]))
	}
	return responses, total, nil
}

func (s *TicketService) ExpirePastTickets(ctx context.Context) error {
	count, err := s.ticketRepo.ExpirePastTickets(ctx)
	if err != nil {
		return fmt.Errorf("failed to expire past tickets: %w", err)
	}
	if count > 0 {
		fmt.Printf("Successfully expired %d old tickets\n", count)
	}
	return nil
}

// ═══════════════════════════════════════════════════════════════════════════════
// Check-in
// ═══════════════════════════════════════════════════════════════════════════════

// describeDays lists a ticket's days for an error message.
func describeDays(days []domain.TicketDay) string {
	parts := make([]string, 0, len(days))
	for _, d := range days {
		parts = append(parts, d.Date.Format("Mon 2 Jan"))
	}
	return strings.Join(parts, ", ")
}

// dayForCheckin picks which of a ticket's days a check-in is for. An explicit day
// must be on the ticket. Otherwise it is today's match day.
//
// A strict check-in (the gate) only ever admits a ticket on the day it is for, so
// an explicit day must also be today, and a ticket with no day today is turned
// away. The admin override (strict=false) may pick any day, falling back to the
// earliest one not yet attended.
func dayForCheckin(ticket *domain.Ticket, eventDayID string, strict bool, now time.Time) (*domain.TicketDay, error) {
	today := todayLagos(now)
	isToday := func(d *domain.TicketDay) bool {
		return !d.Date.IsZero() && dateOnly(d.Date).Equal(today)
	}

	if eventDayID != "" {
		for i := range ticket.Days {
			if ticket.Days[i].EventDayID != eventDayID {
				continue
			}
			if strict && !isToday(&ticket.Days[i]) {
				return nil, fmt.Errorf("%s is not today. This ticket covers: %s", ticket.Days[i].Title, describeDays(ticket.Days))
			}
			return &ticket.Days[i], nil
		}
		return nil, fmt.Errorf("this ticket is not valid for that match day. It covers: %s", describeDays(ticket.Days))
	}

	for i := range ticket.Days {
		if isToday(&ticket.Days[i]) {
			return &ticket.Days[i], nil
		}
	}
	if strict {
		return nil, fmt.Errorf("this ticket is not valid today. It covers: %s", describeDays(ticket.Days))
	}
	for i := range ticket.Days {
		if ticket.Days[i].CheckedInAt == nil {
			return &ticket.Days[i], nil
		}
	}
	return nil, fmt.Errorf("ticket already checked in for every day")
}

// Checkin admits a ticket for one match day: the one given, or today's.
func (s *TicketService) Checkin(ctx context.Context, id string, checkedInBy string, eventDayID string) error {
	ticket, err := s.ticketRepo.GetByID(ctx, id)
	if err != nil {
		return fmt.Errorf("ticket not found: %w", err)
	}
	if ticket.Status != domain.TicketStatusPaid && ticket.Status != domain.TicketStatusUsed {
		return fmt.Errorf("ticket is %s, not PAID", ticket.Status)
	}
	if ticket.PurchaseType == domain.PurchaseTypeSeasonPass {
		return s.checkinSeasonPass(ctx, ticket, checkedInBy)
	}
	day, err := dayForCheckin(ticket, eventDayID, true, time.Now())
	if err != nil {
		return err
	}
	if day.CheckedInAt != nil {
		return fmt.Errorf("ticket already checked in for %s", day.Title)
	}
	return s.ticketRepo.CheckinDay(ctx, ticket.ID, day.EventDayID, checkedInBy)
}

// checkinSeasonPass lets a season pass in. It is valid on every day up to its end
// date, so being let in twice on one day is not an error; the repository records
// the day once and refuses a pass that has ended or is not paid.
func (s *TicketService) checkinSeasonPass(ctx context.Context, ticket *domain.Ticket, checkedInBy string) error {
	_, err := s.ticketRepo.CheckinSeasonPass(ctx, ticket.ID, checkedInBy)
	return err
}

// AdminCheckin is the override path: it will first try to confirm an unpaid ticket
// with Paystack, and does not insist the day is today.
func (s *TicketService) AdminCheckin(ctx context.Context, id string, checkedInBy string, eventDayID string) error {
	ticket, err := s.ticketRepo.GetByID(ctx, id)
	if err != nil {
		return fmt.Errorf("ticket not found: %w", err)
	}

	switch ticket.Status {
	case domain.TicketStatusPaid, domain.TicketStatusUsed:
		// go straight to check-in
	case domain.TicketStatusPending:
		// If pending, try to verify payment first
		if ticket.PaystackReference == nil {
			return fmt.Errorf("could not verify that this ticket has been paid for")
		}
		verifyResp, verifyErr := s.paystack.VerifyTransaction(*ticket.PaystackReference)
		if verifyErr != nil || verifyTicketPayment(verifyResp, ticket) != nil {
			return fmt.Errorf("could not verify that this ticket has been paid for")
		}
		_ = s.ticketRepo.UpdateStatus(ctx, ticket.ID, domain.TicketStatusPaid)
		ticket.Status = domain.TicketStatusPaid
		s.OnTicketPaid(ctx, ticket)
	default:
		return fmt.Errorf("ticket is %s and payment could not be verified", ticket.Status)
	}

	if ticket.PurchaseType == domain.PurchaseTypeSeasonPass {
		return s.checkinSeasonPass(ctx, ticket, checkedInBy)
	}
	day, err := dayForCheckin(ticket, eventDayID, false, time.Now())
	if err != nil {
		return err
	}
	if day.CheckedInAt != nil {
		return fmt.Errorf("ticket already checked in for %s", day.Title)
	}
	return s.ticketRepo.CheckinDay(ctx, ticket.ID, day.EventDayID, checkedInBy)
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

// passNameFor is what a purchase is called in emails.
func passNameFor(ticket *domain.Ticket) string {
	if ticket.PurchaseType == domain.PurchaseTypeSeasonPass {
		return "Season Pass"
	}
	return "Game Pass"
}

func formatDay(d domain.TicketDay) email.TicketEmailDay {
	date := ""
	if !d.Date.IsZero() {
		date = d.Date.Format("Mon, Jan 02 2006")
	}
	return email.TicketEmailDay{Title: d.Title, Date: date, Venue: d.Venue}
}

func (s *TicketService) sendPurchaseEmail(ticket *domain.Ticket) {
	if s.email == nil {
		return
	}
	if ticket.PurchaseType == domain.PurchaseTypeSeasonPass {
		s.sendSeasonPassEmail(ticket)
		return
	}
	if len(ticket.Days) == 0 {
		return
	}
	days := make([]email.TicketEmailDay, len(ticket.Days))
	for i, d := range ticket.Days {
		days[i] = formatDay(d)
	}

	passName := passNameFor(ticket)
	subject := fmt.Sprintf("IT'S SHOWTIME 🏈, Your %s for %s", passName, days[0].Title)
	if len(days) > 1 {
		subject = fmt.Sprintf("IT'S SHOWTIME 🏈, Your %s (%d match days)", passName, len(days))
	}
	body := email.PurchaseEmailHTML(email.PurchaseEmailData{
		PassName:    passName,
		BuyerName:   ticket.Name,
		ProductName: ticket.ProductName,
		Phone:       ticket.Phone,
		TicketCode:  ticket.TicketCode,
		Quantity:    ticket.Quantity,
		TotalAmount: ticket.TotalAmount,
		Days:        days,
	})

	to := ticket.Email
	_ = SubmitJob(func() {
		if err := s.email.SendEmail(to, subject, body); err != nil {
			fmt.Printf("Failed to send purchase email to %s: %v\n", to, err)
		}
	})
}

// sendSeasonPassEmail confirms a season pass: its name, the date it is valid until,
// and the code to show at the entrance. It has no match days to list.
func (s *TicketService) sendSeasonPassEmail(ticket *domain.Ticket) {
	validUntil := ""
	if ticket.ValidUntil != nil {
		if d, err := time.Parse("2006-01-02", *ticket.ValidUntil); err == nil {
			validUntil = d.Format("Mon, Jan 02 2006")
		}
	}
	subject := fmt.Sprintf("IT'S SHOWTIME 🏈, Your %s", ticket.ProductName)
	body := email.PurchaseEmailHTML(email.PurchaseEmailData{
		PassName:    "Season Pass",
		BuyerName:   ticket.Name,
		ProductName: ticket.ProductName,
		Phone:       ticket.Phone,
		TicketCode:  ticket.TicketCode,
		Quantity:    ticket.Quantity,
		TotalAmount: ticket.TotalAmount,
		ValidUntil:  validUntil,
	})
	to := ticket.Email
	_ = SubmitJob(func() {
		if err := s.email.SendEmail(to, subject, body); err != nil {
			fmt.Printf("Failed to send season pass email to %s: %v\n", to, err)
		}
	})
}

func eventDayToResponse(ed *domain.EventDay, matches []domain.Match) *dto.EventDayResponse {
	res := &dto.EventDayResponse{
		ID:        ed.ID,
		Title:     ed.Title,
		Date:      ed.Date.Format("2006-01-02"),
		Venue:     ed.Venue,
		IsActive:  ed.IsActive,
		CreatedAt: ed.CreatedAt.Format("2006-01-02T15:04:05Z"),
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

func ticketToResponse(t *domain.Ticket) *dto.TicketResponse {
	res := &dto.TicketResponse{
		ID:                      t.ID,
		ProductName:             t.ProductName,
		PurchaseType:            string(t.PurchaseType),
		Email:                   t.Email,
		Phone:                   t.Phone,
		Name:                    t.Name,
		Quantity:                t.Quantity,
		UnitPrice:               t.UnitPrice,
		Subtotal:                t.Subtotal,
		GamePassDiscountPercent: t.GamePassDiscountPercent,
		GamePassDiscountAmount:  t.GamePassDiscountAmount,
		DiscountAmount:          t.DiscountAmount,
		TotalAmount:             t.TotalAmount,
		Status:                  string(t.Status),
		TicketCode:              t.TicketCode,
		CreatedAt:               t.CreatedAt.Format("2006-01-02T15:04:05Z"),
		Days:                    []dto.TicketDayResponse{},
	}

	if t.ProductID != nil {
		res.ProductID = *t.ProductID
	}
	if t.SeasonPassID != nil {
		res.SeasonPassID = *t.SeasonPassID
	}
	if t.ValidUntil != nil {
		res.ValidUntil = *t.ValidUntil
	}
	if t.DiscountCode != nil {
		res.DiscountCode = *t.DiscountCode
	}
	if t.ReferralCode != nil {
		res.ReferralCode = *t.ReferralCode
	}
	if t.PaystackReference != nil {
		res.PaystackReference = *t.PaystackReference
	}

	for _, d := range t.Days {
		dr := dto.TicketDayResponse{
			ID:         d.ID,
			EventDayID: d.EventDayID,
			Title:      d.Title,
			Venue:      d.Venue,
			UnitPrice:  d.UnitPrice,
		}
		if !d.Date.IsZero() {
			dr.Date = d.Date.Format("2006-01-02")
		}
		if d.CheckedInAt != nil {
			formatted := d.CheckedInAt.Format("2006-01-02T15:04:05Z")
			dr.CheckedInAt = &formatted
		}
		dr.CheckedInBy = d.CheckedInBy
		res.Days = append(res.Days, dr)
	}

	return res
}

// generateTicketCode is now legacy, use GenerateTicketCode in ticket_utils.go
func (s *TicketService) generateTicketCode() string {
	return GenerateTicketCode()
}

func (s *TicketService) CreateReferralCode(ctx context.Context, req dto.CreateReferralRequest) (*dto.ReferralResponse, error) {
	var code string
	maxRetries := 10
	var lastErr error

	for i := 0; i < maxRetries; i++ {
		code = GenerateReferralCode()

		// Check if code already exists
		existing, err := s.ticketRepo.GetReferralCode(ctx, code)
		if err == nil && existing != nil {
			continue // collision, retry
		}

		rc := &domain.TicketReferralCode{
			Code:  code,
			Name:  req.Name,
			Email: req.Email,
		}

		if err := s.ticketRepo.CreateReferralCode(ctx, rc); err != nil {
			if strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "unique") {
				lastErr = err
				continue
			}
			return nil, fmt.Errorf("failed to create referral code: %w", err)
		}

		// Success!
		lastErr = nil

		// Send email if address is provided
		if req.Email != nil && *req.Email != "" && s.email != nil {
			emailAddr := *req.Email
			name := req.Name
			codeCopy := code
			_ = SubmitJob(func() {
				frontendURL := os.Getenv("FRONTEND_URL")
				if frontendURL == "" {
					frontendURL = "http://localhost:5173"
				}
				referralLink := fmt.Sprintf("%s/tickets?ref=%s", frontendURL, codeCopy)

				subject := "SFFL Referral Code Generated! 🏈"
				body := email.BuildReferralEmail(name, codeCopy, referralLink)
				if err := s.email.SendEmail(emailAddr, subject, body); err != nil {
					fmt.Printf("Failed to send referral email to %s: %v\n", emailAddr, err)
				}
			})
		}

		return &dto.ReferralResponse{
			ID:        rc.ID,
			Code:      rc.Code,
			Name:      rc.Name,
			Email:     rc.Email,
			CreatedAt: rc.CreatedAt.Format("2006-01-02T15:04:05Z"),
		}, nil
	}

	if lastErr != nil {
		return nil, fmt.Errorf("failed to generate unique referral code: %w", lastErr)
	}
	return nil, fmt.Errorf("failed to generate unique referral code after %d attempts", maxRetries)
}

func (s *TicketService) LookupReferralByName(ctx context.Context, name string) ([]dto.ReferralResponse, error) {
	list, err := s.ticketRepo.LookupReferralsByName(ctx, name)
	if err != nil {
		return nil, err
	}

	responses := []dto.ReferralResponse{}
	for _, rc := range list {
		responses = append(responses, dto.ReferralResponse{
			ID:        rc.ID,
			Code:      rc.Code,
			Name:      rc.Name,
			Email:     rc.Email,
			CreatedAt: rc.CreatedAt.Format("2006-01-02T15:04:05Z"),
		})
	}
	return responses, nil
}

func (s *TicketService) ListReferralStats(ctx context.Context, search string, page int, limit int) ([]dto.ReferralStatsResponse, int, error) {
	stats, total, err := s.ticketRepo.ListReferralStats(ctx, search, page, limit)
	if err != nil {
		return nil, 0, err
	}

	responses := []dto.ReferralStatsResponse{}
	for _, rs := range stats {
		responses = append(responses, dto.ReferralStatsResponse{
			ID:           rs.ID,
			Code:         rs.Code,
			Name:         rs.Name,
			Email:        rs.Email,
			TicketsSold:  rs.TicketsSold,
			TotalRevenue: rs.TotalRevenue,
			CreatedAt:    rs.CreatedAt.Format("2006-01-02T15:04:05Z"),
		})
	}
	return responses, total, nil
}
