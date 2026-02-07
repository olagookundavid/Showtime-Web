package helpers

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"

	"showtime-backend/internal/dto"

	"github.com/gin-gonic/gin"
)

func SetTokensInCookie(c *gin.Context, authUser *dto.LoginResponse) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "project_admin_access",
		Value:    authUser.AccessToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   true, // for HTTPS only
		SameSite: http.SameSiteLaxMode,
	})

	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "project_admin_refresh",
		Value:    authUser.RefreshToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	})
}

func GenerateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
