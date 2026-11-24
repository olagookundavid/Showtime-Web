package transport

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func returnURLFor(origin string) string {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/wallet/topups", nil)
	if origin != "" {
		c.Request.Header.Set("Origin", origin)
	}
	return paystackReturnURL(c, "/wallet/confirm")
}

func TestPaystackReturnURL(t *testing.T) {
	t.Setenv("CORS_ALLOW_ORIGINS", "https://showtimeflag.football, https://www.showtimeflag.football")
	t.Setenv("FRONTEND_URL", "https://www.showtimeflag.football/")
	t.Setenv("CORS_ALLOW_LOCALHOST", "")

	cases := []struct{ origin, want string }{
		// The site's own addresses keep the payer on the host they signed in on.
		{"https://showtimeflag.football", "https://showtimeflag.football/wallet/confirm"},
		{"https://www.showtimeflag.football", "https://www.showtimeflag.football/wallet/confirm"},
		// Anything else falls back to the configured site.
		{"https://evil.example", "https://www.showtimeflag.football/wallet/confirm"},
		{"http://localhost:5173", "https://www.showtimeflag.football/wallet/confirm"},
		{"", "https://www.showtimeflag.football/wallet/confirm"},
	}
	for _, tc := range cases {
		if got := returnURLFor(tc.origin); got != tc.want {
			t.Errorf("origin %q: got %q, want %q", tc.origin, got, tc.want)
		}
	}
}

func TestPaystackReturnURL_LocalDevelopment(t *testing.T) {
	t.Setenv("CORS_ALLOW_ORIGINS", "https://showtimeflag.football")
	t.Setenv("FRONTEND_URL", "")
	t.Setenv("CORS_ALLOW_LOCALHOST", "true")

	if got := returnURLFor("http://localhost:5173"); got != "http://localhost:5173/wallet/confirm" {
		t.Errorf("localhost allowed in development: got %q", got)
	}
	if got := returnURLFor("https://evil.example"); got != "http://localhost:5173/wallet/confirm" {
		t.Errorf("unknown origin with no FRONTEND_URL: got %q", got)
	}
}
