package middlewares

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"pkg-common/token"

	"github.com/gin-gonic/gin"

	"showtime-backend/internal/ports"
)

// memIdempotency is an in-memory IdempotencyStore with the same rules as the
// Postgres one.
type memIdempotency struct {
	mu   sync.Mutex
	recs map[string]*memRec
}

type memRec struct {
	ports.IdempotencyRecord
	lockedUntil time.Time
}

func newMemIdempotency() *memIdempotency { return &memIdempotency{recs: map[string]*memRec{}} }

func (m *memIdempotency) Claim(_ context.Context, userID, scope, key, hash string, lease time.Duration) (*ports.IdempotencyRecord, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	k := userID + "|" + scope + "|" + key
	r, ok := m.recs[k]
	if !ok || (r.StatusCode == nil && time.Now().After(r.lockedUntil) && r.RequestHash == hash) {
		m.recs[k] = &memRec{IdempotencyRecord: ports.IdempotencyRecord{RequestHash: hash}, lockedUntil: time.Now().Add(lease)}
		return nil, true, nil
	}
	cp := r.IdempotencyRecord
	return &cp, false, nil
}

func (m *memIdempotency) Complete(_ context.Context, userID, scope, key string, status int, body []byte, ct string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	r := m.recs[userID+"|"+scope+"|"+key]
	r.StatusCode = &status
	r.Body = append([]byte(nil), body...)
	r.ContentType = ct
	return nil
}

func (m *memIdempotency) Release(_ context.Context, userID, scope, key string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	k := userID + "|" + scope + "|" + key
	if r, ok := m.recs[k]; ok && r.StatusCode == nil {
		delete(m.recs, k)
	}
	return nil
}

func (m *memIdempotency) Purge(context.Context, time.Duration) error { return nil }

// idemRig is a router whose /pay handler counts its runs. status sets what the
// handler answers; gate, when set, holds the handler until it is closed.
type idemRig struct {
	router *gin.Engine
	runs   atomic.Int32
	status atomic.Int32
	gate   chan struct{}
}

func newIdemRig(store IdempotencyStore) *idemRig {
	gin.SetMode(gin.TestMode)
	rig := &idemRig{router: gin.New()}
	rig.status.Store(http.StatusOK)
	auth := func(c *gin.Context) {
		if u := c.GetHeader("X-Test-User"); u != "" {
			c.Set("authorization_payload", &token.Payload{UserId: u, ExpiredAt: time.Now().Add(time.Hour)})
		}
	}
	rig.router.POST("/pay", auth, Idempotency(store), func(c *gin.Context) {
		n := rig.runs.Add(1)
		if rig.gate != nil {
			<-rig.gate
		}
		c.JSON(int(rig.status.Load()), gin.H{"run": n})
	})
	return rig
}

func (r *idemRig) post(user, key, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/pay", strings.NewReader(body))
	if user != "" {
		req.Header.Set("X-Test-User", user)
	}
	if key != "" {
		req.Header.Set(IdempotencyKeyHeader, key)
	}
	w := httptest.NewRecorder()
	r.router.ServeHTTP(w, req)
	return w
}

const testKey = "0123456789abcdef-key"

func TestIdempotency_RepeatReplaysTheFirstResponse(t *testing.T) {
	rig := newIdemRig(newMemIdempotency())

	first := rig.post("u1", testKey, `{"amount":100}`)
	second := rig.post("u1", testKey, `{"amount":100}`)

	if rig.runs.Load() != 1 {
		t.Fatalf("handler ran %d times, want 1", rig.runs.Load())
	}
	if second.Code != first.Code || second.Body.String() != first.Body.String() {
		t.Fatalf("replay differs: %d %q vs %d %q", second.Code, second.Body, first.Code, first.Body)
	}
	if second.Header().Get("Idempotent-Replayed") != "true" {
		t.Fatal("a replay should say so")
	}
}

func TestIdempotency_SameKeyDifferentRequestIsRefused(t *testing.T) {
	rig := newIdemRig(newMemIdempotency())
	rig.post("u1", testKey, `{"amount":100}`)

	w := rig.post("u1", testKey, `{"amount":999}`)
	if w.Code != http.StatusUnprocessableEntity || rig.runs.Load() != 1 {
		t.Fatalf("code=%d runs=%d, want 422 and 1", w.Code, rig.runs.Load())
	}
}

func TestIdempotency_FailedRequestFreesTheKey(t *testing.T) {
	rig := newIdemRig(newMemIdempotency())
	rig.status.Store(http.StatusBadRequest)
	rig.post("u1", testKey, `{}`)

	rig.status.Store(http.StatusOK)
	if w := rig.post("u1", testKey, `{}`); w.Code != http.StatusOK {
		t.Fatalf("retry after a refusal: %d", w.Code)
	}
	if rig.runs.Load() != 2 {
		t.Fatalf("a refused request must not block a retry; runs=%d", rig.runs.Load())
	}
}

