package transport

import (
	"fmt"
	"net/http"
	"pkg-common/helpers"
	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
	"showtime-backend/internal/services"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

type IPlayerHandler interface {
	GetPlayers(c *gin.Context)
	GetPlayerByID(c *gin.Context)
	CreatePlayer(c *gin.Context)
	UpdatePlayer(c *gin.Context)
	DeletePlayer(c *gin.Context)
	AssignRandomJerseyNumbers(c *gin.Context)
}

type PlayerHandler struct {
	service         services.IPlayerService
	contractService services.IContractService
	authRepo        ports.IAuthRepository
}

func NewPlayerHandler(service services.IPlayerService, contractService services.IContractService, authRepo ports.IAuthRepository) IPlayerHandler {
	return &PlayerHandler{service: service, contractService: contractService, authRepo: authRepo}
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

	// Auto-provision user account if email provided and user doesn't exist
	if player.Email != "" && h.authRepo != nil {
		cleanEmail := strings.ToLower(strings.TrimSpace(player.Email))
		user, _ := h.authRepo.GetUserByEmail(c.Request.Context(), cleanEmail)
		if user != nil {
			if user.Role == "user" {
				_ = h.authRepo.UpdateUserRole(c.Request.Context(), user.ID, "player")
			}
			player.UserID = &user.ID
		} else {
			defaultPass := "NoPassword@123"
			newUser := domain.User{
				FullName: player.Name,
				Email:    cleanEmail,
				Role:     "player",
			}
			_ = newUser.Password.Set(&defaultPass)
			newID, err := h.authRepo.Register(c.Request.Context(), newUser)
			if err == nil && newID != nil {
				player.UserID = newID
			}
		}
	}

	if err := h.service.CreatePlayer(c.Request.Context(), player); err != nil {
		if strings.Contains(err.Error(), "already exists") {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Give the new player their initial ACTIVE contract. IssueContract is not used
	// here: it is gated on an open transfer window and creates a PENDING offer, but
	// onboarding is neither a transfer nor a free-agent signing, and a brand-new player
	// has no account with which to accept an offer. Provisioning it ACTIVE is what
	// keeps them visible to the roster locks and team-sheet dropdowns.
	contractWarning := ""
	if player.TeamID != "" && h.contractService != nil {
		managerUserID := ""
		payload, err := helpers.GetTokenPayloadFromContext(c)
		if err == nil && payload != nil {
			managerUserID = payload.UserId
		}

		if err := h.contractService.ProvisionInitialContract(c.Request.Context(), player.ID, player.TeamID, managerUserID, req.ContractLength); err != nil {
			// The player exists but is rostered without a contract — the exact
			// divergence the old auto-provisioning backfill was hiding. Surface it
			// rather than swallowing it.
			contractWarning = fmt.Sprintf("player was created but their initial contract could not be issued: %v", err)
			fmt.Printf("player %s: %s\n", player.ID, contractWarning)
		}
	}

	res := gin.H{"message": "Player created with an active contract", "id": player.ID}
	if contractWarning != "" {
		res["message"] = "Player created"
		res["warning"] = contractWarning
	}
	c.JSON(http.StatusCreated, res)
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
		if strings.Contains(err.Error(), "already exists") {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
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

func (h *PlayerHandler) AssignRandomJerseyNumbers(c *gin.Context) {
	teamID := c.Query("team_id")
	if scopedTeam, ok := scopedTeamID(c); ok {
		teamID = scopedTeam
	}

	count, err := h.service.AssignRandomJerseyNumbers(c.Request.Context(), teamID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Random jersey numbers assigned", "assigned_count": count})
}
