package middlewares

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestWindowLimit(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	key := func(c *gin.Context) string { return c.GetHeader("X-Key") }
	r.POST("/x", WindowLimit("test", 3, 200*time.Millisecond, key), func(c *gin.Context) { c.Status(http.StatusOK) })

	do := func(k string) int {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/x", nil)
		req.Header.Set("X-Key", k)
		r.ServeHTTP(w, req)
		return w.Code
	}

	for i := 0; i < 3; i++ {
		if code := do("a"); code != http.StatusOK {
			t.Fatalf("request %d: got %d, want 200", i+1, code)
		}
	}
	if code := do("a"); code != http.StatusTooManyRequests {
		t.Fatalf("4th request in the window: got %d, want 429", code)
	}
	if code := do("b"); code != http.StatusOK {
		t.Fatalf("a different key is counted separately: got %d", code)
	}
	time.Sleep(250 * time.Millisecond)
	if code := do("a"); code != http.StatusOK {
		t.Fatalf("after the window passes: got %d, want 200", code)
	}
}

func TestByIP_PrefersCloudflareClientIP(t *testing.T) {
	gin.SetMode(gin.TestMode)
	newCtx := func(cfIP string) *gin.Context {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/x", nil)
		c.Request.RemoteAddr = "172.68.1.1:443" // a Cloudflare edge address
		if cfIP != "" {
			c.Request.Header.Set("CF-Connecting-IP", cfIP)
		}
		return c
	}

	if a, b := ByIP(newCtx("102.89.1.10")), ByIP(newCtx("102.89.1.11")); a == b {
		t.Errorf("two fans behind the same Cloudflare edge share a bucket: %s", a)
	}
	if got := ByIP(newCtx("not-an-ip")); got != "ip:172.68.1.1" {
		t.Errorf("malformed header should fall back to ClientIP, got %s", got)
	}
	if got := ByIP(newCtx("")); got != "ip:172.68.1.1" {
		t.Errorf("missing header should fall back to ClientIP, got %s", got)
	}
}
