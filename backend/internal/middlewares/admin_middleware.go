package middlewares

import (
	"net/http"
	"pkg-common/helpers"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

func AdminOnlyMiddleware(authService services.IAuthService) gin.HandlerFunc {
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

		if userProfile.UserType != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden: requires admin privileges", "details": "user is not an admin"})
			c.Abort()
			return
		}

		c.Next()
	}
}
