package transport

import (
	"errors"
	"net/http"
	"showtime-backend/internal/domain"
	"showtime-backend/internal/services"
	"time"

	"pkg-common/helpers"

	"github.com/gin-gonic/gin"
)

type ITOTWHandler interface {
	Create(c *gin.Context)
	Delete(c *gin.Context)
	GetTOTW(c *gin.Context)
	GetLatestTOTW(c *gin.Context)
}

type TOTWHandler struct {
	service services.ITOTWService
}

func NewTOTWHandler(service services.ITOTWService) *TOTWHandler {
	return &TOTWHandler{service: service}
}

type CreateTOTWPayload struct {
	CompetitionID string `json:"competition_id" binding:"required"`
	EventDayDate  string `json:"event_day_date" binding:"required"` // YYYY-MM-DD
	PlayerID      string `json:"player_id" binding:"required"`
	PositionGroup string `json:"position_group" binding:"required"`
}

func (h *TOTWHandler) Create(c *gin.Context) {
	var payload CreateTOTWPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}

	date, err := time.Parse("2006-01-02", payload.EventDayDate)
	if err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}

	entry := &domain.TOTWEntry{
		CompetitionID: payload.CompetitionID,
		EventDayDate:  date,
		PlayerID:      payload.PlayerID,
		PositionGroup: payload.PositionGroup,
	}

	if err := h.service.CreateTOTWEntry(c.Request.Context(), entry); err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "TOTW entry created successfully", "data": entry})
}

func (h *TOTWHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	if err := h.service.DeleteTOTWEntry(c.Request.Context(), id); err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "TOTW entry deleted successfully"})
}

func (h *TOTWHandler) GetTOTW(c *gin.Context) {
	competitionID := c.Query("competition_id")
	eventDay := c.Query("event_day") // YYYY-MM-DD

	if competitionID == "" || eventDay == "" {
		helpers.BadResponse(c, errors.New("missing required parameters").Error())
		return
	}

	entries, err := h.service.GetTOTW(c.Request.Context(), competitionID, eventDay)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": entries})
}

func (h *TOTWHandler) GetLatestTOTW(c *gin.Context) {
	competitionID := c.Query("competition_id")

	entries, date, err := h.service.GetLatestTOTW(c.Request.Context(), competitionID)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": entries,
		"date": date,
	})
}
