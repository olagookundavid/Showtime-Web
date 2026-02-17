package helpers

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"os"

	"showtime-backend/internal/dto"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func SetTokensInCookie(c *gin.Context, authUser *dto.LoginResponse) {
	var cookieDomain string
	mode := loadModeEnv()

	if mode {
		cookieDomain = ".dev.tradia.store"
	} else {
		cookieDomain = "localhost"
	}

	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "Showtime_AccessToken",
		Value:    authUser.AccessToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   true, // for HTTPS only
		SameSite: http.SameSiteNoneMode,
		Domain:   cookieDomain,
	})
}

func GenerateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func RemoveTokensInCookie(c *gin.Context) {
	var cookieDomain string
	mode := loadModeEnv()

	if mode {
		cookieDomain = ".dev.tradia.store"
	} else {
		cookieDomain = "localhost"
	}

	// Clear access_token cookie
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "Showtime_AccessToken",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		Domain:   cookieDomain,
		SameSite: http.SameSiteNoneMode,
		MaxAge:   -1,
	})
}

func loadModeEnv() bool {
	godotenv.Load()
	return (os.Getenv("IS_PROD")) == "true"
}
