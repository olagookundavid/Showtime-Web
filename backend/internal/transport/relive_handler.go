package transport

import (
	"net/http"
	"showtime-backend/internal/services"

	"pkg-common/helpers"

	"github.com/gin-gonic/gin"
)

type IReliveHandler interface {
	GetRelivePlaylist(c *gin.Context)
}

type ReliveHandler struct {
	service services.IReliveService
}

func NewReliveHandler(service services.IReliveService) *ReliveHandler {
	return &ReliveHandler{service: service}
}

func (h *ReliveHandler) GetRelivePlaylist(c *gin.Context) {
	playlistID := c.Query("playlist_id")
	playlist, err := h.service.GetRelivePlaylist(c.Request.Context(), playlistID)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": playlist})
}
