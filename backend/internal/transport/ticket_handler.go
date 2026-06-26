package transport

import (
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"

	"showtime-backend/internal/dto"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type ITicketHandler interface {
	ListEventDays(c *gin.Context)
	GetEventDay(c *gin.Context)
	GetEventDayByDate(c *gin.Context)
	CreateEventDay(c *gin.Context)
	UpdateEventDay(c *gin.Context)
	DeleteEventDay(c *gin.Context)
	ListAllEventDays(c *gin.Context)
	CreateTier(c *gin.Context)
	DeleteTier(c *gin.Context)
	Purchase(c *gin.Context)
	GiftTicket(c *gin.Context)
	Webhook(c *gin.Context)
	GetTicket(c *gin.Context)
	LookupByCode(c *gin.Context)
	Checkin(c *gin.Context)
	VerifyTicket(c *gin.Context)
	AdminCheckin(c *gin.Context)
	ListTickets(c *gin.Context)
	SearchByEmail(c *gin.Context)
	CreateReferralCode(c *gin.Context)
	LookupReferralByName(c *gin.Context)
	ListReferralStats(c *gin.Context)
}


type TicketHandler struct {
	service  services.ITicketService
	paystack *services.PaystackClient
}

func NewTicketHandler(service services.ITicketService, paystack *services.PaystackClient) ITicketHandler {
	return &TicketHandler{service: service, paystack: paystack}
}

// ═══════════════════════════════════════════════════════════════════════════════
// Event Days
// ═══════════════════════════════════════════════════════════════════════════════

// ListEventDays godoc
// @Summary List active event days with tiers
// @Tags event-days
// @Produce json
// @Success 200
// @Router /api/v1/event-days [get]
func (h *TicketHandler) ListEventDays(c *gin.Context) {
	code := c.Query("code")
	eventDays, err := h.service.ListActiveEventDays(c.Request.Context(), code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": eventDays})
}

// GetEventDay godoc
// @Summary Get event day by ID
// @Tags event-days
// @Produce json
// @Param id path string true "Event Day ID"
// @Success 200
// @Router /api/v1/event-days/{id} [get]
func (h *TicketHandler) GetEventDay(c *gin.Context) {
	id := c.Param("id")
	code := c.Query("code")
	eventDay, err := h.service.GetEventDayByID(c.Request.Context(), id, code)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "event day not found"})
		return
	}
	c.JSON(http.StatusOK, eventDay)
}

// GetEventDayByDate godoc
// @Summary Get event day by date
// @Tags event-days
// @Produce json
// @Param date path string true "Date (YYYY-MM-DD)"
// @Success 200
// @Router /api/v1/event-days/by-date/{date} [get]
func (h *TicketHandler) GetEventDayByDate(c *gin.Context) {
	date := c.Param("date")
	code := c.Query("code")
	eventDay, err := h.service.GetEventDayByDate(c.Request.Context(), date, code)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "no event day found for this date"})
		return
	}
	c.JSON(http.StatusOK, eventDay)
}

// CreateEventDay godoc
// @Summary Create an event day (admin)
// @Tags event-days
// @Accept json
// @Produce json
// @Param body body dto.CreateEventDayRequest true "Event Day"
// @Success 201
// @Router /api/v1/event-days [post]
func (h *TicketHandler) CreateEventDay(c *gin.Context) {
	var req dto.CreateEventDayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.service.CreateEventDay(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, result)
}

// UpdateEventDay godoc
// @Summary Update an event day (admin)
// @Tags event-days
// @Accept json
// @Produce json
// @Param id path string true "Event Day ID"
// @Param body body dto.UpdateEventDayRequest true "Update fields"
// @Success 200
// @Router /api/v1/event-days/{id} [put]
func (h *TicketHandler) UpdateEventDay(c *gin.Context) {
	id := c.Param("id")
	var req dto.UpdateEventDayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.UpdateEventDay(c.Request.Context(), id, req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "event day updated"})
}

// DeleteEventDay godoc
// @Summary Delete an event day (admin)
// @Tags event-days
// @Produce json
// @Param id path string true "Event Day ID"
// @Success 200
// @Router /api/v1/event-days/{id} [delete]
func (h *TicketHandler) DeleteEventDay(c *gin.Context) {
	id := c.Param("id")
	if err := h.service.DeleteEventDay(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "event day deleted"})
}

