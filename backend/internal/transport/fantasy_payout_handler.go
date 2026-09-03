package transport

import (
	"errors"
	"net/http"
	"strconv"

	"pkg-common/helpers"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type IFantasyPayoutHandler interface {
	// User
	GetWallet(c *gin.Context)
	RequestPayout(c *gin.Context)
	ListMyPayouts(c *gin.Context)
	CancelPayout(c *gin.Context)

	GetLeagueJoinPreview(c *gin.Context)
	GetLeagueJoinPreviewByCode(c *gin.Context)

	// Admin
	AdminGetOverview(c *gin.Context)
	AdminListManagers(c *gin.Context)
	AdminListLeagueMembers(c *gin.Context)
	AdminListLeagues(c *gin.Context)
	AdminGetLeagueFinance(c *gin.Context)
	AdminSetPrizeStructure(c *gin.Context)
	AdminSettleLeague(c *gin.Context)
	AdminSettleSeason(c *gin.Context)
	AdminCompleteSeason(c *gin.Context)
	AdminListPayouts(c *gin.Context)
	AdminUpdatePayoutStatus(c *gin.Context)
	AdminGetUserWallet(c *gin.Context)
}

type FantasyPayoutHandler struct {
	service services.IFantasyPayoutService
}

func NewFantasyPayoutHandler(service services.IFantasyPayoutService) IFantasyPayoutHandler {
	return &FantasyPayoutHandler{service: service}
}

// ─── User ─────────────────────────────────────────────────────────────────────

func (h *FantasyPayoutHandler) GetWallet(c *gin.Context) {
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		helpers.UnAuthorizedResponse(c, "unauthorized")
		return
	}

	wallet, err := h.service.GetWallet(c.Request.Context(), payload.UserId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": wallet})
}

func (h *FantasyPayoutHandler) RequestPayout(c *gin.Context) {
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		helpers.UnAuthorizedResponse(c, "unauthorized")
		return
	}

	var req dto.CreatePayoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	res, err := h.service.RequestPayout(c.Request.Context(), payload.UserId, req)
	if err != nil {
		// An insufficient balance is the user's own state, not a server fault.
		if errors.Is(err, ports.ErrInsufficientBalance) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Payout requested. We'll process it and notify you once the transfer is sent.",
		"data":    res,
	})
}

func (h *FantasyPayoutHandler) ListMyPayouts(c *gin.Context) {
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		helpers.UnAuthorizedResponse(c, "unauthorized")
		return
	}

	list, err := h.service.ListMyPayouts(c.Request.Context(), payload.UserId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": list})
}

func (h *FantasyPayoutHandler) CancelPayout(c *gin.Context) {
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		helpers.UnAuthorizedResponse(c, "unauthorized")
		return
	}

	res, err := h.service.CancelPayout(c.Request.Context(), payload.UserId, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Payout request cancelled and funds returned", "data": res})
}

// GetLeagueJoinPreview backs the dialogue a manager reads before joining.
func (h *FantasyPayoutHandler) GetLeagueJoinPreview(c *gin.Context) {
	// Signed in or not, the terms are readable; membership details only appear
	// when we know who is asking.
	userID := ""
	if payload, err := helpers.GetTokenPayloadFromContext(c); err == nil && payload != nil {
		userID = payload.UserId
	}

	preview, err := h.service.GetJoinPreview(c.Request.Context(), userID, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": preview})
}

// GetLeagueJoinPreviewByCode backs the same dialogue for a private league,
// which is never listed and so can only be reached by its invite code.
func (h *FantasyPayoutHandler) GetLeagueJoinPreviewByCode(c *gin.Context) {
	code := c.Query("code")
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "an invite code is required"})
		return
	}

	userID := ""
	if payload, err := helpers.GetTokenPayloadFromContext(c); err == nil && payload != nil {
		userID = payload.UserId
	}

	preview, err := h.service.GetJoinPreviewByCode(c.Request.Context(), userID, code)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": preview})
}

// ─── Admin ────────────────────────────────────────────────────────────────────

