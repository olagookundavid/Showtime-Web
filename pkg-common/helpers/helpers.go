package helpers

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"pkg-common/logger"
	"pkg-common/token"
	"strconv"
	"strings"

	"pkg-common/vcs"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

const authorizationPayloadKey = "authorization_payload"

func InternalServerErrorHandler(c *gin.Context, recovered any) {
	var errMessage string

	// If the recovered value is a string, treat it as an error message.
	if err, ok := recovered.(string); ok {
		errMessage = err
	} else {
		errMessage = "unknown error"
	}
	devErr := errors.New(errMessage)
	ServerErrorResponse(c, devErr)
}

func NotFoundResponse(c *gin.Context) {

	errorResponse(c, http.StatusNotFound, "Resource not found")
}

func NotFoundResponseWithMsg(c *gin.Context, msg string) {
	errorResponse(c, http.StatusNotFound, msg)

}

func MethodNotAllowedResponse(c *gin.Context) {
	errorResponse(c, http.StatusTooManyRequests, "Method not allowed")
}

func RateLimitExceededResponse(c *gin.Context) {
	message := "rate limit exceeded"
	errorResponse(c, http.StatusTooManyRequests, message)
}

func UnAuthorizedResponse(c *gin.Context, msg string) {
	errorResponse(c, http.StatusUnauthorized, msg)
}

func BadResponse(c *gin.Context, msg string) {
	errorResponse(c, http.StatusBadRequest, msg)
}

func logError(msg string, data map[string]any) {
	logger := logger.GetSingletonLogger()

	logger.Error(msg, data)
}

func errorResponse(c *gin.Context, status int, message string) {
	logError(message, nil)
	responseBody := Response{
		Status:  false,
		Message: message,
	}
	c.JSON(status, responseBody)
}

func RegisterErrorWithStatusResponse(c *gin.Context, err error, status bool) {
	responseBody := Response{
		Status:  false,
		Message: err.Error(),
		Data: map[string]bool{
			"is_verified": status,
		},
	}
	c.JSON(http.StatusBadRequest, responseBody)
}

func ServerErrorResponse(c *gin.Context, err error) {
	message := "Internal server error"
	logError(err.Error(), nil)

	responseBody := Response{
		Status:   false,
		Message:  message,
		DevError: err.Error(),
	}
	c.JSON(http.StatusInternalServerError, responseBody)
}

func EditConflictResponse(c *gin.Context) {
	message := "unable to update the record due to an edit conflict, please try again"
	errorResponse(c, http.StatusConflict, message)
}

type Response struct {
	Status   bool   `json:"status"`
	Message  string `json:"message,omitempty"`
	Data     any    `json:"data,omitempty"`
	DevError string `json:"dev_error,omitempty"`
}

func successResponse(c *gin.Context, statusCode int, message string, data any) {
	responseBody := Response{
		Status:  true,
		Message: message,
		Data:    data,
	}

	c.JSON(statusCode, responseBody)
}

func SuccessOK(c *gin.Context, message string, data any) {
	successResponse(c, http.StatusOK, message, data)
}

func SuccessCreated(c *gin.Context, message string, data any) {
	successResponse(c, http.StatusCreated, message, data)
}

func GetTokenPayloadFromContext(c *gin.Context) (*token.Payload, error) {
	payload, ok := c.Get(authorizationPayloadKey)
	if !ok {
		return nil, fmt.Errorf("authorization payload not retrieved successful")
	}
	return payload.(*token.Payload), nil
}

func GetAdminPayloadFromContext(c *gin.Context) ([]string, string, error) {
	userId, ok := c.Get("userId")
	if !ok {
		return nil, "", fmt.Errorf("authorization not retrieved successful")
	}
	roles, ok := c.Get("roles")
	if !ok {
		return nil, "", fmt.Errorf("authorization not retrieved successful")
	}
	return roles.([]string), userId.(string), nil
}

func BackgroundFunc(fn func()) {
	go func() {
		// Recover any panic.
		defer func() {
			if err := recover(); err != nil {
				logger.GetSingletonLogger().Info(fmt.Sprintf("%s", err), nil)
			}
		}()
		fn()
	}()
}

