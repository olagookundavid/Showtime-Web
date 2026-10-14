package services

import (
	"context"
	"errors"
	"strings"
	"sync"
	"testing"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

func TestCleanPath_DropsQueryAndFragment(t *testing.T) {
	cases := map[string]string{
		"/matches":                      "/matches",
		"/claim/verify?token=secret123": "/claim/verify",
		"/news/42#comments":             "/news/42",
		"  /padded  ":                   "/padded",
		"https://evil.example/phish":    "",
		"relative/path":                 "",
		"":                              "",
		"/" + strings.Repeat("a", 600):  "/" + strings.Repeat("a", 511),
	}
	for in, want := range cases {
		if got := cleanPath(in); got != want {
			t.Errorf("cleanPath(%.40q) = %.40q, want %.40q", in, got, want)
		}
	}
}

func TestReferrerHost(t *testing.T) {
	cases := map[string]string{
		"https://www.google.com/search?q=flag+football": "google.com",
		"https://t.co/abc":                    "t.co",
		"android-app://com.google.android.gm": "com.google.android.gm",
		"not a url":                           "",
		"":                                    "",
	}
	for in, want := range cases {
		if got := referrerHost(in); got != want {
			t.Errorf("referrerHost(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestNormalizeCountry(t *testing.T) {
	cases := map[string]string{"ng": "NG", " GH ": "GH", "XX": "", "T1": "", "": "", "NGA": ""}
	for in, want := range cases {
		if got := normalizeCountry(in); got != want {
			t.Errorf("normalizeCountry(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestCleanProperties(t *testing.T) {
	if cleanProperties(map[string]any{"sku": "jersey"}) == nil {
		t.Error("small property bag should be kept")
	}
	if cleanProperties(map[string]any{"blob": strings.Repeat("x", 3000)}) != nil {
		t.Error("oversized property bag should be dropped")
	}
	big := map[string]any{}
	for i := 0; i < 21; i++ {
		big[string(rune('a'+i))] = 1
	}
	if cleanProperties(big) != nil {
		t.Error("too many keys should be dropped")
	}
}

func TestTrack_RejectsUnknownAndPathlessEvents(t *testing.T) {
	s := NewSiteEventsService(nil)

	err := s.Track(dto.TrackEventRequest{Type: "login", Path: "/"}, RequestMeta{})
	if !errors.Is(err, ErrInvalidSiteEvent) {
		t.Errorf("a browser must not be able to forge server events like login, got %v", err)
	}
	err = s.Track(dto.TrackEventRequest{Type: "page_view", Path: "https://evil.example"}, RequestMeta{})
	if !errors.Is(err, ErrInvalidSiteEvent) {
		t.Errorf("page_view without a valid path should be rejected, got %v", err)
	}
}

func TestResolveRange(t *testing.T) {
	now := time.Date(2026, 3, 10, 22, 30, 0, 0, time.UTC) // 23:30 in Lagos, still Mar 10

	from, to, err := ResolveRange("2026-03-01", "2026-03-10", now)
	if err != nil {
		t.Fatal(err)
	}
	if from.In(siteLocation).Format("2006-01-02") != "2026-03-01" || to.In(siteLocation).Format("2006-01-02") != "2026-03-11" {
		t.Errorf("range should be [Mar 1, Mar 11) in Lagos time, got [%v, %v)", from, to)
	}
	if to.Sub(from) != 10*24*time.Hour {
		t.Errorf("inclusive 10-day range spans %v", to.Sub(from))
	}

	if _, to, _ := ResolveRange("", "", now); to.In(siteLocation).Format("2006-01-02") != "2026-03-11" {
		t.Errorf("empty to should mean through today, got %v", to)
	}
	if _, _, err := ResolveRange("2026-03-10", "2026-03-01", now); err == nil {
		t.Error("to before from should be rejected")
	}
	if _, _, err := ResolveRange("03/01/2026", "", now); err == nil {
		t.Error("malformed date should be rejected")
	}
}

func TestCSVCell_NeutralisesFormulas(t *testing.T) {
	for _, in := range []string{"=SUM(A1)", "+1", "-1", "@cmd", "\tx"} {
		if got := csvCell(in); !strings.HasPrefix(got, "'") {
			t.Errorf("csvCell(%q) = %q, want leading apostrophe", in, got)
		}
	}
	if csvCell("/matches") != "/matches" || csvCell("") != "" {
		t.Error("ordinary cells must pass through untouched")
	}
}

// recordingRepo captures what the batch writer flushes.
type recordingRepo struct {
	ports.ISiteEventsRepository
	mu      sync.Mutex
	batches [][]domain.SiteEvent
}

func (r *recordingRepo) InsertBatch(_ context.Context, events []domain.SiteEvent) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.batches = append(r.batches, events)
	return nil
}

func TestFlush_WritesPendingEventsAsOneBatch(t *testing.T) {
	repo := &recordingRepo{}
	s := NewSiteEventsService(repo)
	defer s.Close()

	s.pending.Store("a", domain.SiteEvent{EventType: "page_view"})
	s.pending.Store("b", domain.SiteEvent{EventType: "login"})

	if _, err := s.flush([]string{"a", "b", "already-flushed"}); err != nil {
		t.Fatal(err)
	}
	if len(repo.batches) != 1 || len(repo.batches[0]) != 2 {
		t.Fatalf("want one batch of 2, got %+v", repo.batches)
	}
	if _, left := s.pending.Load("a"); left {
		t.Error("flushed events must leave the pending map")
	}

	if _, err := s.flush([]string{"a"}); err != nil || len(repo.batches) != 1 {
		t.Error("an empty flush must not hit the database")
	}
}

func TestStore_StampsEventTimeAndVisitor(t *testing.T) {
	repo := &recordingRepo{}
	s := NewSiteEventsService(repo)
	before := time.Now().UTC()

	if err := s.Track(dto.TrackEventRequest{Type: "page_view", Path: "/matches"}, RequestMeta{
		IP: "203.0.113.9", Country: "ng", UserAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1",
	}); err != nil {
		t.Fatal(err)
	}

	// Close forces the batch out instead of waiting 30 seconds. The worker may
	// not have queued the event yet, so wait until it is pending first.
	deadline := time.Now().Add(2 * time.Second)
	for {
		n := 0
		s.pending.Range(func(_, _ any) bool { n++; return true })
		if n == 1 || time.Now().After(deadline) {
			break
		}
		time.Sleep(5 * time.Millisecond)
	}
	time.Sleep(20 * time.Millisecond)
	s.Close()

	repo.mu.Lock()
	defer repo.mu.Unlock()
	if len(repo.batches) != 1 || len(repo.batches[0]) != 1 {
		t.Fatalf("want the event flushed on Close, got %+v", repo.batches)
	}
	e := repo.batches[0][0]
	if e.CreatedAt.Before(before) || e.CreatedAt.After(time.Now().UTC()) {
		t.Errorf("CreatedAt should be stamped when the event happens, got %v", e.CreatedAt)
	}
	if e.IP != "203.0.113.9" || e.Country != "NG" || e.DeviceType != "mobile" || e.OS != "iOS" {
		t.Errorf("visitor fields wrong: %+v", e)
	}
}

func TestDailyStats_SkipsDaysBeforeTrackingAndSplitsMatchDays(t *testing.T) {
	daily := []dto.SiteDailyPoint{
		{Date: "d1"}, // before tracking began
		{Date: "d2", PageViews: 10, Visitors: 6, MatchDay: true},
		{Date: "d3", PageViews: 4, Visitors: 2},
		{Date: "d4", PageViews: 0, Visitors: 0}, // a genuinely quiet day still counts
	}
	avg, md := dailyStats(daily)
	if avg != 8.0/3 {
		t.Errorf("avg daily visitors = %v, want %v", avg, 8.0/3)
	}
	if md.MatchDays != 1 || md.AvgVisitorsMatchDay != 6 || md.OtherDays != 2 || md.AvgVisitorsOtherDay != 1 {
		t.Errorf("match-day split wrong: %+v", md)
	}

	if avg, md := dailyStats([]dto.SiteDailyPoint{{Date: "d1"}}); avg != 0 || md.MatchDays != 0 {
		t.Error("no data at all should give zeros")
	}
}

func TestPctChange(t *testing.T) {
	cases := []struct {
		cur, prev float64
		want      string
	}{
		{150, 100, "+50.0%"},
		{75, 100, "-25.0%"},
		{5, 0, "n/a"},
	}
	for _, c := range cases {
		if got := pctChange(c.cur, c.prev); got != c.want {
			t.Errorf("pctChange(%v, %v) = %q, want %q", c.cur, c.prev, got, c.want)
		}
	}
}

func TestPlainPageTitle(t *testing.T) {
	cases := map[string]string{"/": "Home", "/matches": "Matches", "/team-of-the-week": "Team Of The Week", "/news/some-story": "", "": ""}
	for in, want := range cases {
		if got := plainPageTitle(in); got != want {
			t.Errorf("plainPageTitle(%q) = %q, want %q", in, got, want)
		}
	}
	if got := ptsChange(0.44, 0.40); got != "+4.0 pts" {
		t.Errorf("ptsChange = %q", got)
	}
}
