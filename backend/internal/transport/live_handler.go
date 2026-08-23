package transport

import (
	"net/http"

	"showtime-backend/internal/dto"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type ILiveHandler interface {
	GetStatus(c *gin.Context)
	GetAdminStatus(c *gin.Context)
	UpdateOverride(c *gin.Context)
}

type LiveHandler struct {
	service services.ILiveService
}

func NewLiveHandler(service services.ILiveService) ILiveHandler {
	return &LiveHandler{service: service}
}

// GetStatus is public and polled by every visitor on the homepage.
func (h *LiveHandler) GetStatus(c *gin.Context) {
	status, err := h.service.GetStatus(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, status)
}

func (h *LiveHandler) GetAdminStatus(c *gin.Context) {
	status, err := h.service.GetAdminStatus(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, status)
}

func (h *LiveHandler) UpdateOverride(c *gin.Context) {
	var req dto.UpdateLiveOverrideRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	status, err := h.service.SetOverride(c.Request.Context(), req.Mode, req.VideoID, req.Title)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, status)
}
