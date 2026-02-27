package middlewares

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"pkg-common/helpers"
	"showtime-backend/internal/services"
	"time"

	"github.com/gin-gonic/gin"
)

type bodyLogWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (w bodyLogWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

func AuditLoggerMiddleware(auditService services.IAuditService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Only log modifying requests
		if c.Request.Method == http.MethodGet || c.Request.Method == http.MethodOptions {
			c.Next()
			return
		}

		// Read request body non-destructively
		var bodyBytes []byte
		if c.Request.Body != nil {
			bodyBytes, _ = io.ReadAll(c.Request.Body)
			c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
		}

		// Setup response writer interceptor
		blw := &bodyLogWriter{body: bytes.NewBufferString(""), ResponseWriter: c.Writer}
		c.Writer = blw

		startTime := time.Now()

		// Execute actual handler and inner middlewares
		c.Next()

		duration := time.Since(startTime).Milliseconds()

		// If it's a modifying request and completed, fetch any auth payload attached down the line
		action := c.Request.Method
		entityType := c.Request.URL.Path

		var userID *string
		payload, err := helpers.GetTokenPayloadFromContext(c)
		if err == nil && payload != nil {
			idStr := payload.UserId
			userID = &idStr
		}

		detailsMap := map[string]interface{}{
			"status_code": c.Writer.Status(),
			"duration_ms": duration,
			"ip":          c.ClientIP(),
			"user_agent":  c.Request.UserAgent(),
		}

		if len(bodyBytes) > 0 {
			var parsedBody map[string]interface{}
			if json.Unmarshal(bodyBytes, &parsedBody) == nil {
				// Hide sensitive fields
				delete(parsedBody, "password")
				delete(parsedBody, "password_hash")
				delete(parsedBody, "new_password")
				detailsMap["request_body"] = parsedBody
			}
		}

		detailsJSON, _ := json.Marshal(detailsMap)
		detailsStr := string(detailsJSON)

		// Fast background push to the audit service channel
		auditService.LogAction(userID, action, entityType, nil, &detailsStr)
	}
}
