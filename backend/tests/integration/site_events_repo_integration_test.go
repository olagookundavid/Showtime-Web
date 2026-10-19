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

	sum, err := svc.Summary(ctx, from, to, "all", true)
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

	page, err := svc.ListEvents(ctx, ports.SiteEventFilter{SiteScope: ports.SiteScope{From: from, To: to}}, 1, 50)
	if err != nil || page.Total != 5 {
		t.Errorf("events without bots: total=%v err=%v, want 5", page, err)
	}
	page, err = svc.ListEvents(ctx, ports.SiteEventFilter{SiteScope: ports.SiteScope{From: from, To: to}, IncludeBots: true}, 1, 50)
	if err != nil || page.Total != 6 {
		t.Errorf("events with bots: total=%v err=%v, want 6", page, err)
	}
	page, err = svc.ListEvents(ctx, ports.SiteEventFilter{SiteScope: ports.SiteScope{From: from, To: to}, EventType: "login"}, 1, 50)
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
	if _, err := repo.MatchDays(ctx, from, to); err != nil {
		t.Errorf("MatchDays: %v", err)
	}

	var summaryCSV bytes.Buffer
	if err := svc.ExportSummaryCSV(ctx, from, to, "all", true, &summaryCSV); err != nil {
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
	if err := svc.ExportEventsCSV(ctx, ports.SiteEventFilter{SiteScope: ports.SiteScope{From: from, To: to}}, &eventsCSV); err != nil {
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

	page, _, err := repo.ListEvents(ctx, ports.SiteEventFilter{SiteScope: ports.SiteScope{From: at.Add(-time.Hour), To: at.Add(time.Hour)}}, 10, 0)
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
	sum, err := svc.Summary(context.Background(), from, to, "all", true)
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
		"top_matches", "top_news", "top_players", "top_teams",
	} {
		if v := string(fields[key]); v == "" || v == "null" {
			t.Errorf("%s = %q, want a JSON array", key, v)
		}
	}
}

