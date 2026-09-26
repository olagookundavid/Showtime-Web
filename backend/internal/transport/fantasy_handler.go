package transport

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"pkg-common/helpers"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type IFantasyHandler interface {
	GetActiveSeason(c *gin.Context)
	GetGameweeks(c *gin.Context)
	ListPlayerMarket(c *gin.Context)
	GetPlayerBreakdown(c *gin.Context)
	GetPlayerPriceHistory(c *gin.Context)
	EnterSeason(c *gin.Context)
	GetDashboard(c *gin.Context)
	SaveLineup(c *gin.Context)
	GetMyLineup(c *gin.Context)
	GetTeamLineup(c *gin.Context)
	GetGameweekReport(c *gin.Context)

	// Admin
	AdminListSeasons(c *gin.Context)
	AdminCreateSeason(c *gin.Context)
	AdminActivateSeason(c *gin.Context)
	AdminDeleteSeason(c *gin.Context)
	AdminCreateGameweek(c *gin.Context)
	AdminGetScheduledMatchDays(c *gin.Context)
	AdminAutoScheduleGameweeks(c *gin.Context)
	AdminUpdateGameweekDeadline(c *gin.Context)
	AdminDeleteGameweek(c *gin.Context)
	AdminInitializePrices(c *gin.Context)
	AdminListPlayerPrices(c *gin.Context)
	AdminOverridePlayerPrice(c *gin.Context)
	AdminFinalizeGameweek(c *gin.Context)
}

type FantasyHandler struct {
	service services.IFantasyService
}

func NewFantasyHandler(service services.IFantasyService) IFantasyHandler {
	return &FantasyHandler{service: service}
}

func (h *FantasyHandler) GetActiveSeason(c *gin.Context) {
	season, err := h.service.GetActiveSeason(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if season == nil {
		c.JSON(http.StatusOK, gin.H{"data": nil})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": season})
}

func (h *FantasyHandler) GetGameweeks(c *gin.Context) {
	seasonID := c.Param("id")
	list, err := h.service.GetGameweeks(c.Request.Context(), seasonID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": list})
}

func (h *FantasyHandler) ListPlayerMarket(c *gin.Context) {
	seasonID := c.Param("id")
	// position accepts a comma-separated list so a slot can ask for every
	// rating category it allows (a receiver slot takes "Receiver,Center").
	var positions []string
	for _, p := range strings.Split(c.Query("position"), ",") {
		if p = strings.TrimSpace(p); p != "" {
			positions = append(positions, p)
		}
	}
	gender := c.Query("gender")
	teamID := c.Query("team_id")
	search := c.Query("search")
	sortBy := c.Query("sort")

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	list, total, err := h.service.ListPlayerMarket(c.Request.Context(), seasonID, positions, gender, teamID, search, sortBy, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	totalPages := 0
	if limit > 0 {
		totalPages = (total + limit - 1) / limit
	}

	c.JSON(http.StatusOK, gin.H{
		"data":        list,
		"total":       total,
		"page":        page,
		"limit":       limit,
		"total_pages": totalPages,
	})
}

func (h *FantasyHandler) GetPlayerBreakdown(c *gin.Context) {
	playerID := c.Param("id")
	gwID := c.Param("gwId")

	breakdown, err := h.service.GetPlayerBreakdown(c.Request.Context(), playerID, gwID)
	if errors.Is(err, services.ErrGameweekNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	// A player can legitimately have no stat lines yet for a real gameweek —
	// before kickoff, or while a match day is still being played. That is not
	// an error: it answers with empty data so the client shows "no stats yet"
	// instead of retrying a request that will never succeed.
	c.JSON(http.StatusOK, gin.H{"data": breakdown})
}

func (h *FantasyHandler) GetPlayerPriceHistory(c *gin.Context) {
	playerID := c.Param("id")
	seasonID := c.Query("season_id")

	history, err := h.service.GetPlayerPriceHistory(c.Request.Context(), seasonID, playerID)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "not found") {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": history})
}

// EnterSeason signs the manager up for a season — the deliberate opt-in that
// replaces being enrolled as a side effect of saving a squad.
func (h *FantasyHandler) EnterSeason(c *gin.Context) {
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		helpers.UnAuthorizedResponse(c, "unauthorized")
		return
	}

	var req dto.EnterSeasonRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	team, err := h.service.EnterSeason(c.Request.Context(), payload.UserId, c.Param("id"), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "You're in. Good luck!", "data": team})
}

// GetDashboard is the manager's weekly landing view.
func (h *FantasyHandler) GetDashboard(c *gin.Context) {
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		helpers.UnAuthorizedResponse(c, "unauthorized")
		return
	}

	res, err := h.service.GetDashboard(c.Request.Context(), payload.UserId, c.Query("season_id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": res})
}

func (h *FantasyHandler) SaveLineup(c *gin.Context) {
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		helpers.UnAuthorizedResponse(c, "unauthorized")
		return
	}

	var req dto.SaveLineupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	res, err := h.service.SaveLineup(c.Request.Context(), payload.UserId, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Lineup saved successfully",
		"data":    res,
	})
}

