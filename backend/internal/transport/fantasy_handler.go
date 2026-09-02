package transport

import (
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
	SaveLineup(c *gin.Context)
	GetMyLineup(c *gin.Context)

	// Admin
	AdminListSeasons(c *gin.Context)
	AdminCreateSeason(c *gin.Context)
	AdminActivateSeason(c *gin.Context)
	AdminDeleteSeason(c *gin.Context)
	AdminCreateGameweek(c *gin.Context)
	AdminUpdateGameweekDeadline(c *gin.Context)
	AdminInitializePrices(c *gin.Context)
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
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if breakdown == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "breakdown not found for player in this gameweek"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": breakdown})
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

// ─── Admin Handlers ───────────────────────────────────────────────────────────

// AdminListSeasons returns every season, including drafts, so the admin can
// see and activate a season it just created.
func (h *FantasyHandler) AdminListSeasons(c *gin.Context) {
	list, err := h.service.ListSeasons(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": list})
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
