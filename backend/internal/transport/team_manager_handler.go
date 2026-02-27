package transport

import (
	"net/http"
	"pkg-common/helpers"
	"showtime-backend/internal/middlewares"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type ITeamManagerHandler interface {
	AssignManager(c *gin.Context)
	RemoveManager(c *gin.Context)
	GetManagersForTeam(c *gin.Context)
	GetMyTeam(c *gin.Context)
}

type TeamManagerHandler struct {
	service      services.ITeamManagerService
	matchService services.IMatchService
}

func NewTeamManagerHandler(service services.ITeamManagerService, matchService services.IMatchService) ITeamManagerHandler {
	return &TeamManagerHandler{service: service, matchService: matchService}
}

// AssignManager godoc
// @Summary      Assign a user as team manager
// @Tags         admin
// @Accept       json
// @Produce      json
// @Param        id path string true "Team ID"
// @Param        request body object true "Assign Manager" SchemaExample({"user_id": "uuid"})
// @Success      200 {object} map[string]string
// @Router       /api/v1/admin/teams/{id}/manager [post]
func (h *TeamManagerHandler) AssignManager(c *gin.Context) {
	teamID := c.Param("id")
	var req struct {
		UserID string `json:"user_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.AssignManager(c.Request.Context(), req.UserID, teamID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Manager assigned successfully"})
}

// RemoveManager godoc
// @Summary      Remove a team manager
// @Tags         admin
// @Produce      json
// @Param        id path string true "Team ID"
// @Param        user_id path string true "User ID"
// @Success      200 {object} map[string]string
// @Router       /api/v1/admin/teams/{id}/manager/{user_id} [delete]
func (h *TeamManagerHandler) RemoveManager(c *gin.Context) {
	userID := c.Param("user_id")

	if err := h.service.RemoveManager(c.Request.Context(), userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Manager removed successfully"})
}

// GetManagersForTeam godoc
// @Summary      Get managers for a team
// @Tags         admin
// @Produce      json
// @Param        id path string true "Team ID"
// @Success      200 {object} map[string]string
// @Router       /api/v1/admin/teams/{id}/managers [get]
func (h *TeamManagerHandler) GetManagersForTeam(c *gin.Context) {
	teamID := c.Param("id")

	managers, err := h.service.GetManagersByTeamID(c.Request.Context(), teamID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": managers})
}

// GetMyTeam godoc
// @Summary      Get the team assigned to the current team_head user
// @Tags         team-head
// @Produce      json
// @Success      200 {object} map[string]string
// @Router       /api/v1/team-head/my-team [get]
func (h *TeamManagerHandler) GetMyTeam(c *gin.Context) {
	// For team_heads, the middleware injects team_id. For admins, we look it up.
	teamID, exists := c.Get(middlewares.TeamIDContextKey)
	if !exists {
		// Admin user — look up via token
		payload, err := helpers.GetTokenPayloadFromContext(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		tm, err := h.service.GetManagerByUserID(c.Request.Context(), payload.UserId)
		if err != nil || tm == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "no team assigned"})
			return
		}
		teamID = tm.TeamID
	}

	teams, err := h.matchService.GetAllTeams(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	for _, t := range teams {
		if t.ID == teamID.(string) {
			c.JSON(http.StatusOK, gin.H{"data": t})
			return
		}
	}
	c.JSON(http.StatusNotFound, gin.H{"error": "team not found"})
}
