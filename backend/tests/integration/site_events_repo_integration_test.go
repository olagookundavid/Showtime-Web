package tests_integration

// Integration coverage for visitor analytics (site_events).
//
// The reports are hand-written SQL, so these run every query against a real,
// fully-migrated schema (including the users table the conversions query
// reads). Fixtures live in January 2001 and are deleted before and after, so
// the test is safe to point at a database that also holds real analytics data.
//
// Skipped automatically when TEST_DB_DSN is unset; see
// fantasy_repo_integration_test.go for how to run.

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"strings"
	"testing"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/ports"
	"showtime-backend/internal/services"

	"github.com/jackc/pgx/v5/pgxpool"
)

const siteEventsFixtureCutoff = "2002-01-01"

func siteEventsPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dsn := strings.TrimSpace(os.Getenv("TEST_DB_DSN"))
	if dsn == "" {
		t.Skip("TEST_DB_DSN not set")
	}
	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

func cleanSiteEventsFixtures(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	mustExec(t, pool, `DELETE FROM site_events WHERE created_at < $1::timestamptz`, siteEventsFixtureCutoff)
	mustExec(t, pool, `DELETE FROM users WHERE email = 'site-events-fixture@example.test'`)
}

type fixtureEvent struct {
	at       string
	typ      string
	source   string
	path     string
	entry    bool
	referrer string
	utmSrc   string
	utmCamp  string
	session  string
	ip       string
	country  string
	bot      bool
}

func insertFixtureEvent(t *testing.T, pool *pgxpool.Pool, e fixtureEvent) {
	t.Helper()
	if e.source == "" {
		e.source = "web"
	}
	mustExec(t, pool, `
		INSERT INTO site_events (
			created_at, event_type, source, path, is_entry, referrer_host, utm_source,
			utm_campaign, session_id, ip, country, device_type, browser, os, is_bot
		) VALUES (
			$1::timestamptz, $2, $3, NULLIF($4, ''), $5, NULLIF($6, ''), NULLIF($7, ''),
			NULLIF($8, ''), NULLIF($9, ''), $10, NULLIF($11, ''), 'mobile', 'Chrome', 'Android', $12
		)`,
		e.at, e.typ, e.source, e.path, e.entry, e.referrer, e.utmSrc,
		e.utmCamp, e.session, e.ip, e.country, e.bot)
}

