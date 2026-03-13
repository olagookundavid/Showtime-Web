package transport

import (
	"net/http"
	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/services"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

type IStatsHandler interface {
	GetPlayerStats(c *gin.Context)
	GetPlayerStatByID(c *gin.Context)
	GetTeamStats(c *gin.Context)
	UpsertPlayerStat(c *gin.Context)
	GetStatDates(c *gin.Context)
}

type StatsHandler struct {
	service services.IStatsService
}

func NewStatsHandler(service services.IStatsService) IStatsHandler {
	return &StatsHandler{service: service}
}

func (h *StatsHandler) getFilterFromParams(c *gin.Context) domain.StatsFilter {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}

	filter := domain.StatsFilter{
		CompetitionID: c.Query("competition_id"),
		Page:          page,
		Limit:         limit,
	}

	eventDayStr := c.Query("event_day")
	if eventDayStr != "" {
		if parsed, err := time.Parse("2006-01-02", eventDayStr); err == nil {
			filter.EventDay = &parsed
		}
	}

	return filter
}

// GetPlayerStats godoc
// @Summary      Get aggregated player stats
// @Tags         stats
// @Param        competition_id query string false "Competition ID"
// @Param        event_day query string false "Event Day (YYYY-MM-DD)"
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Router       /api/v1/stats/players [get]
func (h *StatsHandler) GetPlayerStats(c *gin.Context) {
	filter := h.getFilterFromParams(c)

	stats, total, err := h.service.GetPlayerStats(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if stats == nil {
		stats = []domain.AggregatedPlayerStat{}
	}

	totalPages := 0
	if filter.Limit > 0 {
		totalPages = (total + filter.Limit - 1) / filter.Limit
	}

	c.JSON(http.StatusOK, gin.H{
		"data":        stats,
		"total":       total,
		"page":        filter.Page,
		"limit":       filter.Limit,
		"total_pages": totalPages,
	})
}

// GetPlayerStatByID godoc
// @Summary      Get a single player's aggregated stats (season overall default)
// @Tags         stats
// @Param        id path string true "Player ID"
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Router       /api/v1/stats/players/{id} [get]
func (h *StatsHandler) GetPlayerStatByID(c *gin.Context) {
	id := c.Param("id")
	competitionID := c.Query("competition_id")
	matchDateStr := c.Query("match_date")

	filter := domain.StatsFilter{
		PlayerID:      id,
		CompetitionID: competitionID,
	}

	if matchDateStr != "" {
		if parsed, err := time.Parse("2006-01-02", matchDateStr); err == nil {
			filter.EventDay = &parsed
		}
	}

	stats, _, err := h.service.GetPlayerStats(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if len(stats) == 0 {
		c.JSON(http.StatusOK, gin.H{"data": nil})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": stats[0]})
}

// GetTeamStats godoc
// @Summary      Get aggregated team stats
// @Tags         stats
// @Param        competition_id query string false "Competition ID"
// @Param        event_day query string false "Event Day (YYYY-MM-DD)"
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Router       /api/v1/stats/teams [get]
func (h *StatsHandler) GetTeamStats(c *gin.Context) {
	filter := h.getFilterFromParams(c)

	stats, total, err := h.service.GetTeamStats(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if stats == nil {
		stats = []domain.AggregatedTeamStat{}
	}

	totalPages := 0
	if filter.Limit > 0 {
		totalPages = (total + filter.Limit - 1) / filter.Limit
	}

	c.JSON(http.StatusOK, gin.H{
		"data":        stats,
		"total":       total,
		"page":        filter.Page,
		"limit":       filter.Limit,
		"total_pages": totalPages,
	})
}

// UpsertPlayerStat godoc
// @Summary      Upsert a player stat entry (incremental addition)
// @Tags         stats
// @Param        request body dto.UpsertPlayerStatRequest true "Upsert request payload"
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Router       /api/v1/admin/stats/players [post]
func (h *StatsHandler) UpsertPlayerStat(c *gin.Context) {
	var req dto.UpsertPlayerStatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	matchDate, err := services.ParseMatchDate(req.MatchDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	stat := &domain.PlayerStat{
		PlayerID:            req.PlayerID,
		TeamID:              req.TeamID,
		MatchID:             req.MatchID,
		CompetitionID:       req.CompetitionID,
		MatchDate:           matchDate,
		PassingAttempts:     req.PassingAttempts,
		RushingAttempts:     req.RushingAttempts,
		CompletedPasses:     req.CompletedPasses,
		PassingTDs:          req.PassingTDs,
		RushingTDs:          req.RushingTDs,
		InterceptionsThrown: req.InterceptionsThrown,
		Receptions:          req.Receptions,
		ReceivingTDs:        req.ReceivingTDs,
		ExtraPointsTDs:      req.ExtraPointsTDs,
		Drops:               req.Drops,
		FlagPulls:           req.FlagPulls,
		PassDeflections:     req.PassDeflections,
		Interceptions:       req.Interceptions,
		DefensiveTDs:        req.DefensiveTDs,
		Safety:              req.Safety,
		QBSacks:             req.QBSacks,
		DefSacks:            req.DefSacks,
	}

	if err := h.service.UpsertPlayerStat(c.Request.Context(), stat); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Player stat processed successfully"})
}

// GetStatDates godoc
// @Summary      Get available stat dates
// @Tags         stats
// @Param        competition_id query string false "Competition ID"
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Router       /api/v1/stats/dates [get]
func (h *StatsHandler) GetStatDates(c *gin.Context) {
	compID := c.Query("competition_id")
	dates, err := h.service.GetStatDates(c.Request.Context(), compID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if dates == nil {
		dates = []string{}
	}
	c.JSON(http.StatusOK, gin.H{"data": dates})
}
