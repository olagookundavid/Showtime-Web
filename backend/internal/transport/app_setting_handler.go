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
	GetAdminSettings(c *gin.Context)
	UpdateContractSettings(c *gin.Context)
	UpdateNotificationSettings(c *gin.Context)
	UpdateFantasySettings(c *gin.Context)
	SearchStaff(c *gin.Context)
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

// GetAdminSettings returns everything the App Settings page edits.
func (h *AppSettingHandler) GetAdminSettings(c *gin.Context) {
	res, err := h.service.GetAdminSettings(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, res)
}

// respondSaved answers a settings write with the stored values, so the page shows
// what was actually saved rather than what it sent.
func (h *AppSettingHandler) respondSaved(c *gin.Context, err error) {
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.GetAdminSettings(c)
}

func (h *AppSettingHandler) UpdateContractSettings(c *gin.Context) {
	var req dto.ContractSettingsDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "enter all three contract numbers"})
		return
	}
	h.respondSaved(c, h.service.UpdateContractSettings(c.Request.Context(), req))
}

func (h *AppSettingHandler) UpdateNotificationSettings(c *gin.Context) {
	var req dto.UpdateNotificationSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.respondSaved(c, h.service.UpdateNotificationSettings(c.Request.Context(), req))
}

func (h *AppSettingHandler) UpdateFantasySettings(c *gin.Context) {
	var req dto.FantasySettingsDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.respondSaved(c, h.service.UpdateFantasySettings(c.Request.Context(), req))
}

// SearchStaff finds people who can be chosen to receive the league summary.
func (h *AppSettingHandler) SearchStaff(c *gin.Context) {
	people, err := h.service.SearchStaff(c.Request.Context(), c.Query("search"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": people})
}