func (h *TicketHandler) ListAllEventDays(c *gin.Context) {
	eventDays, err := h.service.ListAllEventDays(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": eventDays})
}

// ═══════════════════════════════════════════════════════════════════════════════
// Ticket Tiers
// ═══════════════════════════════════════════════════════════════════════════════

// CreateTier godoc
// @Summary Create a ticket tier for an event day (admin)
// @Tags event-days
// @Accept json
// @Produce json
// @Param id path string true "Event Day ID"
// @Param body body dto.CreateTicketTierRequest true "Tier"
// @Success 201
// @Router /api/v1/event-days/{id}/tiers [post]
func (h *TicketHandler) CreateTier(c *gin.Context) {
	eventDayID := c.Param("id")
	var req dto.CreateTicketTierRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.service.CreateTier(c.Request.Context(), eventDayID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, result)
}

func (h *TicketHandler) DeleteTier(c *gin.Context) {
	id := c.Param("tierId")
	if err := h.service.DeleteTier(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "tier deleted"})
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tickets
// ═══════════════════════════════════════════════════════════════════════════════

// Purchase godoc
// @Summary Purchase tickets
// @Tags tickets
// @Accept json
// @Produce json
// @Param body body dto.PurchaseTicketRequest true "Purchase request"
// @Success 201 {object} dto.TicketResponse
// @Router /api/v1/tickets/purchase [post]
func (h *TicketHandler) Purchase(c *gin.Context) {
	var req dto.PurchaseTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Build the callback URL from the request
	scheme := "https"
	if c.Request.TLS == nil {
		scheme = "http"
	}
	callbackURL := scheme + "://" + c.Request.Host + "/tickets/confirm"

	// Override with frontend origin if present
	origin := c.GetHeader("Origin")
	if origin != "" {
		callbackURL = origin + "/tickets/confirm"
	}

	result, err := h.service.Purchase(c.Request.Context(), req, callbackURL)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, result)
}

// GiftTicket godoc
// @Summary Issue a complimentary ticket (App Admin only)
// @Tags tickets
// @Accept json
// @Produce json
// @Param body body dto.GiftTicketRequest true "Gift ticket request"
// @Success 201 {object} dto.TicketResponse
// @Router /api/v1/admin/administrator/gift-ticket [post]
func (h *TicketHandler) GiftTicket(c *gin.Context) {
	var req dto.GiftTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.service.GiftTicket(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, result)
}

