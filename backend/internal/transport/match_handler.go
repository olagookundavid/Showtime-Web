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

type IMatchHandler interface {
	GetCompetitions(c *gin.Context)
	GetMatches(c *gin.Context)
	GetTeams(c *gin.Context)
	CreateMatch(c *gin.Context)
	UpdateMatch(c *gin.Context)
	DeleteMatch(c *gin.Context)
	GetStandings(c *gin.Context)
	CreateStanding(c *gin.Context)
	UpdateStanding(c *gin.Context)
	DeleteStanding(c *gin.Context)
}

type MatchHandler struct {
	service services.IMatchService
}

func NewMatchHandler(service services.IMatchService) IMatchHandler {
	return &MatchHandler{service: service}
}

// GetCompetitions godoc
// @Summary      Get all competitions
// @Tags         match-hub
// @Produce      json
// @Success      200  {array}   dto.CompetitionResponse
// @Router       /api/v1/matches/competitions [get]
func (h *MatchHandler) GetCompetitions(c *gin.Context) {
	competitions, err := h.service.GetCompetitions(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": competitions})
}

// GetMatches godoc
// @Summary      Get matches (optionally filtered by competition)
// @Tags         match-hub
// @Param        competition_id query string false "Competition ID"
// @Param        page query int false "Page number"
// @Param        limit query int false "Items per page"
// @Produce      json
// @Success      200  {object}  map[string]string
// @Router       /api/v1/matches [get]
func (h *MatchHandler) GetMatches(c *gin.Context) {
	competitionID := c.Query("competition_id")
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

	matches, err := h.service.GetMatches(c.Request.Context(), competitionID, status, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, matches)
}

// GetTeams godoc
// @Summary      Get all teams
// @Tags         match-hub
// @Produce      json
// @Success      200  {object}  []dto.TeamResponse
// @Router       /api/v1/matches/teams [get]
func (h *MatchHandler) GetTeams(c *gin.Context) {
	teams, err := h.service.GetTeams(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": teams})
}

// CreateMatch godoc
// @Summary      Create a match
// @Tags         match-hub
// @Produce      json
// @Success      200  {object}  map[string]string
// @Router       /api/v1/matches [post]
func (h *MatchHandler) CreateMatch(c *gin.Context) {
	var req dto.CreateMatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Parse Date
	date, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid date format. Use YYYY-MM-DD"})
		return
	}

	// Parse StartTime (DTO expects RFC3339 string)
	startTime, err := time.Parse(time.RFC3339, req.StartTime)
	if err != nil {
		// Fallback: try convenient formats
		startTime, err = time.Parse("2006-01-02T15:04:05Z07:00", req.StartTime)
		if err != nil {
			startTime, err = time.Parse("15:04", req.StartTime) // Just time?
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid start_time format. Use RFC3339"})
				return
			}
		}
	}

	match := &domain.Match{
		CompetitionID: req.CompetitionID,
		HomeTeamID:    req.HomeTeamID,
		AwayTeamID:    req.AwayTeamID,
		Date:          date,
		StartTime:     startTime,
		Venue:         req.Venue,
		Status:        domain.MatchStatus(req.Status),
		TicketURL:     stringPtr(req.TicketURL),
		HighlightsURL: stringPtr(req.HighlightsURL),
	}

	if match.Status == "" {
		match.Status = "SCHEDULED"
	}

	if err := h.service.CreateMatch(c.Request.Context(), match); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "Match created", "id": match.ID})
}

