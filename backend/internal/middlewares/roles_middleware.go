package middlewares

import (
	"net/http"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// UserRoleContextKey holds the caller's resolved role, so a handler serving several
// roles can narrow what each one is permitted to do without re-reading the profile.
const UserRoleContextKey = "user_role"

// RolesAllowedMiddleware checks the user's role is one of the listed fixed roles
// (player, for the player portal). Admin-panel access is not decided here: it
// goes through FeatureAccessMiddleware, where the roles table says who may.
func RolesAllowedMiddleware(roleSvc services.IRoleService, allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		access, ok := resolveAccess(c, roleSvc)
		if !ok {
			return
		}

		// app_admin is the superuser and is allowed on every role-gated route
		if access.Role == "app_admin" {
			c.Next()
			return
		}

		for _, role := range allowedRoles {
			if access.Role == role {
				c.Next()
				return
			}
		}

		c.JSON(http.StatusForbidden, gin.H{
			"error":   "forbidden: insufficient privileges",
			"details": "user does not have the required role to access this route",
		})
		c.Abort()
	}
}
