package transport

import (
	"errors"
	"net/http"

	"pkg-common/helpers"
	"showtime-backend/internal/ports"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type IFantasySquadHandler interface {
	GetSquad(c *gin.Context)
	BuyPlayer(c *gin.Context)
	SellPlayer(c *gin.Context)
}

type FantasySquadHandler struct {
	service services.IFantasySquadService
}

func NewFantasySquadHandler(service services.IFantasySquadService) IFantasySquadHandler {
	return &FantasySquadHandler{service: service}
}

func (h *FantasySquadHandler) GetSquad(c *gin.Context) {
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		helpers.UnAuthorizedResponse(c, "unauthorized")
		return
	}
	seasonID := c.Query("season_id")
	if seasonID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "season_id query param is required"})
		return
	}

	squad, err := h.service.GetSquad(c.Request.Context(), payload.UserId, seasonID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": squad})
}

// tradeRequest is the body both sides of a trade take.
type tradeRequest struct {
	PlayerID string `json:"player_id" binding:"required,uuid"`
}

func (h *FantasySquadHandler) BuyPlayer(c *gin.Context) {
	h.trade(c, func(userID, seasonID, playerID string, ctx *gin.Context) (any, error) {
		return h.service.BuyPlayer(ctx.Request.Context(), userID, seasonID, playerID)
	}, "Player signed")
}

func (h *FantasySquadHandler) SellPlayer(c *gin.Context) {
	h.trade(c, func(userID, seasonID, playerID string, ctx *gin.Context) (any, error) {
		return h.service.SellPlayer(ctx.Request.Context(), userID, seasonID, playerID)
	}, "Player sold")
}

// trade is the shared shape of a buy and a sell: both need the same auth, the
// same body, and return the whole squad so the dashboard reflects the new
// balance without a second round trip.
func (h *FantasySquadHandler) trade(
	c *gin.Context,
	run func(userID, seasonID, playerID string, ctx *gin.Context) (any, error),
	message string,
) {
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		helpers.UnAuthorizedResponse(c, "unauthorized")
		return
	}
	seasonID := c.Query("season_id")
	if seasonID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "season_id query param is required"})
		return
	}

	var req tradeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	squad, err := run(payload.UserId, seasonID, req.PlayerID, c)
	if err != nil {
		// 409 for "the squad already says otherwise", so a double-click reads
		// differently from a rejected trade.
		status := http.StatusBadRequest
		if errors.Is(err, ports.ErrAlreadyOwned) || errors.Is(err, ports.ErrNotOwned) {
			status = http.StatusConflict
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": message, "data": squad})
}
