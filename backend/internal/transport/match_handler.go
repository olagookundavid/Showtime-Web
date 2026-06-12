package transport

import (
	"math"
	"net/http"
	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/services"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type IMatchHandler interface {
	GetCompetitions(c *gin.Context)
	CreateCompetition(c *gin.Context)
	UpdateCompetition(c *gin.Context)
	DeleteCompetition(c *gin.Context)
	GenerateBracket(c *gin.Context)
	ResetBracket(c *gin.Context)
	GetMatches(c *gin.Context)
	GetTeams(c *gin.Context)
	GetAllTeams(c *gin.Context)
	GetTeamsByCompetition(c *gin.Context)
	CreateTeam(c *gin.Context)
	UpdateTeam(c *gin.Context)
	DeleteTeam(c *gin.Context)
	CreateMatch(c *gin.Context)
	UpdateMatch(c *gin.Context)
	DeleteMatch(c *gin.Context)
	GetStandings(c *gin.Context)
	CreateStanding(c *gin.Context)
	UpdateStanding(c *gin.Context)
	DeleteStanding(c *gin.Context)
	GetMatchDetail(c *gin.Context)
	GetMatchDays(c *gin.Context)
	GetEligiblePlayersForMatchDay(c *gin.Context)
	SaveTeamSheet(c *gin.Context)
	GetAdminTeamSheet(c *gin.Context)
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
// @Param        search query string false "Search by name"
// @Param        page query int false "Page number"
// @Param        limit query int false "Items per page"
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Router       /api/v1/matches/competitions [get]
func (h *MatchHandler) GetCompetitions(c *gin.Context) {
	search := c.Query("search")
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	result, err := h.service.GetCompetitions(c.Request.Context(), page, limit, search, status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
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
	search := c.Query("search")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

	matches, err := h.service.GetMatches(c.Request.Context(), competitionID, status, page, limit, search)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, matches)
}

// GetTeams godoc
// @Summary      Get all teams (paginated, searchable)
// @Tags         admin
// @Param        search query string false "Search by name/short_name"
// @Param        page query int false "Page number"
// @Param        limit query int false "Items per page"
// @Produce      json
// @Success      200  {object}  map[string]string
// @Router       /api/v1/admin/teams [get]
func (h *MatchHandler) GetTeams(c *gin.Context) {
	search := c.Query("search")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "12"))

	result, err := h.service.GetTeams(c.Request.Context(), page, limit, search)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