func TestSiteEvents_ReportsAgainstRealSchema(t *testing.T) {
	pool := siteEventsPool(t)
	cleanSiteEventsFixtures(t, pool)
	t.Cleanup(func() { cleanSiteEventsFixtures(t, pool) })

	// Times are UTC. Lagos is UTC+1, so event 3 (Jan 1 23:30Z) belongs to
	// Jan 2 in the league's calendar — the daily bucket must follow Lagos.
	fixtures := []fixtureEvent{
		{at: "2001-01-01T09:00:00Z", typ: "page_view", path: "/", entry: true, referrer: "google.com", utmSrc: "newsletter", session: "session-one", ip: "1.1.1.1", country: "NG"},
		{at: "2001-01-01T09:01:00Z", typ: "page_view", path: "/matches", session: "session-one", ip: "1.1.1.1", country: "NG"},
		{at: "2001-01-01T23:30:00Z", typ: "page_view", path: "/", entry: true, utmCamp: "=1+1", session: "session-two", ip: "2.2.2.2", country: "GH"},
		{at: "2001-01-02T11:00:00Z", typ: "page_view", path: "/tickets", session: "session-two", ip: "2.2.2.2"},
		{at: "2001-01-01T09:02:00Z", typ: "login", source: "api", path: "/api/v1/auth/login", ip: "1.1.1.1", country: "NG"},
		{at: "2001-01-01T09:03:00Z", typ: "page_view", path: "/", session: "session-bot", ip: "3.3.3.3", bot: true},
		{at: "2001-01-05T09:00:00Z", typ: "page_view", path: "/outside-range", session: "session-late", ip: "4.4.4.4"},
		// Before the range: makes 1.1.1.1 a returning visitor, and is the whole
		// of the previous period (Dec 30-31) for the comparison.
		{at: "2000-12-31T10:00:00Z", typ: "page_view", path: "/", session: "session-early", ip: "1.1.1.1", country: "NG"},
	}
	for _, f := range fixtures {
		insertFixtureEvent(t, pool, f)
	}
	mustExec(t, pool, `INSERT INTO users (full_name, email, created_at) VALUES ('Fixture', 'site-events-fixture@example.test', '2001-01-01T10:00:00Z')`)

	ctx := context.Background()
	repo := ports.NewSiteEventsRepository(pool)
	svc := services.NewSiteEventsService(repo)

	from, to, err := services.ResolveRange("2001-01-01", "2001-01-02", time.Date(2001, 2, 1, 0, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatalf("ResolveRange: %v", err)
	}

	sum, err := svc.Summary(ctx, from, to, true)
	if err != nil {
		t.Fatalf("Summary: %v", err)
	}

	tot := sum.Totals
	if tot.PageViews != 4 || tot.UniqueVisitors != 2 || tot.Sessions != 2 || tot.ActionEvents != 1 || tot.BotEventsExcluded != 1 {
		t.Errorf("totals wrong: %+v", tot)
	}
	if tot.PagesPerSession != 2 {
		t.Errorf("pages per session = %v, want 2", tot.PagesPerSession)
	}
	if tot.ReturningVisitors != 1 || tot.NewVisitors != 1 {
		t.Errorf("1.1.1.1 visited before the range, so 1 returning + 1 new; got %+v", tot)
	}
	if tot.BounceRate != 0 {
		t.Errorf("both sessions viewed 2 pages, bounce rate = %v, want 0", tot.BounceRate)
	}
	if tot.AvgDailyVisitors != 1 {
		t.Errorf("one visitor on each of two days, avg daily = %v, want 1", tot.AvgDailyVisitors)
	}

	if sum.Previous == nil || sum.Previous.From != "2000-12-30" || sum.Previous.To != "2000-12-31" {
		t.Fatalf("previous period should be the two days before, got %+v", sum.Previous)
	}
	if p := sum.Previous.Totals; p.PageViews != 1 || p.UniqueVisitors != 1 || p.BounceRate != 1 {
		t.Errorf("previous period totals wrong: %+v", p)
	}

	if len(sum.Monthly) != 1 || sum.Monthly[0].Month != "2001-01" || sum.Monthly[0].PageViews != 4 || sum.Monthly[0].Sessions != 2 {
		t.Errorf("monthly wrong: %+v", sum.Monthly)
	}

	// 2001-01-01 was a Monday. Lagos time: two views Mon 10:00, then Tue 00:30 and Tue 12:00.
	heat := map[[2]int]int{}
	for _, c := range sum.Heatmap {
		heat[[2]int{c.Weekday, c.Hour}] = c.PageViews
	}
	if heat[[2]int{1, 10}] != 2 || heat[[2]int{2, 0}] != 1 || heat[[2]int{2, 12}] != 1 || len(heat) != 3 {
		t.Errorf("heatmap should bucket by Lagos weekday/hour, got %+v", sum.Heatmap)
	}

	sections := map[string]int{}
	for _, s := range sum.Sections {
		sections[s.Name] = s.Count
	}
	if sections["Home"] != 2 || sections["Matches"] != 1 || sections["Tickets"] != 1 {
		t.Errorf("sections wrong: %+v", sections)
	}

	if len(sum.Daily) != 2 {
		t.Fatalf("daily should cover both days, got %+v", sum.Daily)
	}
	if d := sum.Daily[0]; d.Date != "2001-01-01" || d.PageViews != 2 || d.Visitors != 1 {
		t.Errorf("Jan 1 bucket wrong: %+v", d)
	}
	if d := sum.Daily[1]; d.Date != "2001-01-02" || d.PageViews != 2 || d.Visitors != 1 {
		t.Errorf("Jan 2 bucket should hold the 23:30Z view (Lagos midnight): %+v", d)
	}

	if len(sum.TopPages) == 0 || sum.TopPages[0].Name != "/" || sum.TopPages[0].Label != "Home" || sum.TopPages[0].Count != 2 || sum.TopPages[0].Visitors != 2 {
		t.Errorf("top pages wrong: %+v", sum.TopPages)
	}

	sources := map[string]int{}
	for _, s := range sum.Sources {
		sources[s.Name] = s.Count
	}
	if sources["newsletter"] != 1 || sources["Direct"] != 1 || len(sources) != 2 {
		t.Errorf("sources should be utm-over-referrer plus Direct, got %+v", sources)
	}

	countries := map[string]int{}
	for _, c := range sum.Countries {
		countries[c.Name] = c.Count
	}
	if countries["NG"] != 2 || countries["GH"] != 1 || countries["Unknown"] != 1 {
		t.Errorf("countries wrong: %+v", countries)
	}

	if len(sum.Actions) != 1 || sum.Actions[0].Name != "login" {
		t.Errorf("actions wrong: %+v", sum.Actions)
	}
	if sum.Conversions.NewUsers != 1 {
		t.Errorf("new users = %d, want 1", sum.Conversions.NewUsers)
	}

	page, err := svc.ListEvents(ctx, ports.SiteEventFilter{From: from, To: to}, 1, 50)
	if err != nil || page.Total != 5 {
		t.Errorf("events without bots: total=%v err=%v, want 5", page, err)
	}
	page, err = svc.ListEvents(ctx, ports.SiteEventFilter{From: from, To: to, IncludeBots: true}, 1, 50)
	if err != nil || page.Total != 6 {
		t.Errorf("events with bots: total=%v err=%v, want 6", page, err)
	}
	page, err = svc.ListEvents(ctx, ports.SiteEventFilter{From: from, To: to, EventType: "login"}, 1, 50)
	if err != nil || page.Total != 1 {
		t.Errorf("login filter: total=%v err=%v, want 1", page, err)
	}

	// Every page-title lookup runs against the real tables (ids that don't
	// exist simply produce no label).
	labels, err := repo.PageLabels(ctx, []string{
		"/news/no-such-story", "/matches/00000000-0000-0000-0000-000000000000",
		"/players/00000000-0000-0000-0000-000000000000", "/teams/00000000-0000-0000-0000-000000000000",
		"/store/products/00000000-0000-0000-0000-000000000000", "/about",
	})
	if err != nil || len(labels) != 0 {
		t.Errorf("PageLabels: labels=%v err=%v", labels, err)
	}
	if _, err := repo.MatchDates(ctx, from, to); err != nil {
		t.Errorf("MatchDates: %v", err)
	}

	var summaryCSV bytes.Buffer
	if err := svc.ExportSummaryCSV(ctx, from, to, true, &summaryCSV); err != nil {
		t.Fatalf("ExportSummaryCSV: %v", err)
	}
	out := summaryCSV.String()
	if !strings.HasPrefix(out, "\xEF\xBB\xBF") {
		t.Error("summary CSV should lead with a UTF-8 BOM for Excel")
	}
	if !strings.Contains(out, "Page views,4,1,+300.0%") || !strings.Contains(out, "2001-01-02,2,1,") {
		t.Errorf("summary CSV missing expected rows:\n%s", out)
	}
	if strings.Contains(out, ",=1+1,") || strings.Contains(out, "\n=1+1,") {
		t.Errorf("campaign name starting with '=' must be neutralised:\n%s", out)
	}

	var eventsCSV bytes.Buffer
	if err := svc.ExportEventsCSV(ctx, ports.SiteEventFilter{From: from, To: to}, &eventsCSV); err != nil {
		t.Fatalf("ExportEventsCSV: %v", err)
	}
	lines := strings.Split(strings.TrimSpace(eventsCSV.String()), "\n")
	if len(lines) != 6 { // header + 5 non-bot events
		t.Errorf("events CSV has %d lines, want 6:\n%s", len(lines), eventsCSV.String())
	}
	if strings.Contains(eventsCSV.String(), ",=1+1,") {
		t.Errorf("events CSV must neutralise formula-looking cells:\n%s", eventsCSV.String())
	}
}

// TestSiteEvents_InsertBatchCopiesEveryColumn writes through the same COPY the
// batch writer uses, so a column/type mismatch fails here instead of silently
// dropping a production batch.
func TestSiteEvents_InsertBatchCopiesEveryColumn(t *testing.T) {
	pool := siteEventsPool(t)
	cleanSiteEventsFixtures(t, pool)
	t.Cleanup(func() { cleanSiteEventsFixtures(t, pool) })

	ctx := context.Background()
	repo := ports.NewSiteEventsRepository(pool)
	at := time.Date(2001, 3, 1, 12, 0, 0, 0, time.UTC)

	err := repo.InsertBatch(ctx, []domain.SiteEvent{
		{CreatedAt: at, EventType: "page_view", Source: "web", Path: "/news/x", IsEntry: true, ReferrerHost: "google.com",
			UTMSource: "ig", UTMMedium: "social", UTMCampaign: "launch", SessionID: "session-batch", IP: "5.5.5.5",
			Country: "NG", DeviceType: "mobile", Browser: "Chrome", OS: "Android", UserAgent: "UA",
			Properties: map[string]any{"sku": "jersey", "qty": 2}},
		{CreatedAt: at.Add(time.Minute), EventType: "login", Source: "api"},
	})
	if err != nil {
		t.Fatalf("InsertBatch: %v", err)
	}

	page, _, err := repo.ListEvents(ctx, ports.SiteEventFilter{From: at.Add(-time.Hour), To: at.Add(time.Hour)}, 10, 0)
	if err != nil || len(page) != 2 {
		t.Fatalf("expected 2 rows back, got %d (err %v)", len(page), err)
	}
	full, bare := page[1], page[0] // newest first
	if !full.CreatedAt.Equal(at) {
		t.Errorf("created_at must be the event time, not the flush time: %v", full.CreatedAt)
	}
	if full.UTMCampaign != "launch" || full.Country != "NG" || full.Properties["sku"] != "jersey" {
		t.Errorf("columns did not round-trip: %+v", full)
	}

	var nulls int
	if err := pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM site_events
		WHERE created_at = $1 AND path IS NULL AND ip IS NULL AND country IS NULL AND properties = '{}'::jsonb`,
		bare.CreatedAt).Scan(&nulls); err != nil || nulls != 1 {
		t.Errorf("empty strings should be stored as NULL and nil properties as {}: got %d (err %v)", nulls, err)
	}
}

// TestSiteEvents_EmptyPeriodListsAreArrays guards the contract the dashboard
// relies on: a period with no data must return [] for every list, not null.
// A nil Go slice encodes as null, which crashed the Content & sources tab in
// production the first time a list (campaigns) had no rows.
func TestSiteEvents_EmptyPeriodListsAreArrays(t *testing.T) {
	pool := siteEventsPool(t)
	svc := services.NewSiteEventsService(ports.NewSiteEventsRepository(pool))

	from, to, err := services.ResolveRange("1999-03-01", "1999-03-07", time.Date(1999, 4, 1, 0, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatal(err)
	}
	sum, err := svc.Summary(context.Background(), from, to, true)
	if err != nil {
		t.Fatalf("Summary: %v", err)
	}
	raw, err := json.Marshal(sum)
	if err != nil {
		t.Fatal(err)
	}

	var fields map[string]json.RawMessage
	if err := json.Unmarshal(raw, &fields); err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{
		"daily", "monthly", "heatmap", "sections", "top_pages", "sources",
		"campaigns", "countries", "devices", "browsers", "oses", "actions",
	} {
		if v := string(fields[key]); v == "" || v == "null" {
			t.Errorf("%s = %q, want a JSON array", key, v)
		}
	}
}