func (h *FantasyPayoutHandler) AdminGetOverview(c *gin.Context) {
	overview, err := h.service.GetOverview(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": overview})
}

func (h *FantasyPayoutHandler) AdminListManagers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	list, total, err := h.service.ListManagers(c.Request.Context(), c.Param("id"), c.Query("search"), page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	totalPages := 0
	if limit > 0 {
		totalPages = (total + limit - 1) / limit
	}
	c.JSON(http.StatusOK, gin.H{
		"data": list, "total": total, "page": page, "limit": limit, "total_pages": totalPages,
	})
}

func (h *FantasyPayoutHandler) AdminListLeagueMembers(c *gin.Context) {
	list, err := h.service.ListLeagueMembers(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": list})
}

func (h *FantasyPayoutHandler) AdminListLeagues(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	list, total, err := h.service.ListAllLeagues(c.Request.Context(), c.Param("id"), c.Query("search"), page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	totalPages := 0
	if limit > 0 {
		totalPages = (total + limit - 1) / limit
	}
	c.JSON(http.StatusOK, gin.H{
		"data": list, "total": total, "page": page, "limit": limit, "total_pages": totalPages,
	})
}

func (h *FantasyPayoutHandler) AdminGetLeagueFinance(c *gin.Context) {
	res, err := h.service.GetLeagueFinance(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": res})
}

func (h *FantasyPayoutHandler) AdminSetPrizeStructure(c *gin.Context) {
	var req dto.SetPrizeStructureRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	res, err := h.service.SetPrizeStructure(c.Request.Context(), c.Param("id"), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Prize structure saved", "data": res})
}

func (h *FantasyPayoutHandler) AdminSettleLeague(c *gin.Context) {
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		helpers.UnAuthorizedResponse(c, "unauthorized")
		return
	}

	res, err := h.service.SettleLeague(c.Request.Context(), payload.UserId, c.Param("id"))
	if err != nil {
		if errors.Is(err, ports.ErrAlreadySettled) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "League settled and prize money credited", "data": res})
}

func (h *FantasyPayoutHandler) AdminSettleSeason(c *gin.Context) {
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		helpers.UnAuthorizedResponse(c, "unauthorized")
		return
	}

	res, err := h.service.SettleSeason(c.Request.Context(), payload.UserId, c.Param("id"))
	if err != nil {
		// Partial success is real here: some leagues may have settled before
		// one failed, so the result is returned alongside the error.
		c.JSON(http.StatusMultiStatus, gin.H{"error": err.Error(), "data": res})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Season leagues settled and prize money credited", "data": res})
}

// AdminCompleteSeason closes a season, paying out every unsettled league on
// the way. This is the "finalize" that distributes prize money.
func (h *FantasyPayoutHandler) AdminCompleteSeason(c *gin.Context) {
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		helpers.UnAuthorizedResponse(c, "unauthorized")
		return
	}

	res, err := h.service.CompleteSeason(c.Request.Context(), payload.UserId, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "data": res})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"message": "Season completed. Prize money has been credited to the winners' wallets.",
		"data":    res,
	})
}

func (h *FantasyPayoutHandler) AdminListPayouts(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "25"))

	list, total, err := h.service.ListPayoutRequests(c.Request.Context(), c.Query("status"), page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	totalPages := 0
	if limit > 0 {
		totalPages = (total + limit - 1) / limit
	}
	c.JSON(http.StatusOK, gin.H{
		"data": list, "total": total, "page": page, "limit": limit, "total_pages": totalPages,
	})
}

func (h *FantasyPayoutHandler) AdminUpdatePayoutStatus(c *gin.Context) {
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		helpers.UnAuthorizedResponse(c, "unauthorized")
		return
	}

	var req dto.UpdatePayoutStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	res, err := h.service.UpdatePayoutStatus(c.Request.Context(), payload.UserId, c.Param("id"), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Payout updated", "data": res})
}

func (h *FantasyPayoutHandler) AdminGetUserWallet(c *gin.Context) {
	wallet, err := h.service.GetWalletForUser(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": wallet})
}