// UpdateMatch godoc
// @Summary      Update a match
// @Tags         match-hub
// @Produce      json
// @Param        id path string true "Match ID"
// @Param        request body dto.UpdateMatchRequest true "Match update request"
// @Success      200  {object}  map[string]string
// @Router       /api/v1/matches/{id} [put]
func (h *MatchHandler) UpdateMatch(c *gin.Context) {
	id := c.Param("id")
	var req dto.UpdateMatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	match := &domain.Match{
		ID:            id,
		CompetitionID: req.CompetitionID,
		HomeTeamID:    req.HomeTeamID,
		AwayTeamID:    req.AwayTeamID,
		Venue:         req.Venue,
		HighlightsURL: stringPtr(req.HighlightsURL),
		TicketURL:     stringPtr(req.TicketURL),
	}

	if req.Date != "" {
		match.Date, _ = time.Parse("2006-01-02", req.Date)
	}
	if req.StartTime != "" {
		match.StartTime, _ = time.Parse(time.RFC3339, req.StartTime)
	}
	if req.Status != "" {
		match.Status = domain.MatchStatus(req.Status)
	}
	if req.HomeScore != nil {
		match.HomeScore = req.HomeScore
	}
	if req.AwayScore != nil {
		match.AwayScore = req.AwayScore
	}

	if err := h.service.UpdateMatch(c.Request.Context(), match); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Match updated"})
}

// DeleteMatch godoc
// @Summary      Delete a match
// @Tags         match-hub
// @Produce      json
// @Param        id path string true "Match ID"
// @Success      200  {object}  map[string]string
// @Router       /api/v1/matches/{id} [delete]
func (h *MatchHandler) DeleteMatch(c *gin.Context) {
	id := c.Param("id")
	if err := h.service.DeleteMatch(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Match deleted"})
}

// GetStandings godoc
// @Summary      Get standings for a competition
// @Tags         match-hub
// @Param        competition_id query string true "Competition ID"
// @Produce      json
// @Success      200  {array}    []dto.StandingResponse
// @Router       /api/v1/matches/standings [get]
func (h *MatchHandler) GetStandings(c *gin.Context) {
	competitionID := c.Query("competition_id")
	if competitionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "competition_id is required"})
		return
	}

	standings, err := h.service.GetStandings(c.Request.Context(), competitionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": standings})
}

// CreateStanding godoc
// @Summary      Create a standing entry
// @Tags         match-hub
// @Produce      json
// @Success      201  {object}  map[string]string
// @Router       /api/v1/matches/standings [post]
func (h *MatchHandler) CreateStanding(c *gin.Context) {
	var req dto.CreateStandingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	standing := &domain.Standing{
		CompetitionID: req.CompetitionID,
		TeamID:        req.TeamID,
		Position:      req.Position,
		Played:        req.Played,
		Won:           req.Won,
		Drawn:         req.Drawn,
		Lost:          req.Lost,
		GoalsFor:      req.GoalsFor,
		GoalsAgainst:  req.GoalsAgainst,
		GoalDiff:      req.GoalsFor - req.GoalsAgainst,
		Points:        req.Points,
	}

	if err := h.service.CreateStanding(c.Request.Context(), standing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "Standing created", "id": standing.ID})
}

// UpdateStanding godoc
// @Summary      Update a standing entry
// @Tags         match-hub
// @Produce      json
// @Param        id path string true "Standing ID"
// @Param        request body dto.UpdateStandingRequest true "Standing update request"
// @Success      200  {object}  map[string]string
// @Router       /api/v1/matches/standings/{id} [put]
func (h *MatchHandler) UpdateStanding(c *gin.Context) {
	id := c.Param("id")
	var req dto.UpdateStandingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	standing := &domain.Standing{
		ID:            id,
		CompetitionID: req.CompetitionID,
		TeamID:        req.TeamID,
		Position:      req.Position,
		Played:        req.Played,
		Won:           req.Won,
		Drawn:         req.Drawn,
		Lost:          req.Lost,
		GoalsFor:      req.GoalsFor,
		GoalsAgainst:  req.GoalsAgainst,
		GoalDiff:      req.GoalsFor - req.GoalsAgainst,
		Points:        req.Points,
	}

	if err := h.service.UpdateStanding(c.Request.Context(), standing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Standing updated"})
}

// DeleteStanding godoc
// @Summary      Delete a standing entry
// @Tags         match-hub
// @Produce      json
// @Param        id path string true "Standing ID"
// @Success      200  {object}  map[string]string
// @Router       /api/v1/matches/standings/{id} [delete]
func (h *MatchHandler) DeleteStanding(c *gin.Context) {
	id := c.Param("id")
	if err := h.service.DeleteStanding(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Standing deleted"})
}

func stringPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