// GetAllTeams godoc
// @Summary      Get all teams (no pagination)
// @Tags         match-hub
// @Produce      json
// @Success      200  {object}  []dto.TeamResponse
// @Router       /api/v1/matches/teams [get]
func (h *MatchHandler) GetAllTeams(c *gin.Context) {
	teams, err := h.service.GetAllTeams(c.Request.Context())
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

	// Validation: Team cannot play itself (empty IDs are TBD bracket slots)
	if req.HomeTeamID != "" && req.HomeTeamID == req.AwayTeamID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Home team and away team cannot be the same"})
		return
	}

	// Parse Date
	date, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid date format. Use YYYY-MM-DD"})
		return
	}

	// Default StartTime if empty
	if req.StartTime == "" {
		req.StartTime = "00:00"
	}

	// Parse StartTime (DTO expects RFC3339 or HH:MM string)
	var startTime time.Time
	if len(req.StartTime) == 5 { // HH:MM
		startTime, err = time.Parse("15:04", req.StartTime)
	} else {
		startTime, err = time.Parse(time.RFC3339, req.StartTime)
		if err != nil {
			startTime, err = time.Parse("2006-01-02T15:04:05Z07:00", req.StartTime)
		}
	}

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid start_time format. Use HH:MM or RFC3339"})
		return
	}

	match := &domain.Match{
		CompetitionID: req.CompetitionID,
		HomeTeamID:    req.HomeTeamID,
		AwayTeamID:    req.AwayTeamID,
		Date:          date,
		StartTime:     startTime,
		Venue:         req.Venue,
		Status:        domain.MatchStatus(req.Status),
		TicketURL:     req.TicketURL,
		HighlightsURL: req.HighlightsURL,
		HomeScore:     req.HomeScore,
		AwayScore:     req.AwayScore,
		Round:         req.Round,
		BracketPos:    req.BracketPos,
		FeedsMatchID:  req.FeedsMatchID,
		FeedsSlot:     strings.ToUpper(req.FeedsSlot),
	}

	if match.Status == "" {
		match.Status = "SCHEDULED"
	}

	// Validation: Finished matches must have scores
	if match.Status == domain.MatchStatusFinished {
		if match.HomeScore == nil || match.AwayScore == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Home and Away scores must be provided for finished matches"})
			return
		}
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

	// Validation: Team cannot play itself
	if req.HomeTeamID != "" && req.AwayTeamID != "" && req.HomeTeamID == req.AwayTeamID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Home team and away team cannot be the same"})
		return
	}

	match := &domain.Match{
		ID:            id,
		CompetitionID: req.CompetitionID,
		HomeTeamID:    req.HomeTeamID,
		AwayTeamID:    req.AwayTeamID,
		Venue:         req.Venue,
		HighlightsURL: req.HighlightsURL,
		TicketURL:     req.TicketURL,
		Round:         req.Round,
		BracketPos:    req.BracketPos,
		FeedsMatchID:  req.FeedsMatchID,
		FeedsSlot:     strings.ToUpper(req.FeedsSlot),
	}

	if req.Date != "" {
		match.Date, _ = time.Parse("2006-01-02", req.Date)
	}
	if req.StartTime != "" {
		if len(req.StartTime) == 5 {
			match.StartTime, _ = time.Parse("15:04", req.StartTime)
		} else {
			match.StartTime, _ = time.Parse(time.RFC3339, req.StartTime)
		}
	} else {
		// Explicitly set to zero-time / midnight placeholder for TBD
		match.StartTime, _ = time.Parse("15:04", "00:00")
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

	// Validation: Finished matches must have scores
	if match.Status == domain.MatchStatusFinished {
		if match.HomeScore == nil || match.AwayScore == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Home and Away scores must be provided when finishing a match"})
			return
		}
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

	played := req.Won + req.Drawn + req.Lost
	var pct float64
	if played > 0 {
		pct = math.Round(((float64(req.Won)*1.0)+(float64(req.Drawn)*0.5))/float64(played)*100*10) / 10
	}

	standing := &domain.Standing{
		CompetitionID: req.CompetitionID,
		TeamID:        req.TeamID,
		Position:      0, // Position is now dynamically calculated by SQL
		Played:        played,
		Won:           req.Won,
		Drawn:         req.Drawn,
		Lost:          req.Lost,
		GoalsFor:      req.GoalsFor,
		GoalsAgainst:  req.GoalsAgainst,
		GoalDiff:      req.GoalsFor - req.GoalsAgainst,
		PCT:           pct,
		L5:            req.L5,
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

	played := req.Won + req.Drawn + req.Lost
	var pct float64
	if played > 0 {
		pct = math.Round(((float64(req.Won)*1.0)+(float64(req.Drawn)*0.5))/float64(played)*100*10) / 10
	}

	standing := &domain.Standing{
		ID:            id,
		CompetitionID: req.CompetitionID,
		TeamID:        req.TeamID,
		Position:      0, // Position is now dynamically calculated by SQL
		Played:        played,
		Won:           req.Won,
		Drawn:         req.Drawn,
		Lost:          req.Lost,
		GoalsFor:      req.GoalsFor,
		GoalsAgainst:  req.GoalsAgainst,
		GoalDiff:      req.GoalsFor - req.GoalsAgainst,
		PCT:           pct,
		L5:            req.L5,
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

// GetTeamsByCompetition godoc
// @Summary      Get teams for a competition
// @Tags         match-hub
// @Param        competition_id query string true "Competition ID"
// @Produce      json
// @Success      200 {array} dto.TeamResponse
// @Router       /api/v1/admin/teams/by-competition [get]
func (h *MatchHandler) GetTeamsByCompetition(c *gin.Context) {
	competitionID := c.Query("competition_id")
	if competitionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "competition_id is required"})
		return
	}

	teams, err := h.service.GetTeamsByCompetition(c.Request.Context(), competitionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": teams})
}

// CreateTeam godoc
// @Summary      Create a team
// @Tags         admin
// @Accept       json
// @Produce      json
// @Param        request body dto.CreateTeamRequest true "Team"
// @Success      201 {object} map[string]string
// @Router       /api/v1/admin/teams [post]
func (h *MatchHandler) CreateTeam(c *gin.Context) {
	var req dto.CreateTeamRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	team := &domain.Team{
		Name:      strings.ToUpper(strings.TrimSpace(req.Name)),
		ShortName: strings.ToUpper(strings.TrimSpace(req.ShortName)),
		Logo:      req.Logo,
	}

	if err := h.service.CreateTeam(c.Request.Context(), team); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "Team created", "data": gin.H{"id": team.ID, "name": team.Name}})
}

