package transport

import (
	"net/http"
	"pkg-common/helpers"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/services"
	"strconv"

	"github.com/gin-gonic/gin"
)

type IBadgeHandler interface {
	ListBadges(c *gin.Context)
	GetBadgeByID(c *gin.Context)
	CreateBadge(c *gin.Context)
	UpdateBadge(c *gin.Context)
	DeleteBadge(c *gin.Context)
	GetPlayerBadges(c *gin.Context)
	AwardBadge(c *gin.Context)
	DeleteAward(c *gin.Context)
	BackfillMVPBadges(c *gin.Context)
	ListAwards(c *gin.Context)
}

type BadgeHandler struct {
	service services.IBadgeService
}

func NewBadgeHandler(service services.IBadgeService) *BadgeHandler {
	return &BadgeHandler{service: service}
}

func (h *BadgeHandler) ListBadges(c *gin.Context) {
	badges, err := h.service.ListBadges(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": badges})
}

func (h *BadgeHandler) GetBadgeByID(c *gin.Context) {
	id := c.Param("id")
	badge, err := h.service.GetBadgeByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": badge})
}

func (h *BadgeHandler) CreateBadge(c *gin.Context) {
	var req dto.CreateBadgeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	badge, err := h.service.CreateBadge(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": badge})
}

func (h *BadgeHandler) UpdateBadge(c *gin.Context) {
	id := c.Param("id")
	var req dto.UpdateBadgeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	badge, err := h.service.UpdateBadge(c.Request.Context(), id, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": badge})
}

func (h *BadgeHandler) DeleteBadge(c *gin.Context) {
	id := c.Param("id")
	err := h.service.DeleteBadge(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "badge deleted successfully"})
}

func (h *BadgeHandler) GetPlayerBadges(c *gin.Context) {
	playerID := c.Param("id")
	badges, err := h.service.GetPlayerBadges(c.Request.Context(), playerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": badges})
}

func (h *BadgeHandler) AwardBadge(c *gin.Context) {
	var req dto.AwardBadgeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var callerID *string
	if payload, err := helpers.GetTokenPayloadFromContext(c); err == nil && payload != nil {
		callerID = &payload.UserId
	}

	pb, err := h.service.AwardBadge(c.Request.Context(), req, callerID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": pb})
}

func (h *BadgeHandler) DeleteAward(c *gin.Context) {
	awardID := c.Param("id")
	err := h.service.DeleteAward(c.Request.Context(), awardID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "award removed successfully"})
}

func (h *BadgeHandler) BackfillMVPBadges(c *gin.Context) {
	count, err := h.service.BackfillMVPBadges(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "MVP badges backfilled successfully", "updated_players": count})
}

func (h *BadgeHandler) ListAwards(c *gin.Context) {
	badgeID := c.Query("badge_id")
	playerID := c.Query("player_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	awards, total, err := h.service.ListAwards(c.Request.Context(), badgeID, playerID, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  awards,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}
