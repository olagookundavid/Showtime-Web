package commonAuth

import (
	"bufio"
	"encoding/base64"
	"encoding/json"
	"expvar"
	"fmt"
	"hash/fnv"
	"net"
	"net/http"
	"pkg-common/token"
	"strconv"
	"strings"
	"sync"
	"time"

	"pkg-common/helpers"

	"github.com/gin-gonic/gin"
	"github.com/tomasen/realip"
	"tailscale.com/tstime/rate"
)

const (
	authorizationHeaderKey  = "authorization"
	authorizationTypeBearer = "bearer"
	authorizationPayloadKey = "authorization_payload"
	authorizationCookieKey  = "access_token"
)

func RecoverPanic() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			// Use the recover function to check if there has been a panic or not.
			if err := recover(); err != nil {
				c.Writer.Header().Set("Connection", "close")
				helpers.ServerErrorResponse(c, fmt.Errorf("%s", err))
			}
		}()
		c.Next()
	}
}

type RateLimitStruct struct {
	LimiterEnabled bool
	Rps            int
	Burst          int
}

func RateLimit(rls RateLimitStruct) gin.HandlerFunc {
	type client struct {
		limiter  *rate.Limiter
		lastSeen time.Time
	}
	var (
		mu      sync.Mutex
		clients = make(map[string]*client)
	)

	// Background cleanup goroutine
	go func() {
		for {
			time.Sleep(time.Minute)
			mu.Lock()
			for ip, client := range clients {
				if time.Since(client.lastSeen) > 3*time.Minute {
					delete(clients, ip)
				}
			}
			mu.Unlock()
		}
	}()

	return func(c *gin.Context) {
		if !rls.LimiterEnabled {
			c.Next()
			return
		}

		ip := realip.FromRequest(c.Request)
		mu.Lock()

		// Initialize or get existing limiter for this IP
		if _, found := clients[ip]; !found {
			clients[ip] = &client{
				limiter: rate.NewLimiter(
					rate.Limit(rls.Rps),
					rls.Burst),
			}
		}
		clients[ip].lastSeen = time.Now()

		if !clients[ip].limiter.Allow() {
			mu.Unlock()
			helpers.RateLimitExceededResponse(c)
			c.Abort()
			return
		}

		mu.Unlock()
		c.Next()
	}
}

// AuthMiddleware creates a gin middleware for authorization
func TokenMiddleware(tokenMaker token.Maker) gin.HandlerFunc {
	return func(c *gin.Context) {
		var accessToken string

		//Try to get token from cookie (web-first)
		cookie, err := c.Request.Cookie(authorizationCookieKey)
		if err == nil && cookie.Value != "" {
			accessToken = cookie.Value
		}

		//Fallback to Authorization header (mobile/API clients)
		if accessToken == "" {
			authHeader := c.GetHeader(authorizationHeaderKey)
			if len(authHeader) > 0 {
				fields := strings.Fields(authHeader)
				if len(fields) == 2 && strings.ToLower(fields[0]) == authorizationTypeBearer {
					accessToken = fields[1]
				}
			}
		}

		if accessToken == "" {
			helpers.UnAuthorizedResponse(c, "access token is missing")
			c.Abort()
			return
		}

		//Verify the token
		payload, err := tokenMaker.VerifyToken(accessToken)
		if err != nil {
			helpers.UnAuthorizedResponse(c, err.Error())
			c.Abort()
			return
		}

		//Save payload in context
		c.Set(authorizationPayloadKey, payload)
		c.Next()
	}
}

type DeviceInfo struct {
	DeviceID   string `json:"did"`
	DeviceType string `json:"dt"`
	Client     string `json:"c"`
}

func GetDeviceInfo(c *gin.Context) *DeviceInfo {
	deviceInfo, _ := c.Get("device_info")
	return deviceInfo.(*DeviceInfo)
}

func DeviceMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {

		deviceInfo := getDeviceInfoFromHeaders(c)
		c.Set("device_info", deviceInfo)
		c.Next()
	}
}
func getDeviceInfoFromHeaders(c *gin.Context) *DeviceInfo {
	xDeviceId := "X-Device-ID"
	xDeviceType := "X-Device-Type"
	xClient := "X-Client"
	userAgent := "User-Agent"
	headers := map[string]string{
		xDeviceId:   c.GetHeader(xDeviceId),
		xDeviceType: c.GetHeader(xDeviceType),
		xClient:     c.GetHeader(xClient),
		userAgent:   c.GetHeader(userAgent),
	}
	deviceID := headers["X-Device-ID"]
	deviceType := headers["X-Device-Type"]
	client := headers["X-Client"]

	// Generate fallback device ID if not provided
	if deviceID == "" {
		userAgent := headers[userAgent]
		deviceID = generateFallbackDeviceID(userAgent)
	}

	if deviceType == "" {
		deviceType = "unknown"
	}
	if client == "" {
		client = "unknown"
	}

	return &DeviceInfo{
		DeviceID:   deviceID,
		DeviceType: deviceType,
		Client:     client,
	}
}

func generateFallbackDeviceID(userAgent string) string {
	// Simple hash of user agent for fallback
	h := fnv.New32a()
	h.Write([]byte(userAgent))
	return fmt.Sprintf("web_%x", h.Sum32())
}

