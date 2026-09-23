package transport

import (
	"net/http"
	"pkg-common/helpers"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type ITOTWHandler interface {
	GetLatestPublishedTOTW(c *gin.Context)
	GetTOTWByID(c *gin.Context)
	GetPublicTOTWByID(c *gin.Context)
	ListTOTWArchive(c *gin.Context)
	ListAllAdminTOTW(c *gin.Context)
	CreateTOTW(c *gin.Context)
	UpdateTOTW(c *gin.Context)
	DeleteTOTW(c *gin.Context)
	PublishTOTW(c *gin.Context)
	GetPlayerDayStats(c *gin.Context)
}

type TOTWHandler struct {
	service services.ITOTWService
}

func NewTOTWHandler(service services.ITOTWService) *TOTWHandler {
	return &TOTWHandler{service: service}
}

func (h *TOTWHandler) GetLatestPublishedTOTW(c *gin.Context) {
	compID := c.Query("competition_id")
	totw, err := h.service.GetLatestPublishedTOTW(c.Request.Context(), compID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": totw})
}

func (h *TOTWHandler) GetTOTWByID(c *gin.Context) {
	id := c.Param("id")
	totw, err := h.service.GetTOTWByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": totw})
}

func (h *TOTWHandler) GetPublicTOTWByID(c *gin.Context) {
	id := c.Param("id")
	totw, err := h.service.GetTOTWByID(c.Request.Context(), id)
	if err != nil || totw == nil || !totw.IsPublished {
		c.JSON(http.StatusNotFound, gin.H{"error": "team of the week not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": totw})
}

func (h *TOTWHandler) ListTOTWArchive(c *gin.Context) {
	compID := c.Query("competition_id")
	list, err := h.service.ListTOTWArchive(c.Request.Context(), compID, true)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": list})
}

func (h *TOTWHandler) ListAllAdminTOTW(c *gin.Context) {
	compID := c.Query("competition_id")
	list, err := h.service.ListTOTWArchive(c.Request.Context(), compID, false)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": list})
}

func (h *TOTWHandler) CreateTOTW(c *gin.Context) {
	var req dto.SaveTOTWRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var callerID *string
	if payload, err := helpers.GetTokenPayloadFromContext(c); err == nil && payload != nil {
		callerID = &payload.UserId
	}

	created, err := h.service.CreateTOTW(c.Request.Context(), req, callerID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": created})
}

func (h *TOTWHandler) UpdateTOTW(c *gin.Context) {
	id := c.Param("id")
	var req dto.SaveTOTWRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updated, err := h.service.UpdateTOTW(c.Request.Context(), id, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": updated})
}

func (h *TOTWHandler) DeleteTOTW(c *gin.Context) {
	id := c.Param("id")
	err := h.service.DeleteTOTW(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "team of the week deleted successfully"})
}

func (h *TOTWHandler) PublishTOTW(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		IsPublished bool `json:"is_published"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updated, err := h.service.PublishTOTW(c.Request.Context(), id, req.IsPublished)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": updated})
}

func (h *TOTWHandler) GetPlayerDayStats(c *gin.Context) {
	playerID := c.Query("player_id")
	eventDayID := c.Query("event_day_id")
	if playerID == "" || eventDayID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "player_id and event_day_id are required"})
		return
	}

	stats, err := h.service.GetPlayerDayStats(c.Request.Context(), playerID, eventDayID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": stats})
}