func (h *FantasyHandler) GetMyLineup(c *gin.Context) {
	payload, err := helpers.GetTokenPayloadFromContext(c)
	if err != nil || payload == nil {
		helpers.UnAuthorizedResponse(c, "unauthorized")
		return
	}

	seasonID := c.Query("season_id")
	gameweekID := c.Query("gameweek_id")
	if seasonID == "" || gameweekID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "season_id and gameweek_id are required"})
		return
	}

	res, err := h.service.GetMyLineup(c.Request.Context(), payload.UserId, seasonID, gameweekID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": res})
}

func (h *FantasyHandler) GetTeamLineup(c *gin.Context) {
	teamID := c.Param("team_id")
	gameweekID := c.Param("gw_id")
	if teamID == "" || gameweekID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "team_id and gw_id are required"})
		return
	}

	requestingUserID := ""
	if payload, err := helpers.GetTokenPayloadFromContext(c); err == nil && payload != nil {
		requestingUserID = payload.UserId
	}

	res, err := h.service.GetTeamLineup(c.Request.Context(), requestingUserID, teamID, gameweekID)
	if err != nil {
		if errors.Is(err, services.ErrGameweekNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": res})
}

func (h *FantasyHandler) GetGameweekReport(c *gin.Context) {
	seasonID := c.Param("season_id")
	gameweekID := c.Param("gw_id")
	if seasonID == "" || gameweekID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "season_id and gw_id are required"})
		return
	}

	res, err := h.service.GetGameweekReport(c.Request.Context(), seasonID, gameweekID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": res})
}

// ─── Admin Handlers ───────────────────────────────────────────────────────────

// AdminListSeasons returns every season, including drafts, so the admin can
// see and activate a season it just created.
func (h *FantasyHandler) AdminListSeasons(c *gin.Context) {
	page, limit := pageParams(c, 25)
	list, total, err := h.service.ListSeasons(c.Request.Context(), page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	pagedJSON(c, list, total, page, limit)
}

func (h *FantasyHandler) AdminCreateSeason(c *gin.Context) {
	var req dto.CreateFantasySeasonRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	res, err := h.service.CreateSeason(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Fantasy season created successfully",
		"data":    res,
	})
}

func (h *FantasyHandler) AdminActivateSeason(c *gin.Context) {
	seasonID := c.Param("id")
	if err := h.service.ActivateSeason(c.Request.Context(), seasonID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Fantasy season activated successfully"})
}

func (h *FantasyHandler) AdminDeleteSeason(c *gin.Context) {
	if err := h.service.DeleteSeason(c.Request.Context(), c.Param("id")); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Draft season deleted"})
}

func (h *FantasyHandler) AdminCreateGameweek(c *gin.Context) {
	seasonID := c.Param("id")
	var req dto.CreateGameweekRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// A gameweek whose event day has no fixtures, or a malformed deadline
	// override, is a correctable admin mistake rather than a server fault.
	res, err := h.service.CreateGameweek(c.Request.Context(), seasonID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Fantasy gameweek created successfully",
		"data":    res,
	})
}

