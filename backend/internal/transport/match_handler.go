package transport

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net/http"
	"pkg-common/helpers"
	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/services"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
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
	AddTeamToCompetition(c *gin.Context)
	RemoveTeamFromCompetition(c *gin.Context)
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
	SaveTeamHeadTeamSheet(c *gin.Context)
	GetAdminTeamSheet(c *gin.Context)
	OverrideMatchMVP(c *gin.Context)
	InitializeCup(c *gin.Context)
	AdvanceCupRound(c *gin.Context)
	GetCupState(c *gin.Context)
}

type MatchHandler struct {
	service services.IMatchService
}

// lagosLocation is resolved once for the team-sheet pre-kickoff lock check
// below rather than on every save request.
var lagosLocation = func() *time.Location {
	if loc, err := time.LoadLocation("Africa/Lagos"); err == nil {
		return loc
	}
	return time.FixedZone("WAT", 3600)
}()

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
		helpers.ServerErrorResponse(c, err)
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
	// Club filter. Previously the Match Hub pulled a page of every match in the
	// competition and narrowed it in the browser, which hid fixtures that fell on
	// later pages.
	teamID := c.Query("team_id")
	status := c.Query("status")
	search := c.Query("search")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

	matches, err := h.service.GetMatches(c.Request.Context(), competitionID, teamID, status, page, limit, search)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
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
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "12"))

	result, err := h.service.GetTeams(c.Request.Context(), page, limit, search, status)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
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
	status := c.Query("status")
	if status == "" {
		status = "active"
	}
	page, limit := pageParams(c, 50)
	teams, total, err := h.service.GetAllTeams(c.Request.Context(), status, page, limit)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}
	pagedJSON(c, teams, total, page, limit)
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
		helpers.BadResponse(c, err.Error())
		return
	}

	// Validation: Team cannot play itself (empty IDs are TBD bracket slots)
	if req.HomeTeamID != "" && req.HomeTeamID == req.AwayTeamID {
		helpers.BadResponse(c, "Home team and away team cannot be the same")
		return
	}

	// Parse Date
	date, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		helpers.BadResponse(c, "Invalid date format. Use YYYY-MM-DD")
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
		helpers.BadResponse(c, "Invalid start_time format. Use HH:MM or RFC3339")
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
		SecondLegMatchID: req.SecondLegMatchID,
		MVPPlayerID:   req.MVPPlayerID,
	}

	if req.MVPOverridden != nil {
		match.MVPOverridden = *req.MVPOverridden
	} else if req.MVPPlayerID != nil {
		match.MVPOverridden = (*req.MVPPlayerID != "")
	}

	if match.Status == "" {
		match.Status = "SCHEDULED"
	}

	// Validation: Finished matches must have scores (except knockout byes where one team is empty)
	if match.Status == domain.MatchStatusFinished {
		isBye := (match.HomeTeamID != "" && match.AwayTeamID == "") || (match.HomeTeamID == "" && match.AwayTeamID != "")
		if !isBye && (match.HomeScore == nil || match.AwayScore == nil) {
			helpers.BadResponse(c, "Home and Away scores must be provided for finished matches")
			return
		}
	}

	if err := h.service.CreateMatch(c.Request.Context(), match); err != nil {
		helpers.ServerErrorResponse(c, err)
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
		helpers.BadResponse(c, err.Error())
		return
	}

	// Validation: Team cannot play itself
	if req.HomeTeamID != "" && req.AwayTeamID != "" && req.HomeTeamID == req.AwayTeamID {
		helpers.BadResponse(c, "Home team and away team cannot be the same")
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
		SecondLegMatchID: req.SecondLegMatchID,
		MVPPlayerID:   req.MVPPlayerID,
	}

	if req.MVPOverridden != nil {
		match.MVPOverridden = *req.MVPOverridden
	} else if req.MVPPlayerID != nil {
		match.MVPOverridden = (*req.MVPPlayerID != "")
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

	// Validation: Finished matches must have scores (except knockout byes where one team is empty)
	if match.Status == domain.MatchStatusFinished {
		isBye := (match.HomeTeamID != "" && match.AwayTeamID == "") || (match.HomeTeamID == "" && match.AwayTeamID != "")
		if !isBye && (match.HomeScore == nil || match.AwayScore == nil) {
			helpers.BadResponse(c, "Home and Away scores must be provided when finishing a match")
			return
		}
	}

	if err := h.service.UpdateMatch(c.Request.Context(), match); err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Match updated"})
}