// Webhook godoc
// @Summary Paystack webhook handler
// @Tags tickets
// @Accept json
// @Success 200
// @Router /api/v1/tickets/webhook [post]
func (h *TicketHandler) Webhook(c *gin.Context) {

	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot read body"})
		return
	}

	// Verify Paystack HMAC signature (REQUIRED)
	signature := c.GetHeader("x-paystack-signature")
	if signature == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing signature"})
		return
	}

	mac := hmac.New(sha512.New, []byte(h.paystack.GetSecretKey()))
	mac.Write(body)
	expectedMAC := hex.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(signature), []byte(expectedMAC)) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid signature"})
		return
	}

	var payload struct {
		Event string `json:"event"`
		Data  struct {
			Reference string `json:"reference"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	if payload.Event == "charge.success" {
		if err := h.service.HandleWebhook(c.Request.Context(), payload.Data.Reference); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// GetTicket godoc
// @Summary Get ticket by reference
// @Tags tickets
// @Produce json
// @Param reference path string true "Paystack reference"
// @Success 200 {object} dto.TicketResponse
// @Router /api/v1/tickets/{reference} [get]
func (h *TicketHandler) GetTicket(c *gin.Context) {
	reference := c.Param("reference")
	ticket, err := h.service.GetByReference(c.Request.Context(), reference)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ticket not found"})
		return
	}
	c.JSON(http.StatusOK, ticket)
}

// LookupByCode godoc
// @Summary Look up ticket by code
// @Tags tickets
// @Produce json
// @Param code path string true "Ticket code"
// @Success 200 {object} dto.TicketResponse
// @Router /api/v1/tickets/lookup/{code} [get]
func (h *TicketHandler) LookupByCode(c *gin.Context) {
	code := c.Param("code")
	ticket, err := h.service.GetByCode(c.Request.Context(), code)
	if err != nil {
		fmt.Printf("DEBUG: LookupByCode error for code %s: %v\n", code, err)
		c.JSON(http.StatusNotFound, gin.H{"error": "ticket not found"})
		return
	}
	c.JSON(http.StatusOK, ticket)
}

// Checkin godoc
// @Summary Check in a ticket (admin)
// @Tags tickets
// @Accept json
// @Produce json
// @Param id path string true "Ticket ID"
// @Param body body dto.CheckinRequest true "Check-in details"
// @Success 200
// @Router /api/v1/tickets/{id}/checkin [post]
func (h *TicketHandler) Checkin(c *gin.Context) {
	id := c.Param("id")

	var req dto.CheckinRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.Checkin(c.Request.Context(), id, req.CheckedInBy); err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "ticket checked in successfully"})
}

func (h *TicketHandler) SearchByEmail(c *gin.Context) {
	email := c.Query("email")
	if email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email query parameter is required"})
		return
	}

	tickets, err := h.service.SearchByEmail(c.Request.Context(), email)
	if err != nil {
		fmt.Printf("DEBUG: SearchByEmail error for email %s: %v\n", email, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": tickets})
}

func (h *TicketHandler) VerifyTicket(c *gin.Context) {
	reference := c.Param("reference")
	ticket, err := h.service.VerifyAndUpdate(c.Request.Context(), reference)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ticket)
}

func (h *TicketHandler) AdminCheckin(c *gin.Context) {
	id := c.Param("id")

	var req dto.CheckinRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.AdminCheckin(c.Request.Context(), id, req.CheckedInBy); err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "ticket checked in successfully"})
}

// @Summary List all tickets (admin)
// @Tags tickets
// @Produce json
// @Param event_day_id query string false "Filter by event day"
// @Param status query string false "Filter by status"
// @Param page query int false "Page number"
// @Param limit query int false "Items per page"
// @Success 200
// @Router /api/v1/tickets [get]
func (h *TicketHandler) ListTickets(c *gin.Context) {
	eventDayID := c.Query("event_day_id")
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

	tickets, total, err := h.service.List(c.Request.Context(), eventDayID, status, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	totalPages := (total + limit - 1) / limit
	c.JSON(http.StatusOK, gin.H{
		"data":        tickets,
		"total":       total,
		"page":        page,
		"limit":       limit,
		"total_pages": totalPages,
	})
}

// @Summary Create referral code
// @Tags tickets
// @Accept json
// @Produce json
// @Param request body dto.CreateReferralRequest true "Create referral request"
// @Success 201 {object} dto.ReferralResponse
// @Router /api/v1/tickets/referrals [post]
func (h *TicketHandler) CreateReferralCode(c *gin.Context) {
	var req dto.CreateReferralRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resp, err := h.service.CreateReferralCode(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, resp)
}

// @Summary Lookup referral codes by name
// @Tags tickets
// @Produce json
// @Param name query string true "Referrer name"
// @Success 200 {array} dto.ReferralResponse
// @Router /api/v1/tickets/referrals/lookup [get]
func (h *TicketHandler) LookupReferralByName(c *gin.Context) {
	name := c.Query("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name query parameter is required"})
		return
	}

	resp, err := h.service.LookupReferralByName(c.Request.Context(), name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// @Summary List referral stats (admin)
// @Tags tickets
// @Produce json
// @Param search query string false "Search name or code"
// @Param page query int false "Page number"
// @Param limit query int false "Items per page"
// @Success 200
// @Router /api/v1/admin/tickets/referrals [get]
func (h *TicketHandler) ListReferralStats(c *gin.Context) {
	search := c.Query("search")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

	stats, total, err := h.service.ListReferralStats(c.Request.Context(), search, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	totalPages := (total + limit - 1) / limit
	c.JSON(http.StatusOK, gin.H{
		"data":        stats,
		"total":       total,
		"page":        page,
		"limit":       limit,
		"total_pages": totalPages,
	})
}

