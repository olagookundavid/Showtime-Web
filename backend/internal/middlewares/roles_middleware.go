package middlewares

import (
	"net/http"
	"pkg-common/helpers"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// UserRoleContextKey holds the caller's resolved role, so a handler serving several
// roles can narrow what each one is permitted to do without re-reading the profile.
const UserRoleContextKey = "user_role"

// RolesAllowedMiddleware checks if the user's role is in the list of allowed roles.
func RolesAllowedMiddleware(authService services.IAuthService, allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		payload, err := helpers.GetTokenPayloadFromContext(c)
		if err != nil || payload == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized", "details": err.Error()})
			c.Abort()
			return
		}

		userProfile, err := authService.ReturnUserProfile(c.Request.Context(), payload.UserId)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found", "details": err.Error()})
			c.Abort()
			return
		}

		c.Set(UserRoleContextKey, userProfile.UserType)

		// app_admin is the superuser and is allowed on every role-gated route
		if userProfile.UserType == "app_admin" {
			c.Next()
			return
		}

		isAllowed := false
		for _, role := range allowedRoles {
			if userProfile.UserType == role {
				isAllowed = true
				break
			}
		}

		if !isAllowed {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "forbidden: insufficient privileges",
				"details": "user does not have the required role to access this route",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