// OverrideMatchMVP godoc
// @Summary      Override or reset a match's official MVP
// @Tags         match-hub
// @Accept       json
// @Produce      json
// @Param        id      path string true "Match ID"
// @Param        request body dto.OverrideMVPRequest true "MVP override request"
// @Success      200 {object} map[string]string
// @Router       /api/v1/admin/matches/{id}/mvp [put]
func (h *MatchHandler) OverrideMatchMVP(c *gin.Context) {
	id := c.Param("id")
	var req dto.OverrideMVPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}
	override := true
	if req.Override != nil {
		override = *req.Override
	} else if req.PlayerID == nil || *req.PlayerID == "" {
		override = false
	}

	if err := h.service.OverrideMatchMVP(c.Request.Context(), id, req.PlayerID, override); err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Match MVP updated successfully"})
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
		helpers.ServerErrorResponse(c, err)
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
		helpers.BadResponse(c, "competition_id is required")
		return
	}

	page, limit := pageParams(c, 50)
	standings, total, err := h.service.GetStandings(c.Request.Context(), competitionID, page, limit)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}
	pagedJSON(c, standings, total, page, limit)
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
		helpers.BadResponse(c, err.Error())
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
		helpers.ServerErrorResponse(c, err)
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
		helpers.BadResponse(c, err.Error())
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
		helpers.ServerErrorResponse(c, err)
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
		helpers.ServerErrorResponse(c, err)
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
	competitionID := c.Param("id")
	if competitionID == "" {
		competitionID = c.Query("competition_id")
	}
	if competitionID == "" {
		helpers.BadResponse(c, "competition_id is required")
		return
	}
	status := c.Query("status")

	page, limit := pageParams(c, 50)
	teams, total, err := h.service.GetTeamsByCompetition(c.Request.Context(), competitionID, status, page, limit)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}
	if teams == nil {
		teams = []dto.TeamResponse{}
	}
	pagedJSON(c, teams, total, page, limit)
}

type AddTeamToCompetitionRequest struct {
	TeamID string `json:"team_id" binding:"required"`
}

func (h *MatchHandler) AddTeamToCompetition(c *gin.Context) {
	competitionID := c.Param("id")
	if competitionID == "" {
		helpers.BadResponse(c, "competition id is required")
		return
	}

	var req AddTeamToCompetitionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}

	if err := h.service.AddTeamToCompetition(c.Request.Context(), competitionID, req.TeamID); err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Team added to competition successfully"})
}