// TestSiteEvents_ContentRankingsAndTicketFunnel runs the per-entity rankings,
// the match before/on/after split and the ticket funnel against real records.
// Every fixture is namespaced ("Fixture FC", "SFFL-TESTFUNNEL") and removed.
func TestSiteEvents_ContentRankingsAndTicketFunnel(t *testing.T) {
	pool := siteEventsPool(t)
	ctx := context.Background()

	cleanup := func() {
		mustExec(t, pool, `DELETE FROM site_events WHERE created_at < $1::timestamptz`, siteEventsFixtureCutoff)
		mustExec(t, pool, `DELETE FROM tickets WHERE email = 'funnel-fixture@example.test'`)
		mustExec(t, pool, `DELETE FROM matches WHERE home_team_id IN (SELECT id FROM teams WHERE name LIKE 'Fixture FC%')`)
		mustExec(t, pool, `DELETE FROM teams WHERE name LIKE 'Fixture FC%'`)
		mustExec(t, pool, `DELETE FROM news WHERE slug = 'fixture-derby-story'`)
		mustExec(t, pool, `DELETE FROM players WHERE name = 'Fixture Player'`)
	}
	cleanup()
	t.Cleanup(cleanup)

	var home, away, matchID, playerID string
	if err := pool.QueryRow(ctx, `INSERT INTO teams (name) VALUES ('Fixture FC Home') RETURNING id::text`).Scan(&home); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO teams (name) VALUES ('Fixture FC Away') RETURNING id::text`).Scan(&away); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO matches (home_team_id, away_team_id, date, time, status) VALUES ($1, $2, '2001-06-10', '16:00', 'FINISHED') RETURNING id::text`, home, away).Scan(&matchID); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO players (name) VALUES ('Fixture Player') RETURNING id::text`).Scan(&playerID); err != nil {
		t.Fatal(err)
	}
	mustExec(t, pool, `INSERT INTO news (title, slug, content) VALUES ('Fixture derby story', 'fixture-derby-story', '<p>x</p>')`)

	matchPath := "/matches/" + matchID
	views := []fixtureEvent{
		// Match: 2 the day before, 3 on the day, 1 after (Lagos dates).
		{at: "2001-06-09T10:00:00Z", typ: "page_view", path: matchPath, ip: "10.0.0.1"},
		{at: "2001-06-09T22:30:00Z", typ: "page_view", path: matchPath, ip: "10.0.0.2"}, // 23:30 Lagos, still the 9th
		{at: "2001-06-09T23:30:00Z", typ: "page_view", path: matchPath, ip: "10.0.0.2"}, // 00:30 Lagos on the 10th
		{at: "2001-06-10T15:00:00Z", typ: "page_view", path: matchPath, ip: "10.0.0.3"},
		{at: "2001-06-10T16:00:00Z", typ: "page_view", path: matchPath, ip: "10.0.0.1"},
		{at: "2001-06-11T09:00:00Z", typ: "page_view", path: matchPath, ip: "10.0.0.4"},
		{at: "2001-06-10T09:00:00Z", typ: "page_view", path: "/matches", ip: "10.0.0.1"},
		// News: two story views; the listing and a deeper path don't count.
		{at: "2001-06-10T09:00:00Z", typ: "page_view", path: "/news/fixture-derby-story", ip: "10.0.0.1"},
		{at: "2001-06-10T09:05:00Z", typ: "page_view", path: "/news/fixture-derby-story", ip: "10.0.0.2"},
		{at: "2001-06-10T09:06:00Z", typ: "page_view", path: "/news", ip: "10.0.0.2"},
		{at: "2001-06-10T09:07:00Z", typ: "page_view", path: "/news/fixture-derby-story/comments", ip: "10.0.0.2"},
		{at: "2001-06-10T09:00:00Z", typ: "page_view", path: "/players/" + playerID, ip: "10.0.0.3"},
		{at: "2001-06-10T09:00:00Z", typ: "page_view", path: "/teams/" + home, ip: "10.0.0.3"},
		{at: "2001-06-10T09:01:00Z", typ: "page_view", path: "/teams/" + home, ip: "10.0.0.4"},
		// Funnel: 3 visitors reach a ticket page, 1 starts checkout.
		{at: "2001-06-10T10:00:00Z", typ: "page_view", path: "/tickets", ip: "10.0.0.1"},
		{at: "2001-06-10T10:00:00Z", typ: "page_view", path: "/tickets", ip: "10.0.0.2"},
		{at: "2001-06-10T10:00:00Z", typ: "page_view", path: "/game-pass", ip: "10.0.0.3"},
		{at: "2001-06-10T10:01:00Z", typ: "ticket_checkout_started", source: "api", path: "/api/v1/tickets/purchase", ip: "10.0.0.1"},
	}
	for _, v := range views {
		insertFixtureEvent(t, pool, v)
	}
	// One paid online order counts; a gift and a team allocation don't.
	mustExec(t, pool, `INSERT INTO tickets (email, unit_price, total_amount, status, paystack_reference, created_at) VALUES
		('funnel-fixture@example.test', 5000, 5000, 'PAID', 'SFFL-TESTFUNNEL1', '2001-06-10T10:05:00Z'),
		('funnel-fixture@example.test', 0, 0, 'PAID', 'SFFL-GIFT-TESTFUNNEL', '2001-06-10T10:05:00Z')`)
	mustExec(t, pool, `INSERT INTO tickets (email, unit_price, total_amount, status, team_id, created_at) VALUES
		('funnel-fixture@example.test', 0, 0, 'PAID', $1, '2001-06-10T10:05:00Z')`, home)

	svc := services.NewSiteEventsService(ports.NewSiteEventsRepository(pool))
	from, to, err := services.ResolveRange("2001-06-01", "2001-06-30", time.Date(2001, 7, 1, 0, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatal(err)
	}
	sum, err := svc.Summary(ctx, from, to, "all", false)
	if err != nil {
		t.Fatalf("Summary: %v", err)
	}

	if len(sum.TopMatches) != 1 {
		t.Fatalf("want 1 match (the /matches listing is not a match), got %+v", sum.TopMatches)
	}
	m := sum.TopMatches[0]
	if m.Label != "Fixture FC Home vs Fixture FC Away" || m.Date != "2001-06-10" || m.Views != 6 || m.Visitors != 4 {
		t.Errorf("match reach wrong: %+v", m)
	}
	if m.BuildUp != 2 || m.MatchDay != 3 || m.After != 1 {
		t.Errorf("before/on/after should follow Lagos dates (2/3/1), got %d/%d/%d", m.BuildUp, m.MatchDay, m.After)
	}

	if len(sum.TopNews) != 1 || sum.TopNews[0].Label != "Fixture derby story" || sum.TopNews[0].Count != 2 {
		t.Errorf("news ranking should hold only the story, titled: %+v", sum.TopNews)
	}
	if len(sum.TopPlayers) != 1 || sum.TopPlayers[0].Label != "Fixture Player" {
		t.Errorf("players ranking wrong: %+v", sum.TopPlayers)
	}
	if len(sum.TopTeams) != 1 || sum.TopTeams[0].Label != "Fixture FC Home" || sum.TopTeams[0].Count != 2 {
		t.Errorf("teams ranking wrong: %+v", sum.TopTeams)
	}

	f := sum.TicketFunnel
	if f.Visitors != 4 || f.TicketPageVisitors != 3 || f.CheckoutStarters != 1 || f.PaidOrders != 1 {
		t.Errorf("ticket funnel wrong (want 4/3/1/1): %+v", f)
	}
}

// TestSiteEvents_MatchDayFilter checks what counts as a match day and that the
// day filter narrows every report. A match day is a date with an event day or
// with a fixture that wasn't called off; dates follow the Lagos calendar.
func TestSiteEvents_MatchDayFilter(t *testing.T) {
	pool := siteEventsPool(t)
	ctx := context.Background()

	cleanup := func() {
		mustExec(t, pool, `DELETE FROM site_events WHERE created_at < $1::timestamptz`, siteEventsFixtureCutoff)
		mustExec(t, pool, `DELETE FROM users WHERE email = 'match-day-fixture@example.test'`)
		mustExec(t, pool, `DELETE FROM matches WHERE home_team_id IN (SELECT id FROM teams WHERE name LIKE 'Fixture MD%')`)
		mustExec(t, pool, `DELETE FROM teams WHERE name LIKE 'Fixture MD%'`)
		mustExec(t, pool, `DELETE FROM event_days WHERE title LIKE 'Fixture Match Day%'`)
	}
	cleanup()
	t.Cleanup(cleanup)

	var home, away string
	if err := pool.QueryRow(ctx, `INSERT INTO teams (name) VALUES ('Fixture MD Home') RETURNING id::text`).Scan(&home); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO teams (name) VALUES ('Fixture MD Away') RETURNING id::text`).Scan(&away); err != nil {
		t.Fatal(err)
	}
	// Aug 4: event day + fixture. Aug 11: fixture only. Aug 18: cancelled
	// fixture (not a match day). Aug 25: event day only.
	mustExec(t, pool, `INSERT INTO event_days (title, date) VALUES ('Fixture Match Day 1', '2001-08-04'), ('Fixture Match Day 4', '2001-08-25')`)
	mustExec(t, pool, `INSERT INTO matches (home_team_id, away_team_id, date, time, status) VALUES
		($1, $2, '2001-08-04', '16:00', 'FINISHED'),
		($1, $2, '2001-08-11', '16:00', 'FINISHED'),
		($1, $2, '2001-08-18', '16:00', 'CANCELLED')`, home, away)

	views := []fixtureEvent{
		{at: "2001-08-04T10:00:00Z", typ: "page_view", path: "/", ip: "20.0.0.1"},
		{at: "2001-08-04T11:00:00Z", typ: "page_view", path: "/matches", ip: "20.0.0.2"},
		{at: "2001-08-04T23:30:00Z", typ: "page_view", path: "/", ip: "20.0.0.3"}, // 00:30 Aug 5 in Lagos
		{at: "2001-08-05T10:00:00Z", typ: "page_view", path: "/", ip: "20.0.0.4"},
		{at: "2001-08-11T10:00:00Z", typ: "page_view", path: "/", ip: "20.0.0.1"},
		{at: "2001-08-11T11:00:00Z", typ: "page_view", path: "/news", ip: "20.0.0.5"},
		{at: "2001-08-11T12:00:00Z", typ: "page_view", path: "/stats", ip: "20.0.0.6"},
		{at: "2001-08-18T10:00:00Z", typ: "page_view", path: "/", ip: "20.0.0.7"},
		{at: "2001-08-25T10:00:00Z", typ: "page_view", path: "/", ip: "20.0.0.8"},
	}
	for _, v := range views {
		insertFixtureEvent(t, pool, v)
	}
	mustExec(t, pool, `INSERT INTO users (full_name, email, created_at) VALUES ('Fixture', 'match-day-fixture@example.test', '2001-08-11T09:00:00Z')`)

	svc := services.NewSiteEventsService(ports.NewSiteEventsRepository(pool))
	from, to, err := services.ResolveRange("2001-08-01", "2001-08-31", time.Date(2001, 9, 1, 0, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatal(err)
	}

	all, err := svc.Summary(ctx, from, to, "all", false)
	if err != nil {
		t.Fatalf("Summary(all): %v", err)
	}
	names := map[string]string{}
	for _, d := range all.MatchDayList {
		names[d.Date] = d.Name()
	}
	if len(all.MatchDayList) != 3 || names["2001-08-04"] != "Fixture Match Day 1" ||
		names["2001-08-11"] != "Fixture MD Home vs Fixture MD Away" || names["2001-08-25"] != "Fixture Match Day 4" {
		t.Fatalf("match days should be Aug 4 (event day), 11 (fixture) and 25 (event day), not the cancelled 18th: %+v", all.MatchDayList)
	}
	if all.Totals.PageViews != 9 {
		t.Errorf("all days: page views = %d, want 9", all.Totals.PageViews)
	}

	match, err := svc.Summary(ctx, from, to, "match", false)
	if err != nil {
		t.Fatalf("Summary(match): %v", err)
	}
	if match.Totals.PageViews != 6 || match.Totals.UniqueVisitors != 5 {
		t.Errorf("match days only: want 6 views from 5 visitors, got %+v", match.Totals)
	}
	if len(match.Daily) != 3 {
		t.Errorf("match-day chart should have one point per match day, got %+v", match.Daily)
	}
	for _, p := range match.Daily {
		if !p.MatchDay || p.MatchDayName == "" {
			t.Errorf("every point should be a named match day, got %+v", p)
		}
	}
	if match.Conversions.NewUsers != 1 {
		t.Errorf("the account created on a match day should count, got %d", match.Conversions.NewUsers)
	}

	other, err := svc.Summary(ctx, from, to, "other", false)
	if err != nil {
		t.Fatalf("Summary(other): %v", err)
	}
	if other.Totals.PageViews != 3 || other.Conversions.NewUsers != 0 {
		t.Errorf("other days: want 3 views (Aug 5 twice, cancelled Aug 18) and no new accounts, got %+v / %+v", other.Totals, other.Conversions)
	}
	for _, p := range other.Daily {
		if p.MatchDay {
			t.Errorf("other-days chart must not include match day %s", p.Date)
		}
	}
	for _, d := range other.MatchDayList {
		if d.Date == "2001-08-04" && d.PageViews != 2 {
			t.Errorf("the match-day list keeps real numbers even when they are filtered out, got %+v", d)
		}
	}

	// The calendar's list: same three match days, with real traffic, never nil.
	list, err := svc.MatchDays(ctx, from, to)
	if err != nil || len(list) != 3 || list[0].Date != "2001-08-04" || list[0].PageViews != 2 || list[0].Visitors != 2 {
		t.Errorf("MatchDays should list Aug 4, 11 and 25 with their traffic: %+v (err %v)", list, err)
	}
	if empty, err := svc.MatchDays(ctx, time.Date(1999, 1, 1, 0, 0, 0, 0, time.UTC), time.Date(1999, 2, 1, 0, 0, 0, 0, time.UTC)); err != nil || empty == nil || len(empty) != 0 {
		t.Errorf("a range with no match days must be an empty list, not null: %v (err %v)", empty, err)
	}

	scope, err := svc.Scope(ctx, from, to, "match")
	if err != nil {
		t.Fatal(err)
	}
	page, err := svc.ListEvents(ctx, ports.SiteEventFilter{SiteScope: scope}, 1, 50)
	if err != nil || page.Total != 6 {
		t.Errorf("raw events for match days: total=%v err=%v, want 6", page, err)
	}

	var report bytes.Buffer
	if err := svc.ExportSummaryCSV(ctx, from, to, "match", false, &report); err != nil {
		t.Fatalf("ExportSummaryCSV: %v", err)
	}
	if out := report.String(); !strings.Contains(out, "Days included,Match days only") || !strings.Contains(out, "Fixture Match Day 1,2001-08-04,") {
		t.Errorf("match-day report should state its filter and list the days:\n%s", out)
	}
}