// UpdateTeam godoc
// @Summary      Update a team
// @Tags         admin
// @Accept       json
// @Produce      json
// @Param        id path string true "Team ID"
// @Param        request body dto.CreateTeamRequest true "Team"
// @Success      200 {object} map[string]string
// @Router       /api/v1/admin/teams/{id} [put]
func (h *MatchHandler) UpdateTeam(c *gin.Context) {
	id := c.Param("id")
	var req dto.CreateTeamRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	team := &domain.Team{
		ID:        id,
		Name:      strings.ToUpper(strings.TrimSpace(req.Name)),
		ShortName: strings.ToUpper(strings.TrimSpace(req.ShortName)),
		Logo:      req.Logo,
	}

	if err := h.service.UpdateTeam(c.Request.Context(), team); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Team updated"})
}

// DeleteTeam godoc
// @Summary      Delete a team
// @Tags         admin
// @Produce      json
// @Param        id path string true "Team ID"
// @Success      200 {object} map[string]string
// @Router       /api/v1/admin/teams/{id} [delete]
func (h *MatchHandler) DeleteTeam(c *gin.Context) {
	id := c.Param("id")
	if err := h.service.DeleteTeam(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Team deleted"})
}

// CreateCompetition godoc
// @Summary      Create a competition
// @Tags         admin
// @Accept       json
// @Produce      json
// @Param        request body dto.CreateCompetitionRequest true "Competition"
// @Success      201 {object} map[string]string
// @Router       /api/v1/admin/competitions [post]
func (h *MatchHandler) CreateCompetition(c *gin.Context) {
	var req dto.CreateCompetitionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	status := req.Status
	if status == "" {
		status = "active"
	}

	format := strings.ToUpper(req.Format)
	if format == "" {
		format = string(domain.CompetitionFormatLeague)
	}
	if format != string(domain.CompetitionFormatLeague) && format != string(domain.CompetitionFormatKnockout) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "format must be LEAGUE or KNOCKOUT"})
		return
	}

	comp := &domain.Competition{
		Name:   req.Name,
		Logo:   req.Logo,
		Status: status,
		Format: format,
	}

	if err := h.service.CreateCompetition(c.Request.Context(), comp); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "Competition created", "data": gin.H{"id": comp.ID, "name": comp.Name}})
}

// UpdateCompetition godoc
// @Summary      Update a competition
// @Tags         admin
// @Accept       json
// @Produce      json
// @Param        id path string true "Competition ID"
// @Param        request body dto.CreateCompetitionRequest true "Competition"
// @Success      200 {object} map[string]string
// @Router       /api/v1/admin/competitions/{id} [put]
func (h *MatchHandler) UpdateCompetition(c *gin.Context) {
	id := c.Param("id")
	var req dto.CreateCompetitionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	format := strings.ToUpper(req.Format)
	if format == "" {
		format = string(domain.CompetitionFormatLeague)
	}
	if format != string(domain.CompetitionFormatLeague) && format != string(domain.CompetitionFormatKnockout) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "format must be LEAGUE or KNOCKOUT"})
		return
	}

	comp := &domain.Competition{
		ID:     id,
		Name:   req.Name,
		Logo:   req.Logo,
		Status: req.Status,
		Format: format,
	}

	if err := h.service.UpdateCompetition(c.Request.Context(), comp); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Competition updated"})
}

