package middlewares

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"pkg-common/token"
	"showtime-backend/internal/domain"
	appErrors "showtime-backend/internal/errors"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// stubRoles resolves users from a fixed table, counting lookups.
type stubRoles struct {
	services.IRoleService
	access  map[string]*services.Access
	resolve int
}

func (s *stubRoles) ResolveUser(_ context.Context, id string) (*services.Access, error) {
	s.resolve++
	if a, ok := s.access[id]; ok {
		return a, nil
	}
	if id == "db-down" {
		return nil, errors.New("connection refused")
	}
	return nil, appErrors.ErrNoUserRecordExist
}

func serve(t *testing.T, roles *stubRoles, userID, method string, gates ...gin.HandlerFunc) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		if userID != "" {
			c.Set("authorization_payload", &token.Payload{UserId: userID, ExpiredAt: time.Now().Add(time.Hour)})
		}
	})
	handlers := append(gates, func(c *gin.Context) { c.Status(http.StatusOK) })
	r.Handle(method, "/x", handlers...)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(method, "/x", nil))
	return w
}

func newStub(t *testing.T) *stubRoles {
	t.Helper()
	return &stubRoles{access: map[string]*services.Access{
		"full":  services.NewTestAccess("u1", "editor", map[string]domain.AccessLevel{domain.FeatureNews: domain.AccessFull}),
		"view":  services.NewTestAccess("u2", "viewer", map[string]domain.AccessLevel{domain.FeatureNews: domain.AccessView}),
		"none":  services.NewTestAccess("u3", "nobody", nil),
		"super": services.NewTestSuperAccess("u4"),
	}}
}

func TestFeatureAccessLevels(t *testing.T) {
	roles := newStub(t)
	cases := []struct {
		name, user, method string
		want               int
	}{
		{"full may read", "full", http.MethodGet, http.StatusOK},
		{"full may write", "full", http.MethodPost, http.StatusOK},
		{"view may read", "view", http.MethodGet, http.StatusOK},
		{"view may not write", "view", http.MethodPost, http.StatusForbidden},
		{"view may not delete", "view", http.MethodDelete, http.StatusForbidden},
		{"no access refused", "none", http.MethodGet, http.StatusForbidden},
		{"app_admin always passes", "super", http.MethodDelete, http.StatusOK},
		{"unknown user", "ghost", http.MethodGet, http.StatusUnauthorized},
		{"no token", "", http.MethodGet, http.StatusUnauthorized},
		{"db error is not a sign-out", "db-down", http.MethodGet, http.StatusInternalServerError},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			w := serve(t, roles, tc.user, tc.method, FeatureAccessMiddleware(roles, domain.FeatureNews))
			if w.Code != tc.want {
				t.Errorf("status = %d, want %d (%s)", w.Code, tc.want, w.Body.String())
			}
		})
	}
}

func TestStackedGatesResolveTheUserOnce(t *testing.T) {
	roles := newStub(t)
	roles.access["multi"] = services.NewTestAccess("u5", "multi", map[string]domain.AccessLevel{
		domain.FeatureMatches: domain.AccessFull, domain.FeaturePlayByPlay: domain.AccessFull,
	})

	w := serve(t, roles, "multi", http.MethodPost,
		FeatureAccessMiddleware(roles, domain.FeatureMatches),
		FeatureAccessMiddleware(roles, domain.FeaturePlayByPlay),
	)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	if roles.resolve != 1 {
		t.Errorf("resolved %d times, want 1", roles.resolve)
	}
}

func TestStaffOrRoles(t *testing.T) {
	roles := newStub(t)
	roles.access["head"] = services.NewTestAccess("u6", domain.RoleTeamHead, nil)

	gate := StaffOrRolesMiddleware(roles, domain.RoleTeamHead)
	for user, want := range map[string]int{
		"full": http.StatusOK, "view": http.StatusOK, "super": http.StatusOK,
		"head": http.StatusOK, "none": http.StatusForbidden,
	} {
		if w := serve(t, roles, user, http.MethodPost, gate); w.Code != want {
			t.Errorf("%s: status = %d, want %d", user, w.Code, want)
		}
	}
}
