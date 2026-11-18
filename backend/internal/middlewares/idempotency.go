package middlewares

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"log"
	"net/http"
	"regexp"
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"

	"pkg-common/helpers"

	"showtime-backend/internal/ports"
)

// IdempotencyKeyHeader is the request header carrying the client's key.
const IdempotencyKeyHeader = "Idempotency-Key"

const (
	// idempotencyLease is how long a running request holds its key before a retry
	// may treat it as abandoned. Far longer than any of these requests take.
	idempotencyLease = 2 * time.Minute
	// idempotencyMaxAge is how long keys are kept.
	idempotencyMaxAge = 24 * time.Hour
	// maxIdempotentBody caps the request body read for hashing.
	maxIdempotentBody = 1 << 20
)

var idempotencyKeyPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{16,128}$`)

// IdempotencyStore is what the middleware needs; ports.IdempotencyRepository
// is the real one.
type IdempotencyStore interface {
	Claim(ctx context.Context, userID, scope, key, requestHash string, lease time.Duration) (*ports.IdempotencyRecord, bool, error)
	Complete(ctx context.Context, userID, scope, key string, status int, body []byte, contentType string) error
	Release(ctx context.Context, userID, scope, key string) error
	Purge(ctx context.Context, maxAge time.Duration) error
}

// Idempotency makes a signed-in request that carries an Idempotency-Key happen
// at most once. The first request with a key runs; a repeat of it while it is
// still running is refused with 409, and a repeat after it succeeded gets the
// same response back without running again. A request that did not succeed
// frees its key, since nothing happened and a retry is safe. Reusing a key for a
// different request is refused with 422.
//
// Requests without the header, or from guests, pass straight through. It must
// sit after the token middleware so the user is known.
func Idempotency(store IdempotencyStore) gin.HandlerFunc {
	var claims atomic.Uint64
	return func(c *gin.Context) {
		key := c.GetHeader(IdempotencyKeyHeader)
		if key == "" {
			c.Next()
			return
		}
		payload, err := helpers.GetTokenPayloadFromContext(c)
		if err != nil || payload == nil || payload.UserId == "" {
			c.Next()
			return
		}
		if !idempotencyKeyPattern.MatchString(key) {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
				"error": "The Idempotency-Key header must be 16 to 128 letters, digits, - or _.",
				"code":  "BAD_IDEMPOTENCY_KEY",
			})
			return
		}

		body, err := io.ReadAll(io.LimitReader(c.Request.Body, maxIdempotentBody+1))
		if err != nil || len(body) > maxIdempotentBody {
			c.AbortWithStatusJSON(http.StatusRequestEntityTooLarge, gin.H{"error": "Request body is too large."})
			return
		}
		c.Request.Body = io.NopCloser(bytes.NewReader(body))

		scope := c.Request.Method + " " + c.FullPath()
		sum := sha256.Sum256(append([]byte(scope+"\n"), body...))
		hash := hex.EncodeToString(sum[:])
		userID := payload.UserId

		rec, claimed, err := store.Claim(c.Request.Context(), userID, scope, key, hash, idempotencyLease)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
				"error": "We couldn't start this request safely. Please try again.",
			})
			return
		}
		if !claimed {
			switch {
			case rec.RequestHash != hash:
				c.AbortWithStatusJSON(http.StatusUnprocessableEntity, gin.H{
					"error": "This request key was already used for a different request. Please try again.",
					"code":  "IDEMPOTENCY_KEY_REUSED",
				})
			case rec.StatusCode == nil:
				c.AbortWithStatusJSON(http.StatusConflict, gin.H{
					"error": "This request is already being processed. Please wait a moment.",
					"code":  "REQUEST_IN_PROGRESS",
				})
			default:
				contentType := rec.ContentType
				if contentType == "" {
					contentType = "application/json; charset=utf-8"
				}
				c.Header("Idempotent-Replayed", "true")
				c.Data(*rec.StatusCode, contentType, rec.Body)
				c.Abort()
			}
			return
		}

		if claims.Add(1)%500 == 0 {
			go func() {
				if err := store.Purge(context.Background(), idempotencyMaxAge); err != nil {
					log.Printf("idempotency: purge failed: %v", err)
				}
			}()
		}

		rec2 := &capturingWriter{ResponseWriter: c.Writer}
		c.Writer = rec2
		// Bookkeeping must happen even if the client hangs up or the handler panics.
		done := context.WithoutCancel(c.Request.Context())
		finished := false
		defer func() {
			if finished {
				return
			}
			if err := store.Release(done, userID, scope, key); err != nil {
				log.Printf("idempotency: release %s failed: %v", scope, err)
			}
		}()

		c.Next()

		status := rec2.Status()
		if status >= 200 && status < 300 {
			var err error
			for attempt := 0; attempt < 3; attempt++ {
				if err = store.Complete(done, userID, scope, key, status, rec2.body.Bytes(), rec2.Header().Get("Content-Type")); err == nil {
					break
				}
				time.Sleep(time.Duration(attempt+1) * 100 * time.Millisecond)
			}
			if err != nil {
				// The request succeeded; the claim is never released for a second
				// run. Repeats are refused as in progress until its lease runs out.
				log.Printf("idempotency: complete %s failed: %v", scope, err)
			}
			finished = true
		}
	}
}

// capturingWriter keeps a copy of the response body for replay.
type capturingWriter struct {
	gin.ResponseWriter
	body bytes.Buffer
}

func (w *capturingWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

func (w *capturingWriter) WriteString(s string) (int, error) {
	w.body.WriteString(s)
	return w.ResponseWriter.WriteString(s)
}