func (h *MatchHandler) RemoveTeamFromCompetition(c *gin.Context) {
	competitionID := c.Param("id")
	teamID := c.Param("teamId")
	if competitionID == "" || teamID == "" {
		helpers.BadResponse(c, "competition_id and team_id are required")
		return
	}

	if err := h.service.RemoveTeamFromCompetition(c.Request.Context(), competitionID, teamID); err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Team removed from competition successfully"})
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
		helpers.BadResponse(c, err.Error())
		return
	}

	status := strings.ToLower(strings.TrimSpace(req.Status))
	if status == "" {
		status = "active"
	}
	if status != "active" && status != "inactive" {
		helpers.BadResponse(c, "status must be 'active' or 'inactive'")
		return
	}

	team := &domain.Team{
		Name:      strings.ToUpper(strings.TrimSpace(req.Name)),
		ShortName: strings.ToUpper(strings.TrimSpace(req.ShortName)),
		Logo:      req.Logo,
		Status:    status,
	}

	if err := h.service.CreateTeam(c.Request.Context(), team); err != nil {
		helpers.ServerErrorResponse(c, err)
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
		helpers.BadResponse(c, err.Error())
		return
	}

	status := strings.ToLower(strings.TrimSpace(req.Status))
	if status == "" {
		status = "active"
	}
	if status != "active" && status != "inactive" {
		helpers.BadResponse(c, "status must be 'active' or 'inactive'")
		return
	}

	team := &domain.Team{
		ID:        id,
		Name:      strings.ToUpper(strings.TrimSpace(req.Name)),
		ShortName: strings.ToUpper(strings.TrimSpace(req.ShortName)),
		Logo:      req.Logo,
		Status:    status,
	}

	if err := h.service.UpdateTeam(c.Request.Context(), team); err != nil {
		helpers.ServerErrorResponse(c, err)
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
		helpers.ServerErrorResponse(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Team deleted"})
}

// normalizeCompetitionFormat upper-cases the requested format, defaults an
// empty one to SEASON, and reports whether the result is one of the four
// valid formats. Shared by CreateCompetition and UpdateCompetition.
func normalizeCompetitionFormat(format string) (string, bool) {
	f := strings.ToUpper(format)
	if f == "" {
		f = string(domain.CompetitionFormatSeason)
	}
	for _, valid := range domain.ValidCompetitionFormats {
		if f == valid {
			return f, true
		}
	}
	return f, false
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
		helpers.BadResponse(c, err.Error())
		return
	}

	status := req.Status
	if status == "" {
		status = "active"
	}

	format, ok := normalizeCompetitionFormat(req.Format)
	if !ok {
		helpers.BadResponse(c, "format must be one of "+strings.Join(domain.ValidCompetitionFormats, ", "))
		return
	}

	tieBreakerRule := req.TieBreakerRule
	if tieBreakerRule != domain.TieBreakerRulePCT_PD_PF_PA_NAME && tieBreakerRule != domain.TieBreakerRuleH2H_PCT_PD_PF_PA_NAME {
		tieBreakerRule = domain.TieBreakerRulePCT_PD_PF_PA_NAME
	}

	comp := &domain.Competition{
		Name:           req.Name,
		Logo:           req.Logo,
		Status:         status,
		Format:         format,
		SeasonID:       req.SeasonID,
		TieBreakerRule: tieBreakerRule,
		TeamIDs:        req.TeamIDs,
	}

	if err := h.service.CreateCompetition(c.Request.Context(), comp); err != nil {
		helpers.ServerErrorResponse(c, err)
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
		helpers.BadResponse(c, err.Error())
		return
	}

	format, ok := normalizeCompetitionFormat(req.Format)
	if !ok {
		helpers.BadResponse(c, "format must be one of "+strings.Join(domain.ValidCompetitionFormats, ", "))
		return
	}

	tieBreakerRule := req.TieBreakerRule
	if tieBreakerRule != domain.TieBreakerRulePCT_PD_PF_PA_NAME && tieBreakerRule != domain.TieBreakerRuleH2H_PCT_PD_PF_PA_NAME {
		tieBreakerRule = domain.TieBreakerRulePCT_PD_PF_PA_NAME
	}

	comp := &domain.Competition{
		ID:             id,
		Name:           req.Name,
		Logo:           req.Logo,
		Status:         req.Status,
		Format:         format,
		SeasonID:       req.SeasonID,
		TieBreakerRule: tieBreakerRule,
		TeamIDs:        req.TeamIDs,
	}

	if err := h.service.UpdateCompetition(c.Request.Context(), comp); err != nil {
		helpers.ServerErrorResponse(c, err)
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
		helpers.BadResponse(c, err.Error())
		return
	}

	if err := h.service.GenerateBracket(c.Request.Context(), id, req); err != nil {
		helpers.BadResponse(c, err.Error())
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
		helpers.BadResponse(c, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Bracket reset"})
}

// InitializeCup godoc
// @Summary      Initialize Cup tournament with Round 1 fixtures
// @Tags         admin
// @Accept       json
// @Produce      json
// @Param        id path string true "Competition ID"
// @Param        request body dto.InitializeCupRequest false "Initialize cup parameters"
// @Success      201 {object} map[string]string
// @Router       /api/v1/admin/competitions/{id}/cup/initialize [post]
func (h *MatchHandler) InitializeCup(c *gin.Context) {
	id := c.Param("id")
	var req dto.InitializeCupRequest
	_ = c.ShouldBindJSON(&req)
	if err := h.service.InitializeCup(c.Request.Context(), id, req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "Cup tournament initialized with Round 1"})
}

// AdvanceCupRound godoc
// @Summary      Advance Cup tournament to the next stage
// @Tags         admin
// @Accept       json
// @Produce      json
// @Param        id path string true "Competition ID"
// @Param        request body dto.AdvanceCupRequest false "Advance cup parameters"
// @Success      200 {object} map[string]string
// @Router       /api/v1/admin/competitions/{id}/cup/advance [post]
func (h *MatchHandler) AdvanceCupRound(c *gin.Context) {
	id := c.Param("id")
	var req dto.AdvanceCupRequest
	_ = c.ShouldBindJSON(&req)
	if err := h.service.AdvanceCupRound(c.Request.Context(), id, req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Cup round advanced successfully"})
}

// GetCupState godoc
// @Summary      Get current Cup tournament progress and status
// @Tags         admin
// @Produce      json
// @Param        id path string true "Competition ID"
// @Success      200 {object} dto.CupStateResponse
// @Router       /api/v1/admin/competitions/{id}/cup/state [get]
func (h *MatchHandler) GetCupState(c *gin.Context) {
	id := c.Param("id")
	state, err := h.service.GetCupState(c.Request.Context(), id)
	if err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}
	c.JSON(http.StatusOK, state)
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
		helpers.ServerErrorResponse(c, err)
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
		if errors.Is(err, pgx.ErrNoRows) || strings.Contains(err.Error(), "no rows") {
			helpers.NotFoundResponseWithMsg(c, "Match not found")
			return
		}
		helpers.ServerErrorResponse(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": detail})
}

func (h *MatchHandler) GetMatchDays(c *gin.Context) {
	competitionID := c.Query("competition_id")
	if competitionID == "" {
		helpers.BadResponse(c, "competition_id is required")
		return
	}

	page, limit := pageParams(c, 50)
	days, total, err := h.service.GetMatchDaysByCompetition(c.Request.Context(), competitionID, page, limit)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}

	pagedJSON(c, days, total, page, limit)
}

func (h *MatchHandler) GetEligiblePlayersForMatchDay(c *gin.Context) {
	competitionID := c.Query("competition_id")
	date := c.Query("date")

	if competitionID == "" || date == "" {
		helpers.BadResponse(c, "competition_id and date are required")
		return
	}

	page, limit := pageParams(c, 100)
	players, total, err := h.service.GetEligiblePlayersForMatchDay(c.Request.Context(), competitionID, date, page, limit)
	if err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	}

	pagedJSON(c, players, total, page, limit)
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
		helpers.BadResponse(c, err.Error())
		return
	}

	// The admin roster picker sends only player_ids. When a lineup is included,
	// hold it to the same rules as a manager's, so it can't break the format.
	if len(req.Players) > 0 || req.Coverage != 0 {
		detail, err := h.service.GetMatchDetail(c.Request.Context(), matchID)
		if err != nil || detail == nil {
			helpers.BadResponse(c, "Match not found")
			return
		}
		format := domain.GameFormatForCompetition(competitionFormatOf(detail.Match))
		if msg, err := h.checkLineup(c.Request.Context(), format, req); err != nil {
			helpers.ServerErrorResponse(c, err)
			return
		} else if msg != "" {
			helpers.BadResponse(c, msg)
			return
		}
	}

	if err := h.service.SaveTeamSheet(c.Request.Context(), matchID, req); err != nil {
		if errors.Is(err, domain.ErrPlayerOnReserveTeam) {
			helpers.BadResponse(c, err.Error())
			return
		}
		helpers.ServerErrorResponse(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Team sheet saved successfully"})
}

// competitionFormatOf is the competition format (SEASON, CUP, ...) of a match,
// or "" when the match has no competition loaded.
func competitionFormatOf(m domain.Match) string {
	if m.Competition == nil {
		return ""
	}
	return m.Competition.Format
}

// checkLineup holds a team sheet to its match's game format: the scheme must be
// one the format offers, and if starters are named they must form a complete
// lineup (see GameFormatSpec.ValidateLineup). It returns a message for the user
// when the sheet is not acceptable, or an error when the check itself failed.
func (h *MatchHandler) checkLineup(ctx context.Context, format domain.GameFormatSpec, req dto.SaveTeamSheetRequest) (string, error) {
	if req.Coverage != 0 && !format.ValidCoverage(req.Coverage) {
		return fmt.Sprintf("Cover %d isn't available in a %s match", req.Coverage, format.Label), nil
	}

	var starters []domain.LineupStarter
	var ids []string
	for _, p := range req.Players {
		if !p.IsStarter {
			continue
		}
		starters = append(starters, domain.LineupStarter{PlayerID: p.PlayerID, Unit: p.StarterUnit, Slot: p.PositionSlot})
		ids = append(ids, p.PlayerID)
	}
	if len(starters) == 0 {
		return "", nil
	}

	females, err := h.service.FemalePlayerIDs(ctx, ids)
	if err != nil {
		return "", err
	}
	if err := format.ValidateLineup(starters, females); err != nil {
		msg := err.Error()
		return strings.ToUpper(msg[:1]) + msg[1:], nil
	}
	return "", nil
}

// SaveTeamHeadTeamSheet allows team heads (or admins) to save team sheets scoped to their managed team
func (h *MatchHandler) SaveTeamHeadTeamSheet(c *gin.Context) {
	matchID := c.Param("id")
	var req dto.SaveTeamSheetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		helpers.BadResponse(c, err.Error())
		return
	}

	if scopedTeam, ok := c.Get("team_manager_team_id"); ok {
		if s, isStr := scopedTeam.(string); isStr && s != "" {
			req.TeamID = s
		}
	}

	if req.TeamID == "" {
		helpers.BadResponse(c, "Team ID is required")
		return
	}

	// 1. Fetch match to verify existence, status and team participation
	detail, err := h.service.GetMatchDetail(c.Request.Context(), matchID)
	if err != nil || detail == nil {
		helpers.BadResponse(c, "Match not found")
		return
	}
	match := detail.Match

	// 2. Manager's team must participate in this match
	homeID := ""
	if match.HomeTeam != nil {
		homeID = match.HomeTeam.ID
	}
	awayID := ""
	if match.AwayTeam != nil {
		awayID = match.AwayTeam.ID
	}
	if homeID != req.TeamID && awayID != req.TeamID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Your team is not participating in this match"})
		return
	}

	// 3. Reject modifications on finished, live, or locked matches (10 minutes before kickoff)
	if match.Status == "FINISHED" {
		helpers.BadResponse(c, "Cannot modify team sheet for a completed match")
		return
	}
	if match.Status == "LIVE" {
		helpers.BadResponse(c, "Cannot modify team sheet while match is live")
		return
	}

	// A postponed match keeps its old date/time until an admin reschedules it,
	// so the kickoff-time lock below would otherwise leave it permanently
	// un-editable the moment its original kickoff passes.
	if match.Status != "POSTPONED" && !match.Date.IsZero() {
		loc := lagosLocation
		// Only enforce 10-minute pre-match lock if a valid start time is scheduled
		hasTime := !match.StartTime.IsZero() && (match.StartTime.Hour() != 0 || match.StartTime.Minute() != 0)
		if hasTime {
			kickoff := time.Date(
				match.Date.Year(), match.Date.Month(), match.Date.Day(),
				match.StartTime.Hour(), match.StartTime.Minute(), match.StartTime.Second(), 0,
				loc,
			)
			cutoff := kickoff.Add(-10 * time.Minute)
			if time.Now().In(loc).After(cutoff) {
				helpers.BadResponse(c, "Team sheet submissions lock 10 minutes prior to kickoff")
				return
			}
		} else {
			// If time is TBD, check if match date is strictly in the past (end of that day in WAT)
			endOfMatchDay := time.Date(
				match.Date.Year(), match.Date.Month(), match.Date.Day(),
				23, 59, 59, 0, loc,
			)
			if time.Now().In(loc).After(endOfMatchDay) {
				helpers.BadResponse(c, "Cannot modify team sheet for a past match")
				return
			}
		}
	}

	// 4. The match's format (cup = 5v5, otherwise 7v7) decides squad size, lineup
	// shape, women's quota and schemes.
	format := domain.GameFormatForCompetition(competitionFormatOf(match))

	totalPlayers := len(req.Players)
	if totalPlayers == 0 {
		totalPlayers = len(req.PlayerIDs)
	}
	if totalPlayers > format.SquadCap {
		helpers.BadResponse(c, fmt.Sprintf("Match squad roster exceeds the maximum limit of %d players", format.SquadCap))
		return
	}

	// 5. Starters: right counts per unit, real unique positions, women per unit.
	if msg, err := h.checkLineup(c.Request.Context(), format, req); err != nil {
		helpers.ServerErrorResponse(c, err)
		return
	} else if msg != "" {
		helpers.BadResponse(c, msg)
		return
	}

	if err := h.service.SaveTeamSheet(c.Request.Context(), matchID, req); err != nil {
		if errors.Is(err, domain.ErrPlayerOnReserveTeam) {
			helpers.BadResponse(c, err.Error())
			return
		}
		helpers.ServerErrorResponse(c, err)
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
		helpers.ServerErrorResponse(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": sheet})
}
