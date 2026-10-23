package transport

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"showtime-backend/internal/services"
)

// IPlayerTicketHandler serves team sheets with every player's ticket code: to a
// team manager for their own team, and to admins and ticketers for any game day.
type IPlayerTicketHandler interface {
	// Team manager (scoped to their team; team-portal admins pass ?team_id=).
	ListMySheets(c *gin.Context)
	GetMySheet(c *gin.Context)
	IssueMySheet(c *gin.Context)

	// Admin and ticketers.
	ListSheetDays(c *gin.Context)
	GetDaySheets(c *gin.Context)
	GetSheet(c *gin.Context)
	IssueSheet(c *gin.Context)
}

type PlayerTicketHandler struct {
	service services.IPlayerTicketService
}

func NewPlayerTicketHandler(service services.IPlayerTicketService) IPlayerTicketHandler {
	return &PlayerTicketHandler{service: service}
}

func isUUID(s string) bool {
	_, err := uuid.Parse(s)
	return err == nil
}

// managerTeam is the team a team-portal request acts for: a team head's own, or
// the team_id an unscoped admin names.
func managerTeam(c *gin.Context) (string, bool) {
	if team, ok := scopedTeamID(c); ok {
		return team, true
	}
	team := c.Query("team_id")
	if !isUUID(team) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "team_id is required"})
		return "", false
	}
	return team, true
}

func playerTicketError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, services.ErrPlayerTicketMatchNotFound), errors.Is(err, services.ErrPlayerTicketDayNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case errors.Is(err, services.ErrTeamNotInMatch):
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
	}
}

func matchParam(c *gin.Context) (string, bool) {
	id := c.Param("matchId")
	if !isUUID(id) {
		c.JSON(http.StatusNotFound, gin.H{"error": "match not found"})
		return "", false
	}
	return id, true
}

// ListMySheets godoc
// @Summary Every match the team manager's team has named a sheet for, with ticket counts
// @Tags player-tickets
// @Produce json
// @Success 200
// @Router /api/v1/team-head/player-tickets [get]
func (h *PlayerTicketHandler) ListMySheets(c *gin.Context) {
	team, ok := managerTeam(c)
	if !ok {
		return
	}
	sheets, err := h.service.TeamSheets(c.Request.Context(), team)
	if err != nil {
		playerTicketError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": sheets})
}

// GetMySheet godoc
// @Summary The team manager's sheet for one match, with every player's ticket code
// @Tags player-tickets
// @Produce json
// @Param matchId path string true "Match ID"
// @Success 200 {object} dto.PlayerTicketSheetResponse
// @Router /api/v1/team-head/player-tickets/{matchId} [get]
func (h *PlayerTicketHandler) GetMySheet(c *gin.Context) {
	team, ok := managerTeam(c)
	if !ok {
		return
	}
	matchID, ok := matchParam(c)
	if !ok {
		return
	}
	sheet, err := h.service.Sheet(c.Request.Context(), matchID, team)
	if err != nil {
		playerTicketError(c, err)
		return
	}
	c.JSON(http.StatusOK, sheet)
}

// IssueMySheet godoc
// @Summary Issue tickets to any player on the team manager's sheet still without one
// @Tags player-tickets
// @Produce json
// @Param matchId path string true "Match ID"
// @Success 200 {object} dto.PlayerTicketSheetResponse
// @Router /api/v1/team-head/player-tickets/{matchId}/issue [post]
func (h *PlayerTicketHandler) IssueMySheet(c *gin.Context) {
	team, ok := managerTeam(c)
	if !ok {
		return
	}
	matchID, ok := matchParam(c)
	if !ok {
		return
	}
	h.issueAndRespond(c, matchID, team)
}

// issueAndRespond issues what is missing and answers with the sheet as it now is.
// A partial failure still returns the sheet, with the error alongside.
func (h *PlayerTicketHandler) issueAndRespond(c *gin.Context, matchID, teamID string) {
	ctx := c.Request.Context()
	result, syncErr := h.service.SyncSheet(ctx, matchID, teamID)
	if syncErr != nil && result == nil {
		playerTicketError(c, syncErr)
		return
	}
	sheet, err := h.service.Sheet(ctx, matchID, teamID)
	if err != nil {
		playerTicketError(c, err)
		return
	}
	body := gin.H{"sheet": sheet, "result": result}
	if syncErr != nil {
		body["error"] = syncErr.Error()
	}
	c.JSON(http.StatusOK, body)
}

// ListSheetDays godoc
// @Summary Match days that have team sheets, newest first
// @Tags player-tickets
// @Produce json
// @Success 200
// @Router /api/v1/admin/player-tickets/days [get]
func (h *PlayerTicketHandler) ListSheetDays(c *gin.Context) {
	days, err := h.service.SheetDays(c.Request.Context())
	if err != nil {
		playerTicketError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": days})
}

// GetDaySheets godoc
// @Summary Every team sheet on one match day, with every player's ticket code
// @Tags player-tickets
// @Produce json
// @Param id path string true "Match day ID"
// @Success 200 {object} dto.PlayerTicketDaySheetsResponse
// @Router /api/v1/admin/player-tickets/days/{id} [get]
func (h *PlayerTicketHandler) GetDaySheets(c *gin.Context) {
	id := c.Param("id")
	if !isUUID(id) {
		c.JSON(http.StatusNotFound, gin.H{"error": "match day not found"})
		return
	}
	res, err := h.service.DaySheets(c.Request.Context(), id)
	if err != nil {
		playerTicketError(c, err)
		return
	}
	c.JSON(http.StatusOK, res)
}

func adminSheetParams(c *gin.Context) (string, string, bool) {
	matchID, ok := matchParam(c)
	if !ok {
		return "", "", false
	}
	teamID := c.Param("teamId")
	if !isUUID(teamID) {
		c.JSON(http.StatusNotFound, gin.H{"error": "team not found"})
		return "", "", false
	}
	return matchID, teamID, true
}

// GetSheet godoc
// @Summary One team's sheet for one match, with every player's ticket code
// @Tags player-tickets
// @Produce json
// @Param matchId path string true "Match ID"
// @Param teamId path string true "Team ID"
// @Success 200 {object} dto.PlayerTicketSheetResponse
// @Router /api/v1/admin/player-tickets/matches/{matchId}/teams/{teamId} [get]
func (h *PlayerTicketHandler) GetSheet(c *gin.Context) {
	matchID, teamID, ok := adminSheetParams(c)
	if !ok {
		return
	}
	sheet, err := h.service.Sheet(c.Request.Context(), matchID, teamID)
	if err != nil {
		playerTicketError(c, err)
		return
	}
	c.JSON(http.StatusOK, sheet)
}

// IssueSheet godoc
// @Summary Issue tickets to any player on a team's sheet still without one
// @Tags player-tickets
// @Produce json
// @Param matchId path string true "Match ID"
// @Param teamId path string true "Team ID"
// @Success 200
// @Router /api/v1/admin/player-tickets/matches/{matchId}/teams/{teamId}/issue [post]
func (h *PlayerTicketHandler) IssueSheet(c *gin.Context) {
	matchID, teamID, ok := adminSheetParams(c)
	if !ok {
		return
	}
	h.issueAndRespond(c, matchID, teamID)
}
