package transport

import (
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"strconv"

	"showtime-backend/internal/dto"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type TicketHandler struct {
	service  services.ITicketService
	paystack *services.PaystackClient
}

func NewTicketHandler(service services.ITicketService, paystack *services.PaystackClient) *TicketHandler {
	return &TicketHandler{service: service, paystack: paystack}
}

// Purchase godoc
// @Summary Purchase tickets
// @Tags tickets
// @Accept json
// @Produce json
// @Param body body dto.PurchaseTicketRequest true "Purchase request"
// @Success 201 {object} dto.TicketResponse
// @Router /tickets/purchase [post]
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, result)
}

// Webhook godoc
// @Summary Paystack webhook handler
// @Tags tickets
// @Accept json
// @Success 200
// @Router /tickets/webhook [post]
func (h *TicketHandler) Webhook(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot read body"})
		return
	}

	// Verify Paystack signature
	signature := c.GetHeader("x-paystack-signature")
	if signature != "" {
		mac := hmac.New(sha512.New, []byte(h.paystack.GetSecretKey()))
		mac.Write(body)
		expectedMAC := hex.EncodeToString(mac.Sum(nil))
		if !hmac.Equal([]byte(signature), []byte(expectedMAC)) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid signature"})
			return
		}
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
// @Router /tickets/{reference} [get]
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
// @Router /tickets/lookup/{code} [get]
func (h *TicketHandler) LookupByCode(c *gin.Context) {
	code := c.Param("code")
	ticket, err := h.service.GetByCode(c.Request.Context(), code)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ticket not found"})
		return
	}
	c.JSON(http.StatusOK, ticket)
}

// ListTickets godoc
// @Summary List all tickets (admin)
// @Tags tickets
// @Produce json
// @Param match_id query string false "Filter by match"
// @Param status query string false "Filter by status"
// @Param page query int false "Page number"
// @Param limit query int false "Items per page"
// @Success 200
// @Router /tickets [get]
func (h *TicketHandler) ListTickets(c *gin.Context) {
	matchID := c.Query("match_id")
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

	tickets, total, err := h.service.List(c.Request.Context(), matchID, status, page, limit)
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

// Checkin godoc
// @Summary Check in a ticket (admin)
// @Tags tickets
// @Accept json
// @Produce json
// @Param id path string true "Ticket ID"
// @Param body body dto.CheckinRequest true "Check-in details"
// @Success 200
// @Router /tickets/{id}/checkin [post]
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
