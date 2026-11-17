package transport

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"pkg-common/helpers"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
	"showtime-backend/internal/services"
)

type IWalletHandler interface {
	GetWallet(c *gin.Context)
	StartTopup(c *gin.Context)
	VerifyTopup(c *gin.Context)

	AdminSearchUsers(c *gin.Context)
	AdminGetWallet(c *gin.Context)
	AdminAdjust(c *gin.Context)
}

type WalletHandler struct {
	service services.IWalletService
}

func NewWalletHandler(service services.IWalletService) IWalletHandler {
	return &WalletHandler{service: service}
}

// walletCallbackURL is where Paystack sends the user back to: the frontend's
// wallet confirmation page, taken from the request's origin when there is one.
func walletCallbackURL(c *gin.Context) string {
	scheme := "https"
	if c.Request.TLS == nil {
		scheme = "http"
	}
	base := scheme + "://" + c.Request.Host
	if origin := c.GetHeader("Origin"); origin != "" {
		base = origin
	}
	return base + "/wallet/confirm"
}

// respondWalletError turns the service's errors into the right status. The ones
// the user can act on (amount, limit, balance) are 400s with their own message.
func respondWalletError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, services.ErrTopupNotFound), errors.Is(err, services.ErrWalletUserNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case errors.Is(err, services.ErrTopupAmount),
		errors.Is(err, services.ErrWalletFull),
		errors.Is(err, services.ErrAdjustReason),
		errors.Is(err, ports.ErrWalletInsufficient):
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
	}
}

// GetWallet godoc
// @Summary The signed-in user's wallet and recent history
// @Tags wallet
// @Security BearerAuth
// @Produce json
// @Router /api/v1/wallet [get]
func (h *WalletHandler) GetWallet(c *gin.Context) {
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		helpers.UnAuthorizedResponse(c, "unauthorized")
		return
	}
	wallet, err := h.service.GetWallet(c.Request.Context(), payload.UserId)
	if err != nil {
		respondWalletError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": wallet})
}

// StartTopup godoc
// @Summary Start a wallet top-up; returns the Paystack payment URL
// @Tags wallet
// @Security BearerAuth
// @Accept json
// @Produce json
// @Router /api/v1/wallet/topups [post]
func (h *WalletHandler) StartTopup(c *gin.Context) {
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		helpers.UnAuthorizedResponse(c, "unauthorized")
		return
	}
	var req dto.TopupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	out, err := h.service.StartTopup(c.Request.Context(), payload.UserId, req.AmountKobo, walletCallbackURL(c))
	if err != nil {
		respondWalletError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": out})
}

// VerifyTopup godoc
// @Summary Check a top-up with Paystack and credit the wallet if it was paid
// @Tags wallet
// @Security BearerAuth
// @Accept json
// @Produce json
// @Router /api/v1/wallet/topups/verify [post]
func (h *WalletHandler) VerifyTopup(c *gin.Context) {
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		helpers.UnAuthorizedResponse(c, "unauthorized")
		return
	}
	var req dto.VerifyTopupRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.Reference == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "reference is required"})
		return
	}
	out, err := h.service.VerifyTopup(c.Request.Context(), payload.UserId, req.Reference)
	if err != nil {
		respondWalletError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": out})
}

// AdminSearchUsers godoc
// @Summary Find users by name or email to open their wallet (staff)
// @Tags wallet
// @Security BearerAuth
// @Router /api/v1/admin/wallets/users [get]
func (h *WalletHandler) AdminSearchUsers(c *gin.Context) {
	users, err := h.service.AdminSearchUsers(c.Request.Context(), c.Query("search"))
	if err != nil {
		respondWalletError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": users})
}

// AdminGetWallet godoc
// @Summary A user's wallet and history (staff)
// @Tags wallet
// @Security BearerAuth
// @Router /api/v1/admin/wallets/users/{id} [get]
func (h *WalletHandler) AdminGetWallet(c *gin.Context) {
	wallet, err := h.service.AdminGetWallet(c.Request.Context(), c.Param("id"))
	if err != nil {
		respondWalletError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": wallet})
}

// AdminAdjust godoc
// @Summary Credit or debit a user's wallet by hand, with a reason (staff)
// @Tags wallet
// @Security BearerAuth
// @Accept json
// @Router /api/v1/admin/wallets/users/{id}/adjust [post]
func (h *WalletHandler) AdminAdjust(c *gin.Context) {
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		helpers.UnAuthorizedResponse(c, "unauthorized")
		return
	}
	var req dto.AdjustWalletRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	entry, err := h.service.AdminAdjust(c.Request.Context(), c.Param("id"), req.AmountKobo, req.Reason, payload.UserId)
	if err != nil {
		respondWalletError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": entry})
}