func TestIdempotency_ConcurrentRepeatsRunOnce(t *testing.T) {
	rig := newIdemRig(newMemIdempotency())
	rig.gate = make(chan struct{})

	var wg sync.WaitGroup
	codes := make(chan int, 10)
	wg.Add(1)
	go func() { defer wg.Done(); codes <- rig.post("u1", testKey, `{}`).Code }()
	// Let the first claim the key before the others arrive.
	for rig.runs.Load() == 0 {
		time.Sleep(time.Millisecond)
	}
	for i := 0; i < 9; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); codes <- rig.post("u1", testKey, `{}`).Code }()
	}
	time.Sleep(20 * time.Millisecond)
	close(rig.gate)
	wg.Wait()
	close(codes)

	var ok, busy int
	for c := range codes {
		switch c {
		case http.StatusOK:
			ok++
		case http.StatusConflict:
			busy++
		default:
			t.Errorf("unexpected status %d", c)
		}
	}
	if rig.runs.Load() != 1 || ok != 1 || busy != 9 {
		t.Fatalf("runs=%d ok=%d busy=%d, want 1, 1, 9", rig.runs.Load(), ok, busy)
	}
}

func TestIdempotency_KeysAreSeparatePerUser(t *testing.T) {
	rig := newIdemRig(newMemIdempotency())
	rig.post("u1", testKey, `{}`)
	rig.post("u2", testKey, `{}`)
	if rig.runs.Load() != 2 {
		t.Fatalf("another user's key must not replay; runs=%d", rig.runs.Load())
	}
}

func TestIdempotency_PassesThroughWithoutKeyOrUser(t *testing.T) {
	rig := newIdemRig(newMemIdempotency())
	rig.post("u1", "", `{}`)
	rig.post("u1", "", `{}`)
	rig.post("", testKey, `{}`)
	rig.post("", testKey, `{}`)
	if rig.runs.Load() != 4 {
		t.Fatalf("runs=%d, want 4", rig.runs.Load())
	}
}

func TestIdempotency_MalformedKeyIsRefused(t *testing.T) {
	rig := newIdemRig(newMemIdempotency())
	for _, k := range []string{"short", strings.Repeat("a", 129), "has spaces in it ....", "semi;colon-0123456789"} {
		if w := rig.post("u1", k, `{}`); w.Code != http.StatusBadRequest {
			t.Errorf("key %q: code %d, want 400", k, w.Code)
		}
	}
	if rig.runs.Load() != 0 {
		t.Fatal("a malformed key must not run the handler")
	}
}

func TestIdempotency_HandlerSeesTheFullBody(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	var got string
	r.POST("/pay", func(c *gin.Context) {
		c.Set("authorization_payload", &token.Payload{UserId: "u1", ExpiredAt: time.Now().Add(time.Hour)})
	}, Idempotency(newMemIdempotency()), func(c *gin.Context) {
		var body struct {
			Amount int `json:"amount"`
		}
		_ = c.ShouldBindJSON(&body)
		got = strings.Repeat("x", body.Amount)
		c.Status(http.StatusNoContent)
	})
	req := httptest.NewRequest(http.MethodPost, "/pay", strings.NewReader(`{"amount":3}`))
	req.Header.Set(IdempotencyKeyHeader, testKey)
	r.ServeHTTP(httptest.NewRecorder(), req)
	if got != "xxx" {
		t.Fatalf("handler read %q from the body, want the original body", got)
	}
}

// The same key and body sent to a different :id (another user's wallet, say)
// must be refused, not answered with the first request's response.
func TestIdempotency_SameKeyOtherPathParamIsRefused(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	var runs atomic.Int32
	auth := func(c *gin.Context) {
		c.Set("authorization_payload", &token.Payload{UserId: "staff", ExpiredAt: time.Now().Add(time.Hour)})
	}
	router.POST("/users/:id/adjust", auth, Idempotency(newMemIdempotency()), func(c *gin.Context) {
		runs.Add(1)
		c.JSON(http.StatusOK, gin.H{"user": c.Param("id")})
	})
	post := func(path string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(`{"amount_kobo":1000}`))
		req.Header.Set(IdempotencyKeyHeader, testKey)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		return w
	}

	if w := post("/users/a/adjust"); w.Code != http.StatusOK {
		t.Fatalf("first request: %d", w.Code)
	}
	w := post("/users/b/adjust")
	if w.Code != http.StatusUnprocessableEntity || runs.Load() != 1 {
		t.Fatalf("code=%d runs=%d, want 422 and 1", w.Code, runs.Load())
	}
	if replay := post("/users/a/adjust"); replay.Header().Get("Idempotent-Replayed") != "true" {
		t.Fatal("the original request should still replay")
	}
}
