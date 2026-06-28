package transport

import (
	"net/http"
	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/services"
	"strconv"

	"github.com/gin-gonic/gin"
)

type IPlayerHandler interface {
	GetPlayers(c *gin.Context)
	GetPlayerByID(c *gin.Context)
	CreatePlayer(c *gin.Context)
	UpdatePlayer(c *gin.Context)
	DeletePlayer(c *gin.Context)
}

type PlayerHandler struct {
	service services.IPlayerService
}

func NewPlayerHandler(service services.IPlayerService) IPlayerHandler {
	return &PlayerHandler{service: service}
}

// GetPlayers godoc
// @Summary      Get players (paginated, optionally filtered by team or search)
// @Tags         players
// @Param        team_id query string false "Team ID"
// @Param        search  query string false "Search by name or position"
// @Param        page    query int    false "Page number (default 1)"
// @Param        limit   query int    false "Page size (default 20, no upper cap)"
// @Produce      json
// @Success      200 {object} dto.PaginatedResult[dto.PlayerResponse]
// @Router       /api/v1/players [get]
func (h *PlayerHandler) GetPlayers(c *gin.Context) {
	teamID := c.Query("team_id")
	searchTerm := c.Query("search")

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}
	// limit defaults to 20 when missing or invalid; callers (admin/team-sheet pickers)
	// can pass higher values explicitly and the backend will respect them.
	limit, err := strconv.Atoi(c.Query("limit"))
	if err != nil || limit <= 0 {
		limit = 20
	}

	result, err := h.service.GetPlayers(c.Request.Context(), teamID, searchTerm, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

// GetPlayerByID godoc
// @Summary      Get a single player by ID
// @Tags         players
// @Param        id path string true "Player ID"
// @Produce      json
// @Success      200  {object} map[string]string
// @Router       /api/v1/players/{id} [get]
func (h *PlayerHandler) GetPlayerByID(c *gin.Context) {
	id := c.Param("id")

	player, err := h.service.GetPlayerByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Player not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": player})
}

// CreatePlayer godoc
// @Summary      Create a player
// @Tags         players
// @Produce      json
// @Success      200  {object}  map[string]string
// @Router       /api/v1/players [post]
// scopedTeamID returns the team_id a team_head is restricted to, set by
// TeamHeadOrAdminMiddleware. ok is false for admins (full, unscoped access).
// Key mirrors middlewares.TeamIDContextKey ("team_manager_team_id"); kept as a
// literal here to avoid a transport->middlewares import.
func scopedTeamID(c *gin.Context) (string, bool) {
	v, exists := c.Get("team_manager_team_id")
	if !exists {
		return "", false
	}
	s, ok := v.(string)
	return s, ok && s != ""
}

// ensureOwnsPlayer enforces that a scoped team_head only touches players on
// their own team. Returns false (and writes a 403/404) when access is denied;
// returns true for admins or when the player belongs to the caller's team.
func (h *PlayerHandler) ensureOwnsPlayer(c *gin.Context, playerID string) bool {
	scopedTeam, ok := scopedTeamID(c)
	if !ok {
		return true // admin / unscoped
	}
	existing, err := h.service.GetPlayerByID(c.Request.Context(), playerID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "player not found"})
		return false
	}
	if existing.Team == nil || existing.Team.ID != scopedTeam {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden: player belongs to another team"})
		return false
	}
	return true
}

func (h *PlayerHandler) CreatePlayer(c *gin.Context) {
	var req dto.CreatePlayerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	player := &domain.Player{
		Name:         req.Name,
		JerseyNumber: req.JerseyNumber,
		Position:     req.Position,
		TeamID:       req.TeamID,
		Bio:          req.Bio,
		Image:        req.Image,
		Email:        req.Email,
	}

	// A team_head may only create players on their own team — force the team_id
	// from the scoped context so they can't seed players onto another team.
	if scopedTeam, ok := scopedTeamID(c); ok {
		player.TeamID = scopedTeam
	}

	if err := h.service.CreatePlayer(c.Request.Context(), player); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "Player created", "id": player.ID})
}

// UpdatePlayer godoc
// @Summary      Update a player
// @Tags         players
// @Produce      json
// @Param        id path string true "Player ID"
// @Param        request body dto.UpdatePlayerRequest true "Player update request"
// @Success      200  {object}  map[string]string
// @Router       /api/v1/players/{id} [put]
func (h *PlayerHandler) UpdatePlayer(c *gin.Context) {
	id := c.Param("id")
	var req dto.UpdatePlayerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// A team_head may only edit their own team's players, and cannot reassign
	// a player to a different team.
	if !h.ensureOwnsPlayer(c, id) {
		return
	}
	if scopedTeam, ok := scopedTeamID(c); ok {
		req.TeamID = scopedTeam
	}

	player := &domain.Player{
		ID:       id,
		Name:     req.Name,
		Position: req.Position,
		TeamID:   req.TeamID,
		Bio:      req.Bio,
		Image:    req.Image,
		Email:    req.Email,
	}

	if req.JerseyNumber != nil {
		player.JerseyNumber = *req.JerseyNumber
	}

	if err := h.service.UpdatePlayer(c.Request.Context(), player); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Player updated"})
}

// DeletePlayer godoc
// @Summary      Delete a player
// @Tags         players
// @Produce      json
// @Param        id path string true "Player ID"
// @Success      200  {object}  map[string]string
// @Router       /api/v1/players/{id} [delete]
func (h *PlayerHandler) DeletePlayer(c *gin.Context) {
	id := c.Param("id")
	if !h.ensureOwnsPlayer(c, id) {
		return
	}
	if err := h.service.DeletePlayer(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Player deleted"})
}
