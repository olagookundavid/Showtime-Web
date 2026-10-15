package transport

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"showtime-backend/internal/ports"

	"github.com/gin-gonic/gin"
)

type fakeSitemapRepo struct {
	pages []ports.SitemapEntry
	err   error
	calls int
}

func (f *fakeSitemapRepo) DetailPages(context.Context) ([]ports.SitemapEntry, error) {
	f.calls++
	return f.pages, f.err
}

func getSitemap(h ISitemapHandler) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/sitemap.xml", nil)
	h.GetSitemap(c)
	return w
}

func TestSitemapListsStaticAndDetailPages(t *testing.T) {
	t.Setenv("FRONTEND_URL", "https://example.test/")
	repo := &fakeSitemapRepo{pages: []ports.SitemapEntry{
		{Path: "/news/derby-preview", LastMod: time.Date(2026, 10, 1, 9, 0, 0, 0, time.UTC)},
		{Path: "/players/abc"},
	}}

	w := getSitemap(NewSitemapHandler(repo))

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	body := w.Body.String()
	for _, want := range []string{
		"<loc>https://example.test/</loc>",
		"<loc>https://example.test/about/faq</loc>",
		"<loc>https://example.test/news/derby-preview</loc>",
		"<lastmod>2026-10-01</lastmod>",
		"<loc>https://example.test/players/abc</loc>",
	} {
		if !strings.Contains(body, want) {
			t.Errorf("sitemap missing %q", want)
		}
	}
	if strings.Contains(body, "gallery") {
		t.Error("sitemap still mentions gallery")
	}
}

func TestSitemapIsCachedAndSurvivesDatabaseErrors(t *testing.T) {
	repo := &fakeSitemapRepo{pages: []ports.SitemapEntry{{Path: "/teams/1"}}}
	h := NewSitemapHandler(repo)

	getSitemap(h)
	getSitemap(h)
	if repo.calls != 1 {
		t.Fatalf("repo hit %d times, want 1 (cached)", repo.calls)
	}

	h.(*SitemapHandler).builtAt = time.Now().Add(-2 * sitemapCacheTTL)
	repo.err = errors.New("db down")
	w := getSitemap(h)
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), "/teams/1") {
		t.Fatalf("expected stale copy on db error, got %d", w.Code)
	}
}

func TestSitemapFailsWithoutCacheWhenDatabaseDown(t *testing.T) {
	h := NewSitemapHandler(&fakeSitemapRepo{err: errors.New("db down")})
	if w := getSitemap(h); w.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", w.Code)
	}
}