func EncodeOAuthState(deviceInfo *DeviceInfo) (string, error) {
	state := DeviceInfo{
		DeviceID:   deviceInfo.DeviceID,
		DeviceType: deviceInfo.DeviceType,
		Client:     deviceInfo.Client,
	}

	data, err := json.Marshal(state)
	if err != nil {
		return "", err
	}

	return base64.URLEncoding.EncodeToString(data), nil
}

func DecodeOAuthState(encoded string) (*DeviceInfo, error) {
	if encoded == "" {
		return nil, nil
	}

	data, err := base64.URLEncoding.DecodeString(encoded)
	if err != nil {
		return nil, err
	}

	var state DeviceInfo
	if err := json.Unmarshal(data, &state); err != nil {
		return nil, err
	}

	return &state, nil
}

func Metrics() gin.HandlerFunc {
	var (
		totalRequestsReceived           = expvar.NewInt("total_requests_received")
		totalResponsesSent              = expvar.NewInt("total_responses_sent")
		totalProcessingTimeMicroseconds = expvar.NewInt("total_processing_time_μs")
		totalResponsesSentByStatus      = expvar.NewMap("total_responses_sent_by_status")
	)
	// The following code will be run for every request...
	return func(c *gin.Context) {
		// Record the time that we started to process the request.
		start := time.Now()
		totalRequestsReceived.Add(1)
		mw := &metricsResponseWriter{ResponseWriter: c.Writer}
		c.Writer = mw

		c.Next()

		totalResponsesSent.Add(1)
		totalResponsesSentByStatus.Add(strconv.Itoa(mw.statusCode), 1)
		duration := time.Since(start).Microseconds()
		totalProcessingTimeMicroseconds.Add(duration)
	}

}

type metricsResponseWriter struct {
	gin.ResponseWriter
	statusCode    int
	headerWritten bool
}

// Override `WriteHeader` to track status code
func (mw *metricsResponseWriter) WriteHeader(statusCode int) {
	if !mw.headerWritten {
		mw.statusCode = statusCode
		mw.headerWritten = true
	}
	mw.ResponseWriter.WriteHeader(statusCode)
}

// Override `Write` to track response body writes
func (mw *metricsResponseWriter) Write(b []byte) (int, error) {
	if !mw.headerWritten {
		mw.statusCode = http.StatusOK
		mw.headerWritten = true
	}
	return mw.ResponseWriter.Write(b)
}

// Implement `Unwrap()` to return the underlying writer
func (mw *metricsResponseWriter) Unwrap() http.ResponseWriter {
	return mw.ResponseWriter
}

// Implement `Flush()`, `Hijack()`, and `CloseNotify()` for full compatibility

func (mw *metricsResponseWriter) Flush() {
	if flusher, ok := mw.ResponseWriter.(http.Flusher); ok {
		flusher.Flush()
	}
}

func (mw *metricsResponseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	if hijacker, ok := mw.ResponseWriter.(http.Hijacker); ok {
		return hijacker.Hijack()
	}
	return nil, nil, http.ErrNotSupported
}

func (mw *metricsResponseWriter) CloseNotify() <-chan bool {
	if notifier, ok := mw.ResponseWriter.(http.CloseNotifier); ok {
		return notifier.CloseNotify()
	}
	return nil
}

func WrapHTTPHandler(h http.Handler) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Convert gin.Context to http.Request and ResponseWriter
		h.ServeHTTP(c.Writer, c.Request)
	}
}

//Later
/*


  cookie, err := c.Request.Cookie("refresh_token")
    if err != nil {
        helpers.UnAuthorizedResponse(c, "refresh token missing")
        return
    }

    refreshToken := cookie.Value

    // Verify refresh token
    payload, err := tokenMaker.VerifyToken(refreshToken)
    if err != nil {
        helpers.UnAuthorizedResponse(c, "invalid refresh token")
        return
    }

    // Check if refresh token exists in database (not revoked)
    if !isRefreshTokenValid(payload.UserID, refreshToken) {
        helpers.UnAuthorizedResponse(c, "refresh token revoked")
        return
    }

    // Generate new access token
    newAccessToken, err := tokenMaker.CreateToken(payload.UserID, 15*time.Minute)
    if err != nil {
        helpers.InternalServerErrorResponse(c, err.Error())
        return
    }

    // Set new access token cookie
    http.SetCookie(c.Writer, &http.Cookie{
        Name:     "access_token",
        Value:    newAccessToken,
        Path:     "/",
        HttpOnly: true,
        Secure:   true,
        SameSite: http.SameSiteLaxMode,
        MaxAge:   900, // 15 minutes
    })



CREATE TABLE refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);

func Logout(c *gin.Context) {
    // Get refresh token
    cookie, err := c.Request.Cookie("refresh_token")
    if err == nil {
        // Revoke refresh token in database
        revokeRefreshToken(cookie.Value)
    }

    // Delete both cookies
    http.SetCookie(c.Writer, &http.Cookie{
        Name:   "access_token",
        Value:  "",
        Path:   "/",
        MaxAge: -1, // Delete immediately
    })

    http.SetCookie(c.Writer, &http.Cookie{
        Name:   "refresh_token",
        Value:  "",
        Path:   "/auth/refresh",
        MaxAge: -1, // Delete immediately
    })

    c.JSON(http.StatusOK, gin.H{"message": "logged out"})
}
*/
