package transport

import (
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"pkg-common/helpers"

	"showtime-backend/internal/dto"
	appErrors "showtime-backend/internal/errors"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type IGamePassHandler interface {
	// Season admission tiers
	ListActiveSeasonTiers(c *gin.Context)
	ListSeasonTiers(c *gin.Context)
	CreateSeasonTier(c *gin.Context)
	UpdateSeasonTier(c *gin.Context)
	DeleteSeasonTier(c *gin.Context)

	// Discount bands
	ListActiveDiscountBands(c *gin.Context)
	ListDiscountBands(c *gin.Context)
	GetDiscountBand(c *gin.Context)
	CreateDiscountBand(c *gin.Context)
	UpdateDiscountBand(c *gin.Context)
	SetDiscountBandStatus(c *gin.Context)
	DeleteDiscountBand(c *gin.Context)

	// Leads
	CreateLead(c *gin.Context)
	ListLeads(c *gin.Context)
	UpdateLead(c *gin.Context)

	// Orders
	Checkout(c *gin.Context)
	Webhook(c *gin.Context)
	VerifyPayment(c *gin.Context)
	GetOrderByReference(c *gin.Context)
	ListOrders(c *gin.Context)
	GetOrder(c *gin.Context)
}

type GamePassHandler struct {
	service  services.IGamePassService
	paystack *services.PaystackClient
}

func NewGamePassHandler(service services.IGamePassService, paystack *services.PaystackClient) IGamePassHandler {
	return &GamePassHandler{service: service, paystack: paystack}
}

// statusForGamePassErr maps Game Pass errors onto HTTP codes. Validation
// failures are 422 with the reason verbatim, so the admin sees which band or
// field is the problem.
func statusForGamePassErr(err error) int {
	switch {
	case errors.Is(err, appErrors.ErrNotFound):
		return http.StatusNotFound
	case errors.Is(err, appErrors.ErrDuplicateSeasonTier):
		return http.StatusConflict
	case errors.Is(err, appErrors.ErrDuplicateDisplayOrder):
		return http.StatusConflict
	case errors.Is(err, appErrors.ErrInvalidGamePassConfig):
		return http.StatusUnprocessableEntity
	default:
		return http.StatusInternalServerError
	}
}

func gamePassError(c *gin.Context, err error) {
	c.JSON(statusForGamePassErr(err), gin.H{"error": err.Error()})
}

// ─── Season admission tiers ───────────────────────────────────────────────────

func (h *GamePassHandler) ListActiveSeasonTiers(c *gin.Context) {
	tiers, err := h.service.ListSeasonTiers(c.Request.Context(), true)
	if err != nil {
		gamePassError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": tiers})
}

func (h *GamePassHandler) ListSeasonTiers(c *gin.Context) {
	tiers, err := h.service.ListSeasonTiers(c.Request.Context(), false)
	if err != nil {
		gamePassError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": tiers})
}

func (h *GamePassHandler) CreateSeasonTier(c *gin.Context) {
	var req dto.CreateSeasonAdmissionTierRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	tier, err := h.service.CreateSeasonTier(c.Request.Context(), req)
	if err != nil {
		gamePassError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": tier})
}

func (h *GamePassHandler) UpdateSeasonTier(c *gin.Context) {
	var req dto.UpdateSeasonAdmissionTierRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	tier, err := h.service.UpdateSeasonTier(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		gamePassError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": tier})
}

func (h *GamePassHandler) DeleteSeasonTier(c *gin.Context) {
	if err := h.service.DeleteSeasonTier(c.Request.Context(), c.Param("id")); err != nil {
		gamePassError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Season admission tier deleted"})
}

// ─── Discount bands ───────────────────────────────────────────────────────────

func (h *GamePassHandler) ListActiveDiscountBands(c *gin.Context) {
	bands, err := h.service.ListDiscountBands(c.Request.Context(), true)
	if err != nil {
		gamePassError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": bands})
}

func (h *GamePassHandler) ListDiscountBands(c *gin.Context) {
	bands, err := h.service.ListDiscountBands(c.Request.Context(), false)
	if err != nil {
		gamePassError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": bands})
}

func (h *GamePassHandler) GetDiscountBand(c *gin.Context) {
	band, err := h.service.GetDiscountBand(c.Request.Context(), c.Param("id"))
	if err != nil {
		gamePassError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": band})
}

func (h *GamePassHandler) CreateDiscountBand(c *gin.Context) {
	var req dto.CreateGamePassDiscountBandRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	band, err := h.service.CreateDiscountBand(c.Request.Context(), req)
	if err != nil {
		gamePassError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": band})
}

func (h *GamePassHandler) UpdateDiscountBand(c *gin.Context) {
	var req dto.UpdateGamePassDiscountBandRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	band, err := h.service.UpdateDiscountBand(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		gamePassError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": band})
}

func (h *GamePassHandler) SetDiscountBandStatus(c *gin.Context) {
	var req dto.UpdateGamePassDiscountBandStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	band, err := h.service.SetDiscountBandStatus(c.Request.Context(), c.Param("id"), *req.IsActive)
	if err != nil {
		gamePassError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": band})
}

func (h *GamePassHandler) DeleteDiscountBand(c *gin.Context) {
	if err := h.service.DeleteDiscountBand(c.Request.Context(), c.Param("id")); err != nil {
		gamePassError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Discount band deleted"})
}

// ─── Leads ────────────────────────────────────────────────────────────────────

// CreateLead stores a buyer's "notify me" interest. The response carries the
// server's quote, which is what the lead was recorded at.
func (h *GamePassHandler) CreateLead(c *gin.Context) {
	var req dto.CreateGamePassLeadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	lead, err := h.service.CreateLead(c.Request.Context(), req)
	if err != nil {
		gamePassError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": lead})
}

func (h *GamePassHandler) ListLeads(c *gin.Context) {
	page, limit := pageParams(c, 50)
	leads, total, err := h.service.ListLeads(c.Request.Context(), c.Query("status"), c.Query("email"), page, limit)
	if err != nil {
		gamePassError(c, err)
		return
	}
	pagedJSON(c, leads, total, page, limit)
}

// UpdateLead changes a lead's status only.
func (h *GamePassHandler) UpdateLead(c *gin.Context) {
	var req dto.UpdateGamePassLeadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	lead, err := h.service.UpdateLeadStatus(c.Request.Context(), c.Param("id"), req.Status)
	if err != nil {
		gamePassError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": lead})
}

// ─── Orders ───────────────────────────────────────────────────────────────────

// Checkout opens a Game Pass purchase. The body names the tier, gamedays and
// holders; the price is computed server side. Responds like POST
// /tickets/purchase, with the Paystack authorization_url to redirect to.
func (h *GamePassHandler) Checkout(c *gin.Context) {
	var req dto.GamePassCheckoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Same callback rule as single tickets: the frontend origin when the
	// request carries one.
	scheme := "https"
	if c.Request.TLS == nil {
		scheme = "http"
	}
	callbackURL := scheme + "://" + c.Request.Host + "/tickets/game-pass/confirm"
	if origin := c.GetHeader("Origin"); origin != "" {
		callbackURL = origin + "/tickets/game-pass/confirm"
	}

	// Identity comes from the token, never the body.
	var userID *string
	if payload, err := helpers.GetTokenPayloadFromContext(c); err == nil && payload != nil && payload.UserId != "" {
		id := payload.UserId
		userID = &id
	}

	order, err := h.service.Checkout(c.Request.Context(), req, callbackURL, userID)
	if err != nil {
		gamePassError(c, err)
		return
	}
	c.JSON(http.StatusCreated, order)
}

// Webhook is Paystack's charge.success for a Game Pass order. Paystack only
// calls the one URL set on the dashboard (/tickets/webhook today), which hands
// Game Pass references to the same service; this route exists for when the
// dashboard points here instead.
func (h *GamePassHandler) Webhook(c *gin.Context) {
	body, ok := readPaystackWebhook(c, h.paystack.GetSecretKey())
	if !ok {
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

// readPaystackWebhook reads the body and checks Paystack's HMAC signature,
// answering 400/401 itself when either fails.
func readPaystackWebhook(c *gin.Context, secret string) ([]byte, bool) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot read body"})
		return nil, false
	}
	signature := c.GetHeader("x-paystack-signature")
	if signature == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing signature"})
		return nil, false
	}
	mac := hmac.New(sha512.New, []byte(secret))
	mac.Write(body)
	if !hmac.Equal([]byte(signature), []byte(hex.EncodeToString(mac.Sum(nil)))) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid signature"})
		return nil, false
	}
	return body, true
}

// VerifyPayment is called by the payment return page. It settles the order if
// the webhook hasn't yet and returns it, with ticket codes once paid.
func (h *GamePassHandler) VerifyPayment(c *gin.Context) {
	order, err := h.service.VerifyPayment(c.Request.Context(), c.Param("reference"))
	if err != nil {
		gamePassError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": order})
}

func (h *GamePassHandler) GetOrderByReference(c *gin.Context) {
	order, err := h.service.GetOrderByReference(c.Request.Context(), c.Param("reference"))
	if err != nil {
		gamePassError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": order})
}

func (h *GamePassHandler) ListOrders(c *gin.Context) {
	page, limit := pageParams(c, 50)
	orders, total, err := h.service.ListOrders(c.Request.Context(), c.Query("status"), c.Query("email"), page, limit)
	if err != nil {
		gamePassError(c, err)
		return
	}
	pagedJSON(c, orders, total, page, limit)
}

func (h *GamePassHandler) GetOrder(c *gin.Context) {
	order, err := h.service.GetOrder(c.Request.Context(), c.Param("id"))
	if err != nil {
		gamePassError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": order})
}