// GenerateBracket godoc
// @Summary      Generate the knockout bracket for a competition
// @Tags         admin
// @Accept       json
// @Produce      json
// @Param        id path string true "Competition ID"
// @Param        request body dto.GenerateBracketRequest true "Bracket setup"
// @Success      201 {object} map[string]string
// @Router       /api/v1/admin/competitions/{id}/bracket [post]
func (h *MatchHandler) GenerateBracket(c *gin.Context) {
	id := c.Param("id")
	var req dto.GenerateBracketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.GenerateBracket(c.Request.Context(), id, req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "Bracket generated"})
}

// ResetBracket godoc
// @Summary      Delete all matches of a knockout competition
// @Tags         admin
// @Produce      json
// @Param        id path string true "Competition ID"
// @Success      200 {object} map[string]string
// @Router       /api/v1/admin/competitions/{id}/bracket [delete]
func (h *MatchHandler) ResetBracket(c *gin.Context) {
	id := c.Param("id")
	if err := h.service.ResetBracket(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Bracket reset"})
}

// DeleteCompetition godoc
// @Summary      Delete a competition
// @Tags         admin
// @Produce      json
// @Param        id path string true "Competition ID"
// @Success      200 {object} map[string]string
// @Router       /api/v1/admin/competitions/{id} [delete]
func (h *MatchHandler) DeleteCompetition(c *gin.Context) {
	id := c.Param("id")
	if err := h.service.DeleteCompetition(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Competition deleted"})
}

// GetMatchDetail godoc
// @Summary      Get match details with team sheets
// @Tags         match-hub
// @Param        id path string true "Match ID"
// @Produce      json
// @Success      200 {object} domain.MatchDetail
// @Router       /api/v1/matches/{id} [get]
func (h *MatchHandler) GetMatchDetail(c *gin.Context) {
	id := c.Param("id")
	detail, err := h.service.GetMatchDetail(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": detail})
}

func (h *MatchHandler) GetMatchDays(c *gin.Context) {
	competitionID := c.Query("competition_id")
	if competitionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "competition_id is required"})
		return
	}

	days, err := h.service.GetMatchDaysByCompetition(c.Request.Context(), competitionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": days})
}

func (h *MatchHandler) GetEligiblePlayersForMatchDay(c *gin.Context) {
	competitionID := c.Query("competition_id")
	date := c.Query("date")

	if competitionID == "" || date == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "competition_id and date are required"})
		return
	}

	players, err := h.service.GetEligiblePlayersForMatchDay(c.Request.Context(), competitionID, date)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": players})
}

// SaveTeamSheet godoc
// @Summary      Save team sheet for a match
// @Tags         admin
// @Param        id path string true "Match ID"
// @Param        request body dto.SaveTeamSheetRequest true "Team sheet payload"
// @Produce      json
// @Success      200 {object} map[string]string
// @Router       /api/v1/admin/matches/{id}/team-sheets [post]
func (h *MatchHandler) SaveTeamSheet(c *gin.Context) {
	matchID := c.Param("id")
	var req dto.SaveTeamSheetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.SaveTeamSheet(c.Request.Context(), matchID, req.TeamID, req.PlayerIDs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Team sheet saved successfully"})
}

// GetAdminTeamSheet godoc
// @Summary      Get team sheets for a match
// @Tags         admin
// @Param        id path string true "Match ID"
// @Produce      json
// @Success      200 {object} domain.MatchTeamSheet
// @Router       /api/v1/admin/matches/{id}/team-sheets [get]
func (h *MatchHandler) GetAdminTeamSheet(c *gin.Context) {
	matchID := c.Param("id")
	sheet, err := h.service.GetTeamSheet(c.Request.Context(), matchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": sheet})
}