// AdminGetScheduledMatchDays returns all scheduled match dates for the season's competition.
func (h *FantasyHandler) AdminGetScheduledMatchDays(c *gin.Context) {
	seasonID := c.Param("id")
	days, err := h.service.GetScheduledMatchDays(c.Request.Context(), seasonID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": days})
}

// AdminAutoScheduleGameweeks re-syncs a season's gameweeks against its
// competition's fixtures. Idempotent and safe to press repeatedly: it adds days
// that appeared, drops scheduled gameweeks whose fixtures went away, follows
// kickoff changes, and never touches a gameweek that has already been played.
//
// The same sync runs automatically whenever a fixture changes; this endpoint is
// the manual trigger for when an admin wants to be sure.
func (h *FantasyHandler) AdminAutoScheduleGameweeks(c *gin.Context) {
	seasonID := c.Param("id")
	gws, err := h.service.AutoScheduleGameweeks(c.Request.Context(), seasonID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	notices := h.service.GameweekSyncNotices(seasonID)
	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Match days synced with the fixture calendar — %d gameweeks", len(gws)),
		"data":    gws,
		// Anything the sync could not resolve tidily, for the admin to see.
		"notices": notices,
	})
}

// AdminUpdateGameweekDeadline corrects a scheduled gameweek's lock time, for
// when fixtures move after the gameweek was created.
func (h *FantasyHandler) AdminUpdateGameweekDeadline(c *gin.Context) {
	gwID := c.Param("id")
	var req dto.UpdateGameweekDeadlineRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	res, err := h.service.UpdateGameweekDeadline(c.Request.Context(), gwID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Gameweek deadline updated successfully",
		"data":    res,
	})
}

func (h *FantasyHandler) AdminDeleteGameweek(c *gin.Context) {
	gwID := c.Param("id")
	if err := h.service.DeleteGameweek(c.Request.Context(), gwID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Gameweek deleted and remaining gameweeks re-synced successfully"})
}

func (h *FantasyHandler) AdminInitializePrices(c *gin.Context) {
	seasonID := c.Param("id")
	if err := h.service.InitializePlayerPrices(c.Request.Context(), seasonID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Fantasy player prices initialized successfully"})
}

func (h *FantasyHandler) AdminFinalizeGameweek(c *gin.Context) {
	gwID := c.Param("id")
	if err := h.service.FinalizeGameweek(c.Request.Context(), gwID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Fantasy gameweek finalized and scores computed successfully"})
}

func (h *FantasyHandler) AdminListPlayerPrices(c *gin.Context) {
	seasonID := c.Param("id")
	search := c.Query("search")
	position := c.Query("position")
	teamID := c.Query("team_id")
	overrideStatus := c.Query("override_status")

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	list, total, err := h.service.ListPlayerPricesForAdmin(c.Request.Context(), seasonID, search, position, teamID, overrideStatus, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	totalPages := 0
	if limit > 0 {
		totalPages = (total + limit - 1) / limit
	}

	c.JSON(http.StatusOK, gin.H{
		"data":        list,
		"total":       total,
		"page":        page,
		"limit":       limit,
		"total_pages": totalPages,
	})
}

func (h *FantasyHandler) AdminOverridePlayerPrice(c *gin.Context) {
	seasonID := c.Param("id")
	playerID := c.Param("playerId")

	var req dto.AdminOverridePriceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	res, err := h.service.OverridePlayerPrice(c.Request.Context(), seasonID, playerID, req.Price, req.Reset)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Player price override updated successfully",
		"data":    res,
	})
}
