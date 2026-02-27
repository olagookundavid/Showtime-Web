package middlewares

import (
	"net/http"
	"pkg-common/helpers"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

const TeamIDContextKey = "team_manager_team_id"

// TeamHeadOrAdminMiddleware allows admins (full access) or team_heads (scoped to their team).
// If the user is a team_head, their managed team_id is injected into the context.
func TeamHeadOrAdminMiddleware(authService services.IAuthService, tmService services.ITeamManagerService) gin.HandlerFunc {
	return func(c *gin.Context) {
		payload, err := helpers.GetTokenPayloadFromContext(c)
		if err != nil || payload == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			c.Abort()
			return
		}

		userProfile, err := authService.ReturnUserProfile(c.Request.Context(), payload.UserId)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
			c.Abort()
			return
		}

		// Admins get full access
		if userProfile.UserType == "admin" {
			c.Next()
			return
		}

		// Team heads get scoped access
		if userProfile.UserType == "team_head" {
			tm, err := tmService.GetManagerByUserID(c.Request.Context(), payload.UserId)
			if err != nil || tm == nil {
				c.JSON(http.StatusForbidden, gin.H{"error": "you are not assigned to any team"})
				c.Abort()
				return
			}

			// Inject team_id into context for handlers to use
			c.Set(TeamIDContextKey, tm.TeamID)
			c.Next()
			return
		}

		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden: requires admin or team_head role"})
		c.Abort()
	}
}
