package transport

import (
	"errors"
	"net/http"

	"pkg-common/helpers"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"showtime-backend/internal/dto"
	appErrors "showtime-backend/internal/errors"
	"showtime-backend/internal/services"
)

// IPlayerTicketHandler serves team sheets with every player's ticket code: to a
// team manager for their own team, and to admins and ticketers for any game day.
type IPlayerTicketHandler interface {
	// Team manager (scoped to their team; team-portal admins pass ?team_id=).
	ListMySheets(c *gin.Context)
	GetMySheet(c *gin.Context)
	IssueMySheet(c *gin.Context)
	AddMyExtraTicket(c *gin.Context)
	RevokeMyTicket(c *gin.Context)
	RestoreMyTicket(c *gin.Context)

	// A player's own tickets, for their portal.
	GetMyTickets(c *gin.Context)

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
	case errors.Is(err, services.ErrTicketNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case errors.Is(err, services.ErrNoSlotsLeft), errors.Is(err, services.ErrAlreadyHasTicket),
		errors.Is(err, services.ErrTicketUsed), errors.Is(err, services.ErrTicketsClosed):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	case errors.Is(err, services.ErrNeedAName), errors.Is(err, services.ErrBadEmail),
		errors.Is(err, services.ErrNotOnTeam), errors.Is(err, services.ErrNotOnSheetOrTeam):
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
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

// GetMyTickets godoc
// @Summary The signed-in player's own tickets, with the code to show at the gate
// @Tags player-tickets
// @Produce json
// @Success 200
// @Router /api/v1/player-portal/tickets [get]
func (h *PlayerTicketHandler) GetMyTickets(c *gin.Context) {
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	tickets, err := h.service.MyTickets(c.Request.Context(), payload.UserId)
	if err != nil {
		// 409, not 500: the account is fine, it just has no player attached yet.
		if errors.Is(err, appErrors.ErrPlayerNotLinked) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error(), "code": "PLAYER_NOT_LINKED"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": tickets})
}

// AddMyExtraTicket godoc
// @Summary Give one of the team's spare tickets for a match to a reserve or anyone else
// @Tags player-tickets
// @Accept json
// @Produce json
// @Param matchId path string true "Match ID"
// @Param request body dto.AddExtraTicketRequest true "Who to give it to"
// @Success 200 {object} dto.PlayerTicketSheetResponse
// @Router /api/v1/team-head/player-tickets/{matchId}/extras [post]
func (h *PlayerTicketHandler) AddMyExtraTicket(c *gin.Context) {
	team, ok := managerTeam(c)
	if !ok {
		return
	}
	matchID, ok := matchParam(c)
	if !ok {
		return
	}
	var req dto.AddExtraTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.PlayerID != "" && !isUUID(req.PlayerID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": services.ErrNotOnTeam.Error()})
		return
	}
	sheet, err := h.service.AddExtra(c.Request.Context(), matchID, team, req)
	if err != nil {
		playerTicketError(c, err)
		return
	}
	c.JSON(http.StatusOK, sheet)
}

// RevokeMyTicket godoc
// @Summary Take a ticket back, freeing its slot
// @Tags player-tickets
// @Produce json
// @Param matchId path string true "Match ID"
// @Param ticketId path string true "Ticket ID"
// @Success 200 {object} dto.PlayerTicketSheetResponse
// @Router /api/v1/team-head/player-tickets/{matchId}/tickets/{ticketId} [delete]
func (h *PlayerTicketHandler) RevokeMyTicket(c *gin.Context) {
	team, ok := managerTeam(c)
	if !ok {
		return
	}
	matchID, ok := matchParam(c)
	if !ok {
		return
	}
	ticketID := c.Param("ticketId")
	if !isUUID(ticketID) {
		c.JSON(http.StatusNotFound, gin.H{"error": services.ErrTicketNotFound.Error()})
		return
	}
	sheet, err := h.service.Revoke(c.Request.Context(), matchID, team, ticketID)
	if err != nil {
		playerTicketError(c, err)
		return
	}
	c.JSON(http.StatusOK, sheet)
}

// RestoreMyTicket godoc
// @Summary Give a revoked ticket back to a player on the sheet or a manager
// @Tags player-tickets
// @Accept json
// @Produce json
// @Param matchId path string true "Match ID"
// @Param request body dto.RestoreTicketRequest true "Who gets it back"
// @Success 200 {object} dto.PlayerTicketSheetResponse
// @Router /api/v1/team-head/player-tickets/{matchId}/restore [post]
func (h *PlayerTicketHandler) RestoreMyTicket(c *gin.Context) {
	team, ok := managerTeam(c)
	if !ok {
		return
	}
	matchID, ok := matchParam(c)
	if !ok {
		return
	}
	var req dto.RestoreTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if (req.PlayerID != "" && !isUUID(req.PlayerID)) || (req.UserID != "" && !isUUID(req.UserID)) {
		c.JSON(http.StatusBadRequest, gin.H{"error": services.ErrNotOnSheetOrTeam.Error()})
		return
	}
	sheet, err := h.service.Restore(c.Request.Context(), matchID, team, req)
	if err != nil {
		playerTicketError(c, err)
		return
	}
	c.JSON(http.StatusOK, sheet)
}
