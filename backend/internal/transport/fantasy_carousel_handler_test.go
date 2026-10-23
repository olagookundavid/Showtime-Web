package transport

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

type stubCarouselService struct {
	services.IFantasyCarouselService
	err error
}

func (s stubCarouselService) Add(context.Context, dto.AddFantasyCarouselSlideRequest) (*dto.FantasyCarouselSlideResponse, error) {
	return nil, s.err
}
func (s stubCarouselService) QuickAdd(context.Context, dto.CreateNewsRequest) (*dto.FantasyCarouselSlideResponse, error) {
	return nil, s.err
}
func (s stubCarouselService) Remove(context.Context, string) error { return s.err }

func TestFantasyCarouselHandlerStatuses(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cases := []struct {
		name, method, path, body string
		err                      error
		want                     int
		wantText                 string
	}{
		{"full carousel", http.MethodPost, "/add", `{"news_id":"7f3c1a52-1b8e-4a77-9a5e-3c0a6f1d2b11"}`, domain.ErrFantasyCarouselFull, http.StatusConflict, "full"},
		{"already on it", http.MethodPost, "/add", `{"news_id":"7f3c1a52-1b8e-4a77-9a5e-3c0a6f1d2b11"}`, domain.ErrAlreadyOnFantasyCarousel, http.StatusConflict, "already"},
		{"missing article", http.MethodPost, "/add", `{"news_id":"7f3c1a52-1b8e-4a77-9a5e-3c0a6f1d2b11"}`, domain.ErrFantasyCarouselArticleNotFound, http.StatusNotFound, "could not be found"},
		{"not a uuid", http.MethodPost, "/add", `{"news_id":"nope"}`, nil, http.StatusBadRequest, ""},
		{"quick add when full", http.MethodPost, "/quick", `{"title":"t","content":"<p>x</p>"}`, domain.ErrFantasyCarouselFull, http.StatusConflict, "full"},
		{"quick add bad category", http.MethodPost, "/quick", `{"title":"t","content":"<p>x</p>"}`, errors.New("a quick-added article must be filed under Fantasy or Fantasy News"), http.StatusBadRequest, "Fantasy News"},
		{"quick add without content", http.MethodPost, "/quick", `{"title":"t"}`, nil, http.StatusBadRequest, ""},
		{"remove a missing slide", http.MethodDelete, "/remove/x", ``, pgx.ErrNoRows, http.StatusNotFound, "could not be found"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			h := NewFantasyCarouselHandler(stubCarouselService{err: tc.err})
			r := gin.New()
			r.POST("/add", h.Add)
			r.POST("/quick", h.QuickAdd)
			r.DELETE("/remove/:id", h.Remove)
			w := httptest.NewRecorder()
			req := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
			req.Header.Set("Content-Type", "application/json")
			r.ServeHTTP(w, req)
			if w.Code != tc.want {
				t.Fatalf("status = %d, want %d (body %s)", w.Code, tc.want, w.Body.String())
			}
			if tc.wantText != "" && !strings.Contains(w.Body.String(), tc.wantText) {
				t.Errorf("body %s should explain the problem (%q)", w.Body.String(), tc.wantText)
			}
		})
	}
}