func BackgroundFuncWithContext(ctx context.Context, fn func(context.Context)) {
	go func() {
		defer func() {
			if err := recover(); err != nil {
				logger.GetSingletonLogger().Info(fmt.Sprintf("%s", err), nil)
			}
		}()
		fn(ctx)
	}()
}

var sem = make(chan struct{}, 100) // max 100 concurrent

func BackgroundFuncWithBound(fn func()) {
	go func() {
		sem <- struct{}{}        // acquire
		defer func() { <-sem }() // release

		defer func() {
			if err := recover(); err != nil {
				logger.GetSingletonLogger().Info(fmt.Sprintf("%s", err), nil)
			}
		}()
		fn()
	}()
}

func GenerateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// HealthcheckHandler godoc
// @Summary      Show the status of the server
// @Description  Get basic health and environment information
// @Tags         health
// @Accept       json
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Router       /api/v1/admin/healthcheck [get]
func HealthcheckHandler(env string) gin.HandlerFunc {
	return func(c *gin.Context) {
		data := gin.H{
			"status": "available",
			"system_info": map[string]string{
				"environment": env,
				"version":     vcs.Version(),
			},
		}
		logger.GetSingletonLogger().Info("Health check successful", nil)
		c.JSON(http.StatusOK, data)
	}
}

type OAuthState struct {
	DeviceID   string `json:"device_id"`
	DeviceType string `json:"device_type"`
	Client     string `json:"client"`
}

func EncodeOAuthState(state *OAuthState) (string, error) {

	data, err := json.Marshal(state)
	if err != nil {
		return "", err
	}

	// URL-safe base64 encoding
	return base64.URLEncoding.EncodeToString(data), nil
}

func DecodeOAuthState(encoded string) (*OAuthState, error) {
	if encoded == "" {
		return nil, nil
	}

	data, err := base64.URLEncoding.DecodeString(encoded)
	if err != nil {
		return nil, err
	}

	var state OAuthState
	if err := json.Unmarshal(data, &state); err != nil {
		return nil, err
	}

	return &state, nil
}

func AllowLocalHost(origin string) bool {
	if os.Getenv("CORS_ALLOW_LOCALHOST") == "true" &&
		strings.HasPrefix(origin, "http://localhost:") {
		return true
	}
	return false
}

func GetEnvSlice(fallback []string) []string {
	raw := os.Getenv("CORS_ALLOW_ORIGINS")
	if raw == "" {
		return fallback
	}

	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

func GetLimitAndOffsetParams(c *gin.Context) (limit, offset int) {
	limit = 10
	offset = 0

	limitStr := c.Query("limit")
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	offsetStr := c.Query("offset")
	if offsetStr != "" {
		if o, err := strconv.Atoi(offsetStr); err == nil && o > 0 {
			offset = o
		}
	}

	return limit, offset
}

func NormalizeOrigin(origin string) string {
	origin = strings.TrimSpace(origin)
	origin = strings.TrimRight(origin, "/")
	return origin
}

func BuildCORSConfig() cors.Config {
	allowed := GetEnvSlice([]string{})

	// Normalize env origins once
	normalized := make(map[string]struct{}, len(allowed))
	for _, o := range allowed {
		normalized[NormalizeOrigin(o)] = struct{}{}
	}

	return cors.Config{
		AllowOriginFunc: func(origin string) bool {
			origin = NormalizeOrigin(origin)

			// Debug log (remove in prod)
			logger.GetSingletonLogger().Info("CORS check for: "+origin, nil)

			// 1. Exact match (production domains)
			if _, ok := normalized[origin]; ok {
				return true
			}

			// 2. Allow localhost (any port)
			if AllowLocalHost(origin) {
				return true
			}

			// 3. Allow Vercel previews
			if strings.HasSuffix(origin, ".vercel.app") {
				return true
			}

			return false
		},

		AllowMethods: []string{
			"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS",
		},
		AllowHeaders: []string{
			"Content-Type", "Authorization", "X-Requested-With",
		},
		AllowCredentials: true,

		// Keep short during dev to avoid ghost bugs
		MaxAge: 300,
	}
}
