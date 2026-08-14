package transport

import (
	"net/http"

	"showtime-backend/internal/dto"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type IAppSettingHandler interface {
	GetSettings(c *gin.Context)
	UpdateAppFont(c *gin.Context)
}

type AppSettingHandler struct {
	service services.IAppSettingService
}

func NewAppSettingHandler(service services.IAppSettingService) IAppSettingHandler {
	return &AppSettingHandler{service: service}
}

// GetSettings is public: every visitor needs the font before they authenticate.
func (h *AppSettingHandler) GetSettings(c *gin.Context) {
	res, err := h.service.GetSettings(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, res)
}

func (h *AppSettingHandler) UpdateAppFont(c *gin.Context) {
	var req dto.UpdateAppFontRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	res, err := h.service.UpdateAppFont(c.Request.Context(), req.AppFontID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, res)
}
