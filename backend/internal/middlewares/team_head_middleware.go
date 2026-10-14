package middlewares

import (
	"net/http"
	"showtime-backend/internal/domain"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

const TeamIDContextKey = "team_manager_team_id"

// TeamHeadOrFeatureMiddleware allows a team_head, scoped to their own team, or
// anyone with full access to the given feature (team_portal), who can act on
// every team. If the caller is a team_head, their managed team_id is injected
// into the context.
func TeamHeadOrFeatureMiddleware(roleSvc services.IRoleService, tmService services.ITeamManagerService, featureKey string) gin.HandlerFunc {
	return func(c *gin.Context) {
		access, ok := resolveAccess(c, roleSvc)
		if !ok {
			return
		}

		// Full access to the feature (and the app_admin superuser) is unscoped.
		if access.Level(featureKey) == domain.AccessFull {
			c.Next()
			return
		}

		// Team heads get scoped access
		if access.Role == domain.RoleTeamHead {
			tm, err := tmService.GetManagerByUserID(c.Request.Context(), access.UserID)
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

		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden: requires team_head role or team portal access"})
		c.Abort()
	}
}
