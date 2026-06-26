package middlewares

import (
	"net/http"
	"pkg-common/helpers"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// TicketerOrAdminMiddleware allows admins (full access) or ticketers (limited access).
func TicketerOrAdminMiddleware(authService services.IAuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		payload, err := helpers.GetTokenPayloadFromContext(c)
		if err != nil || payload == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized", "details": "missing token payload"})
			c.Abort()
			return
		}

		userProfile, err := authService.ReturnUserProfile(c.Request.Context(), payload.UserId)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found", "details": err.Error()})
			c.Abort()
			return
		}

		if userProfile.UserType != "admin" && userProfile.UserType != "ticketer" && userProfile.UserType != "app_admin" {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "forbidden: requires admin or ticketer privileges",
				"details": "user role is " + userProfile.UserType,
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
