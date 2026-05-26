package transport

import (
	"net/http"

	"showtime-backend/internal/dto"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type IImportHandler interface {
	ImportMatch(c *gin.Context)
}

type ImportHandler struct {
	service services.IImportService
}

func NewImportHandler(service services.IImportService) IImportHandler {
	return &ImportHandler{service: service}
}

// ImportMatch godoc
// @Summary      Bulk import a match's team sheets and player stats from parsed CSV rows
// @Tags         admin
// @Accept       json
// @Produce      json
// @Param        id path string true "Match ID"
// @Param        request body dto.ImportMatchRequest true "Parsed CSV rows"
// @Success      200 {object} map[string]interface{}
// @Router       /api/v1/admin/matches/{id}/import [post]
func (h *ImportHandler) ImportMatch(c *gin.Context) {
	matchID := c.Param("id")
	var req dto.ImportMatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result, err := h.service.ImportMatchData(c.Request.Context(), matchID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Match data imported", "data": result})
}
