package transport

import (
	"net/http"

	"showtime-backend/internal/dto"
	"showtime-backend/internal/services"

	"pkg-common/helpers"

	"github.com/gin-gonic/gin"
)

type IReliveHandler interface {
	GetRelivePlaylist(c *gin.Context)
	GetAdminStatus(c *gin.Context)
	UpdatePlaylist(c *gin.Context)
}

type ReliveHandler struct {
	service services.IReliveService
}

func NewReliveHandler(service services.IReliveService) *ReliveHandler {
	return &ReliveHandler{service: service}
}

// GetRelivePlaylist is public and loaded on every homepage visit. The
// playlist is chosen in the admin panel, not by the caller.
func (h *ReliveHandler) GetRelivePlaylist(c *gin.Context) {
	playlist, err := h.service.GetRelivePlaylist(c.Request.Context())
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}

	// Let browsers reuse the answer across page loads. An empty playlist
	// (usually YouTube being unreachable) is kept briefly so it clears soon.
	maxAge := "300"
	if len(playlist.Videos) == 0 {
		maxAge = "60"
	}
	c.Header("Cache-Control", "public, max-age="+maxAge)
	c.JSON(http.StatusOK, gin.H{"data": playlist})
}

func (h *ReliveHandler) GetAdminStatus(c *gin.Context) {
	status, err := h.service.GetAdminStatus(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, status)
}

func (h *ReliveHandler) UpdatePlaylist(c *gin.Context) {
	var req dto.UpdateRelivePlaylistRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	status, err := h.service.SetPlaylist(c.Request.Context(), req.PlaylistID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, status)
}
