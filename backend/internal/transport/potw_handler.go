package transport

import (
	"errors"
	"net/http"
	"pkg-common/helpers"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type IPOTWHandler interface {
	GetCurrentPoll(c *gin.Context)
	ListPolls(c *gin.Context)
	GetPoll(c *gin.Context)
	Vote(c *gin.Context)

	GetAdminPoll(c *gin.Context)
	SaveAdminPoll(c *gin.Context)
	DeleteAdminPoll(c *gin.Context)
	OverrideWinner(c *gin.Context)
	ClearOverride(c *gin.Context)
}

type POTWHandler struct {
	service services.IPOTWService
}

func NewPOTWHandler(service services.IPOTWService) *POTWHandler {
	return &POTWHandler{service: service}
}

// callerID is the logged-in user, or "" for a guest (public routes use the
// optional token middleware).
func callerID(c *gin.Context) string {
	if payload, err := helpers.GetTokenPayloadFromContext(c); err == nil && payload != nil {
		return payload.UserId
	}
	return ""
}

// potwError maps service errors to a status: missing polls 404, a closed vote
// 409, anything else the caller got wrong 400.
func potwError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, services.ErrPOTWPollNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case errors.Is(err, services.ErrPOTWVotingClosed):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	case errors.Is(err, services.ErrPOTWEmailNotVerified):
		// The code lets the page open its verify-your-email step.
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error(), "code": "email_not_verified"})
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	}
}

// ── Public ──────────────────────────────────────────────────────────────────

func (h *POTWHandler) GetCurrentPoll(c *gin.Context) {
	poll, err := h.service.GetCurrentPublicPoll(c.Request.Context(), callerID(c))
	if err != nil {
		potwError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": poll})
}

func (h *POTWHandler) ListPolls(c *gin.Context) {
	polls, err := h.service.ListPublicPolls(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": polls})
}

func (h *POTWHandler) GetPoll(c *gin.Context) {
	poll, err := h.service.GetPublicPoll(c.Request.Context(), c.Param("id"), callerID(c))
	if err != nil {
		potwError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": poll})
}

// Vote requires a logged-in user (the route uses the token middleware).
func (h *POTWHandler) Vote(c *gin.Context) {
	userID := callerID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "log in to vote"})
		return
	}
	var req dto.CastPOTWVoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	poll, err := h.service.Vote(c.Request.Context(), c.Param("id"), userID, req.PlayerID)
	if err != nil {
		potwError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": poll})
}

// ── Admin (keyed by Team of the Week edition) ───────────────────────────────

func (h *POTWHandler) GetAdminPoll(c *gin.Context) {
	poll, err := h.service.GetAdminPoll(c.Request.Context(), c.Param("id"))
	if err != nil {
		potwError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": poll})
}

func (h *POTWHandler) SaveAdminPoll(c *gin.Context) {
	var req dto.SavePOTWPollRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	poll, err := h.service.SavePoll(c.Request.Context(), c.Param("id"), req, callerID(c))
	if err != nil {
		potwError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": poll})
}

func (h *POTWHandler) DeleteAdminPoll(c *gin.Context) {
	if err := h.service.DeletePoll(c.Request.Context(), c.Param("id")); err != nil {
		potwError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Player of the Week vote deleted"})
}

func (h *POTWHandler) OverrideWinner(c *gin.Context) {
	var req dto.OverridePOTWRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	poll, err := h.service.OverrideWinner(c.Request.Context(), c.Param("id"), req.PlayerID)
	if err != nil {
		potwError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": poll})
}

func (h *POTWHandler) ClearOverride(c *gin.Context) {
	poll, err := h.service.ClearOverride(c.Request.Context(), c.Param("id"))
	if err != nil {
		potwError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": poll})
}
