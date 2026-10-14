package transport

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
	"showtime-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type fakeSiteEventsService struct {
	tracked    []dto.TrackEventRequest
	metas      []services.RequestMeta
	serverSeen []string
}

func (f *fakeSiteEventsService) Track(req dto.TrackEventRequest, meta services.RequestMeta) error {
	if req.Type == "bogus" {
		return services.ErrInvalidSiteEvent
	}
	f.tracked = append(f.tracked, req)
	f.metas = append(f.metas, meta)
	return nil
}
func (f *fakeSiteEventsService) RecordServerEvent(eventType, _ string, _ services.RequestMeta) {
	f.serverSeen = append(f.serverSeen, eventType)
}
func (f *fakeSiteEventsService) Close() {}
func (f *fakeSiteEventsService) Scope(_ context.Context, from, to time.Time, _ string) (ports.SiteScope, error) {
	return ports.SiteScope{From: from, To: to}, nil
}
func (f *fakeSiteEventsService) Summary(context.Context, time.Time, time.Time, string, bool) (*dto.SiteTrafficSummary, error) {
	return &dto.SiteTrafficSummary{}, nil
}
func (f *fakeSiteEventsService) ListEvents(context.Context, ports.SiteEventFilter, int, int) (*dto.SiteEventsPage, error) {
	return &dto.SiteEventsPage{}, nil
}
func (f *fakeSiteEventsService) ExportEventsCSV(context.Context, ports.SiteEventFilter, io.Writer) error {
	return nil
}
func (f *fakeSiteEventsService) ExportSummaryCSV(_ context.Context, _, _ time.Time, _ string, _ bool, w io.Writer) error {
	_, err := w.Write([]byte("report"))
	return err
}

func newSiteEventsRouter(svc *fakeSiteEventsService) *gin.Engine {
	gin.SetMode(gin.TestMode)
	h := NewSiteEventsHandler(svc)
	r := gin.New()
	r.POST("/events", h.Track)
	r.POST("/ok", h.TrackOnSuccess("signup"), func(c *gin.Context) { c.Status(http.StatusCreated) })
	r.POST("/fail", h.TrackOnSuccess("login"), func(c *gin.Context) { c.Status(http.StatusBadRequest) })
	r.GET("/export", h.Export)
	return r
}

func post(r http.Handler, path, body string, headers map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestTrack_AcceptsValidAndReadsCloudflareHeaders(t *testing.T) {
	svc := &fakeSiteEventsService{}
	r := newSiteEventsRouter(svc)

	w := post(r, "/events", `{"type":"page_view","path":"/matches"}`, map[string]string{
		"CF-Connecting-IP": "203.0.113.9",
		"CF-IPCountry":     "NG",
		"User-Agent":       "Mozilla/5.0 test",
		"Content-Type":     "text/plain", // what the browser beacon sends, to avoid a CORS preflight
	})
	if w.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want 202", w.Code)
	}
	if len(svc.metas) != 1 || svc.metas[0].IP != "203.0.113.9" || svc.metas[0].Country != "NG" || svc.metas[0].UserAgent != "Mozilla/5.0 test" {
		t.Errorf("visitor meta wrong: %+v", svc.metas)
	}
}

func TestTrack_IgnoresMalformedCloudflareIP(t *testing.T) {
	svc := &fakeSiteEventsService{}
	r := newSiteEventsRouter(svc)
	post(r, "/events", `{"type":"page_view","path":"/"}`, map[string]string{"CF-Connecting-IP": "not-an-ip"})
	if len(svc.metas) != 1 || svc.metas[0].IP == "not-an-ip" {
		t.Errorf("a malformed header must not be stored as the visitor IP: %+v", svc.metas)
	}
}

func TestTrack_Rejections(t *testing.T) {
	r := newSiteEventsRouter(&fakeSiteEventsService{})

	if w := post(r, "/events", `{"type":"bogus"}`, nil); w.Code != http.StatusBadRequest {
		t.Errorf("service rejection should be 400, got %d", w.Code)
	}
	if w := post(r, "/events", `not json`, nil); w.Code != http.StatusBadRequest {
		t.Errorf("malformed JSON should be 400, got %d", w.Code)
	}
	huge := `{"type":"page_view","path":"/","properties":{"x":"` + strings.Repeat("a", 20<<10) + `"}}`
	if w := post(r, "/events", huge, nil); w.Code != http.StatusBadRequest {
		t.Errorf("a payload over the 8KB cap should be rejected, got %d", w.Code)
	}
}

func TestTrackOnSuccess_OnlyRecordsSuccessfulRequests(t *testing.T) {
	svc := &fakeSiteEventsService{}
	r := newSiteEventsRouter(svc)

	post(r, "/ok", "", nil)
	post(r, "/fail", "", nil)

	if len(svc.serverSeen) != 1 || svc.serverSeen[0] != "signup" {
		t.Errorf("only the 2xx request should be recorded, got %v", svc.serverSeen)
	}
}

func TestExport_Headers(t *testing.T) {
	r := newSiteEventsRouter(&fakeSiteEventsService{})
	req := httptest.NewRequest(http.MethodGet, "/export?from=2026-03-01&to=2026-03-10&kind=summary", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	if got := w.Header().Get("Content-Disposition"); got != `attachment; filename="showtime-traffic-summary_2026-03-01_to_2026-03-10.csv"` {
		t.Errorf("Content-Disposition = %q", got)
	}
	if !strings.HasPrefix(w.Header().Get("Content-Type"), "text/csv") {
		t.Errorf("Content-Type = %q", w.Header().Get("Content-Type"))
	}

	bad := httptest.NewRecorder()
	r.ServeHTTP(bad, httptest.NewRequest(http.MethodGet, "/export?kind=nope", nil))
	if bad.Code != http.StatusBadRequest {
		t.Errorf("unknown kind should be 400, got %d", bad.Code)
	}

	badDays := httptest.NewRecorder()
	r.ServeHTTP(badDays, httptest.NewRequest(http.MethodGet, "/export?days=weekends", nil))
	if badDays.Code != http.StatusBadRequest {
		t.Errorf("unknown day filter should be 400, got %d", badDays.Code)
	}

	match := httptest.NewRecorder()
	r.ServeHTTP(match, httptest.NewRequest(http.MethodGet, "/export?from=2026-03-01&to=2026-03-10&kind=summary&days=match", nil))
	if got := match.Header().Get("Content-Disposition"); got != `attachment; filename="showtime-traffic-summary-match-days_2026-03-01_to_2026-03-10.csv"` {
		t.Errorf("match-day export should say so in its filename, got %q", got)
	}
}
