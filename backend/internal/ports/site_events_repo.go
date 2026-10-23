package ports

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Day modes narrow a report to, or away from, a set of league-calendar days.
const (
	DaysOnly   = "only"
	DaysExcept = "except"
)

// SiteScope is the slice of time a report covers: [From, To), optionally
// narrowed to (DaysOnly) or away from (DaysExcept) Days, which are YYYY-MM-DD
// dates in Lagos time. An empty DayMode means every day in the range.
type SiteScope struct {
	From    time.Time
	To      time.Time
	DayMode string
	Days    []string
}

// clause renders the scope as SQL over a timestamp column, numbering its
// placeholders from $start. col is always a code literal, never user input.
func (s SiteScope) clause(col string, start int) (string, []any) {
	sql := fmt.Sprintf("%[1]s >= $%[2]d AND %[1]s < $%[3]d", col, start, start+1)
	args := []any{s.From, s.To}
	day := fmt.Sprintf("(%s AT TIME ZONE '%s')::date = ANY(CAST($%d::text[] AS date[]))", col, siteTZ, start+2)
	switch s.DayMode {
	case DaysOnly:
		sql += " AND " + day
		args = append(args, s.Days)
	case DaysExcept:
		sql += " AND NOT " + day
		args = append(args, s.Days)
	}
	return sql, args
}

// SiteEventFilter narrows a raw-event query.
type SiteEventFilter struct {
	SiteScope
	EventType   string
	IncludeBots bool
}

type ISiteEventsRepository interface {
	InsertBatch(ctx context.Context, events []domain.SiteEvent) error
	Totals(ctx context.Context, s SiteScope) (dto.SiteTotals, error)
	Daily(ctx context.Context, s SiteScope) ([]dto.SiteDailyPoint, error)
	Monthly(ctx context.Context, s SiteScope) ([]dto.SiteMonthlyPoint, error)
	Heatmap(ctx context.Context, s SiteScope) ([]dto.SiteHeatCell, error)
	MatchDays(ctx context.Context, from, to time.Time) ([]dto.SiteMatchDay, error)
	PageLabels(ctx context.Context, paths []string) (map[string]string, error)
	EntityRanking(ctx context.Context, kind string, s SiteScope, limit int) ([]dto.SiteBreakdownRow, error)
	TopMatches(ctx context.Context, s SiteScope, limit int) ([]dto.SiteMatchReach, error)
	TicketFunnel(ctx context.Context, s SiteScope) (dto.SiteTicketFunnel, error)
	Breakdown(ctx context.Context, dim string, s SiteScope, limit int) ([]dto.SiteBreakdownRow, error)
	Conversions(ctx context.Context, s SiteScope) (dto.SiteConversions, error)
	ListEvents(ctx context.Context, f SiteEventFilter, limit, offset int) ([]domain.SiteEvent, int, error)
	StreamEvents(ctx context.Context, f SiteEventFilter, fn func(domain.SiteEvent) error) error
}

type PostgresSiteEventsRepository struct {
	db *pgxpool.Pool
}

func NewSiteEventsRepository(db *pgxpool.Pool) ISiteEventsRepository {
	return &PostgresSiteEventsRepository{db: db}
}

// Day buckets follow the league's calendar, not UTC, so a Saturday-night match
// day doesn't spill into Sunday's numbers.
const siteTZ = "Africa/Lagos"

// breakdownDims maps a dimension name to its SQL expression and row filter.
// Only these literals are ever interpolated into SQL — never user input.
var breakdownDims = map[string]struct{ expr, filter string }{
	"page":     {"path", "event_type = 'page_view' AND path IS NOT NULL"},
	"section":  {"CASE WHEN path = '/' THEN 'Home' ELSE initcap(replace(split_part(path, '/', 2), '-', ' ')) END", "event_type = 'page_view' AND path IS NOT NULL"},
	"source":   {"COALESCE(NULLIF(utm_source, ''), NULLIF(referrer_host, ''), 'Direct')", "event_type = 'page_view' AND is_entry"},
	"campaign": {"utm_campaign", "event_type = 'page_view' AND is_entry AND utm_campaign <> ''"},
	"country":  {"COALESCE(NULLIF(country, ''), 'Unknown')", "event_type = 'page_view'"},
	"device":   {"COALESCE(NULLIF(device_type, ''), 'Unknown')", "event_type = 'page_view'"},
	"browser":  {"COALESCE(NULLIF(browser, ''), 'Unknown')", "event_type = 'page_view'"},
	"os":       {"COALESCE(NULLIF(os, ''), 'Unknown')", "event_type = 'page_view'"},
	"action":   {"event_type", "event_type <> 'page_view'"},
}

// nullIfEmpty sends SQL NULL for an empty string, so "unknown" stays NULL in
// the table rather than an empty value the reports would have to special-case.
func nullIfEmpty(v string) any {
	if v == "" {
		return nil
	}
	return v
}

// InsertBatch writes a whole batch in one COPY round trip. CreatedAt is set
// when the event happens, not here, so a 30-second batch delay never shifts a
// visit into the wrong hour or day.
func (r *PostgresSiteEventsRepository) InsertBatch(ctx context.Context, events []domain.SiteEvent) error {
	if len(events) == 0 {
		return nil
	}
	rows := make([][]any, len(events))
	for i, e := range events {
		props := e.Properties
		if props == nil {
			props = map[string]any{}
		}
		rows[i] = []any{
			e.CreatedAt, e.EventType, e.Source, nullIfEmpty(e.Path), e.IsEntry,
			nullIfEmpty(e.ReferrerHost), nullIfEmpty(e.UTMSource), nullIfEmpty(e.UTMMedium),
			nullIfEmpty(e.UTMCampaign), nullIfEmpty(e.SessionID), nullIfEmpty(e.IP),
			nullIfEmpty(e.Country), nullIfEmpty(e.DeviceType), nullIfEmpty(e.Browser),
			nullIfEmpty(e.OS), e.IsBot, nullIfEmpty(e.UserAgent), props,
		}
	}
	_, err := r.db.CopyFrom(ctx, pgx.Identifier{"site_events"}, []string{
		"created_at", "event_type", "source", "path", "is_entry", "referrer_host",
		"utm_source", "utm_medium", "utm_campaign", "session_id", "ip", "country",
		"device_type", "browser", "os", "is_bot", "user_agent", "properties",
	}, pgx.CopyFromRows(rows))
	return err
}

func (r *PostgresSiteEventsRepository) Totals(ctx context.Context, sc SiteScope) (dto.SiteTotals, error) {
	var t dto.SiteTotals
	where, args := sc.clause("created_at", 1)
	err := r.db.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE event_type = 'page_view'),
			COUNT(DISTINCT ip) FILTER (WHERE event_type = 'page_view'),
			COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'page_view'),
			COUNT(*) FILTER (WHERE event_type <> 'page_view')
		FROM site_events
		WHERE `+where+` AND NOT is_bot`, args...,
	).Scan(&t.PageViews, &t.UniqueVisitors, &t.Sessions, &t.ActionEvents)
	if err != nil {
		return t, err
	}
	if err := r.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM site_events WHERE `+where+` AND is_bot`, args...,
	).Scan(&t.BotEventsExcluded); err != nil {
		return t, err
	}

	// Returning = this IP also viewed a page at any time before the period
	// began ($1 is the scope's From).
	eWhere, eArgs := sc.clause("e.created_at", 1)
	if err := r.db.QueryRow(ctx, `
		SELECT COUNT(DISTINCT e.ip)
		FROM site_events e
		WHERE `+eWhere+`
		  AND e.event_type = 'page_view' AND NOT e.is_bot AND e.ip IS NOT NULL
		  AND EXISTS (
			SELECT 1 FROM site_events p
			WHERE p.ip = e.ip AND p.created_at < $1
			  AND p.event_type = 'page_view' AND NOT p.is_bot
		  )`, eArgs...,
	).Scan(&t.ReturningVisitors); err != nil {
		return t, err
	}
	t.NewVisitors = t.UniqueVisitors - t.ReturningVisitors

	var bounced, counted int
	if err := r.db.QueryRow(ctx, `
		SELECT COUNT(*) FILTER (WHERE views = 1), COUNT(*)
		FROM (
			SELECT session_id, COUNT(*) AS views
			FROM site_events
			WHERE `+where+`
			  AND event_type = 'page_view' AND NOT is_bot AND session_id IS NOT NULL
			GROUP BY session_id
		) s`, args...,
	).Scan(&bounced, &counted); err != nil {
		return t, err
	}
	if counted > 0 {
		t.BounceRate = float64(bounced) / float64(counted)
	}
	if t.Sessions > 0 {
		t.PagesPerSession = float64(t.PageViews) / float64(t.Sessions)
	}
	return t, nil
}

func (r *PostgresSiteEventsRepository) Monthly(ctx context.Context, sc SiteScope) ([]dto.SiteMonthlyPoint, error) {
	where, args := sc.clause("created_at", 1)
	rows, err := r.db.Query(ctx, fmt.Sprintf(`
		SELECT to_char(month, 'YYYY-MM'), views, visitors, sessions FROM (
			SELECT date_trunc('month', created_at AT TIME ZONE '%s') AS month,
			       COUNT(*) AS views, COUNT(DISTINCT ip) AS visitors, COUNT(DISTINCT session_id) AS sessions
			FROM site_events
			WHERE %s
			  AND event_type = 'page_view' AND NOT is_bot
			GROUP BY 1
		) m ORDER BY month`, siteTZ, where), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []dto.SiteMonthlyPoint{}
	for rows.Next() {
		var p dto.SiteMonthlyPoint
		if err := rows.Scan(&p.Month, &p.PageViews, &p.Visitors, &p.Sessions); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *PostgresSiteEventsRepository) Heatmap(ctx context.Context, sc SiteScope) ([]dto.SiteHeatCell, error) {
	where, args := sc.clause("created_at", 1)
	rows, err := r.db.Query(ctx, fmt.Sprintf(`
		SELECT EXTRACT(ISODOW FROM created_at AT TIME ZONE '%[1]s')::int,
		       EXTRACT(HOUR FROM created_at AT TIME ZONE '%[1]s')::int,
		       COUNT(*)
		FROM site_events
		WHERE %[2]s
		  AND event_type = 'page_view' AND NOT is_bot
		GROUP BY 1, 2
		ORDER BY 1, 2`, siteTZ, where), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []dto.SiteHeatCell{}
	for rows.Next() {
		var c dto.SiteHeatCell
		if err := rows.Scan(&c.Weekday, &c.Hour, &c.PageViews); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// MatchDays lists the league-calendar days in [from, to) that are match days:
// a day with an event day (the ticketing record, which carries the title shown
// on the dashboard) or with at least one fixture that wasn't called off.
// Not every fixture date has an event day and not every event day has
// fixtures entered, so either one counts.
func (r *PostgresSiteEventsRepository) MatchDays(ctx context.Context, from, to time.Time) ([]dto.SiteMatchDay, error) {
	rows, err := r.db.Query(ctx, fmt.Sprintf(`
		WITH bounds AS (
			SELECT ($1 AT TIME ZONE '%[1]s')::date AS lo, ($2 AT TIME ZONE '%[1]s')::date AS hi
		),
		fixtures AS (
			SELECT m.date, COUNT(*) AS n,
			       string_agg(COALESCE(h.name, 'TBD') || ' vs ' || COALESCE(a.name, 'TBD'), ', ' ORDER BY m.time, h.name) AS games
			FROM matches m
			LEFT JOIN teams h ON h.id = m.home_team_id
			LEFT JOIN teams a ON a.id = m.away_team_id, bounds
			WHERE m.date >= bounds.lo AND m.date < bounds.hi
			  AND m.status NOT IN ('CANCELLED', 'POSTPONED')
			GROUP BY m.date
		),
		days AS (
			SELECT date, string_agg(title, ' / ' ORDER BY title) AS title
			FROM event_days, bounds
			WHERE date >= bounds.lo AND date < bounds.hi
			GROUP BY date
		)
		SELECT to_char(COALESCE(d.date, f.date), 'YYYY-MM-DD'),
		       COALESCE(d.title, ''), COALESCE(f.n, 0), COALESCE(f.games, '')
		FROM days d
		FULL JOIN fixtures f ON f.date = d.date
		ORDER BY 1`, siteTZ), from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []dto.SiteMatchDay{}
	for rows.Next() {
		var d dto.SiteMatchDay
		if err := rows.Scan(&d.Date, &d.Title, &d.Fixtures, &d.Games); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

// pageLabelQueries resolves a detail page's id or slug to something a person
// can read. Each query takes the candidate keys as $1 and returns (key, label).
var pageLabelQueries = map[string]string{
	"news": `SELECT slug, title FROM news WHERE slug = ANY($1)
	         UNION ALL SELECT id::text, title FROM news WHERE id::text = ANY($1)`,
	"matches": `SELECT m.id::text,
	                   COALESCE(h.name, 'TBD') || ' vs ' || COALESCE(a.name, 'TBD') || ' (' || to_char(m.date, 'DD Mon YYYY') || ')'
	            FROM matches m
	            LEFT JOIN teams h ON h.id = m.home_team_id
	            LEFT JOIN teams a ON a.id = m.away_team_id
	            WHERE m.id::text = ANY($1)`,
	"players":  `SELECT id::text, name FROM players WHERE id::text = ANY($1)`,
	"teams":    `SELECT id::text, name FROM teams WHERE id::text = ANY($1)`,
	"products": `SELECT id::text, name FROM store_products WHERE id::text = ANY($1)`,
}

// pageEntity splits a detail-page path into its entity kind and key, e.g.
// "/news/derby-preview" -> ("news", "derby-preview"). Anything else returns "".
func pageEntity(path string) (string, string) {
	parts := strings.Split(strings.Trim(path, "/"), "/")
	switch {
	case len(parts) == 2 && (parts[0] == "news" || parts[0] == "matches" || parts[0] == "players" || parts[0] == "teams"):
		return parts[0], parts[1]
	case len(parts) == 3 && parts[0] == "store" && parts[1] == "products":
		return "products", parts[2]
	}
	return "", ""
}

// PageLabels maps each detail-page path to a readable title. Paths that aren't
// detail pages, or whose record no longer exists, are simply left out.
func (r *PostgresSiteEventsRepository) PageLabels(ctx context.Context, paths []string) (map[string]string, error) {
	keysByKind := map[string][]string{}
	pathsByKey := map[string][]string{}
	for _, p := range paths {
		kind, key := pageEntity(p)
		if kind == "" {
			continue
		}
		keysByKind[kind] = append(keysByKind[kind], key)
		pathsByKey[kind+"\x00"+key] = append(pathsByKey[kind+"\x00"+key], p)
	}

	out := map[string]string{}
	for kind, keys := range keysByKind {
		rows, err := r.db.Query(ctx, pageLabelQueries[kind], keys)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var key, label string
			if err := rows.Scan(&key, &label); err != nil {
				rows.Close()
				return nil, err
			}
			for _, p := range pathsByKey[kind+"\x00"+key] {
				out[p] = label
			}
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return nil, err
		}
	}
	return out, nil
}

func (r *PostgresSiteEventsRepository) Daily(ctx context.Context, sc SiteScope) ([]dto.SiteDailyPoint, error) {
	where, args := sc.clause("created_at", 1)
	rows, err := r.db.Query(ctx, fmt.Sprintf(`
		SELECT to_char(day, 'YYYY-MM-DD'), views, visitors FROM (
			SELECT date_trunc('day', created_at AT TIME ZONE '%s') AS day,
			       COUNT(*) AS views, COUNT(DISTINCT ip) AS visitors
			FROM site_events
			WHERE %s
			  AND event_type = 'page_view' AND NOT is_bot
			GROUP BY 1
		) d ORDER BY day`, siteTZ, where), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []dto.SiteDailyPoint{}
	for rows.Next() {
		var p dto.SiteDailyPoint
		if err := rows.Scan(&p.Date, &p.PageViews, &p.Visitors); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *PostgresSiteEventsRepository) Breakdown(ctx context.Context, dim string, sc SiteScope, limit int) ([]dto.SiteBreakdownRow, error) {
	d, ok := breakdownDims[dim]
	if !ok {
		return nil, fmt.Errorf("unknown breakdown dimension %q", dim)
	}
	where, args := sc.clause("created_at", 1)
	args = append(args, limit)
	rows, err := r.db.Query(ctx, fmt.Sprintf(`
		SELECT %s AS name, COUNT(*) AS cnt, COUNT(DISTINCT ip) AS visitors
		FROM site_events
		WHERE %s AND NOT is_bot AND %s
		GROUP BY 1
		ORDER BY cnt DESC, name
		LIMIT $%d`, d.expr, where, d.filter, len(args)), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []dto.SiteBreakdownRow{}
	for rows.Next() {
		var b dto.SiteBreakdownRow
		if err := rows.Scan(&b.Name, &b.Count, &b.Visitors); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// Conversions counts from the source-of-truth tables, narrowed by the same
// scope, so "match days only" means accounts, tickets and orders created on
// match days.
func (r *PostgresSiteEventsRepository) Conversions(ctx context.Context, sc SiteScope) (dto.SiteConversions, error) {
	var c dto.SiteConversions
	where, args := sc.clause("created_at", 1)
	if err := r.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM users WHERE `+where, args...,
	).Scan(&c.NewUsers); err != nil {
		return c, err
	}
	if err := r.db.QueryRow(ctx, `
		SELECT COUNT(*), COALESCE(SUM(quantity), 0), COALESCE(SUM(total_amount), 0)
		FROM tickets
		WHERE status IN ('PAID', 'USED') AND purchase_type <> 'PLAYER' AND `+where, args...,
	).Scan(&c.TicketOrders, &c.TicketsSold, &c.TicketRevenue); err != nil {
		return c, err
	}
	err := r.db.QueryRow(ctx, `
		SELECT COUNT(*), COALESCE(SUM(total_amount), 0)::float8
		FROM online_orders
		WHERE payment_status = 'paid' AND `+where, args...,
	).Scan(&c.StoreOrders, &c.StoreRevenue)
	return c, err
}

func (f SiteEventFilter) where() (string, []any) {
	clause, args := f.SiteScope.clause("created_at", 1)
	if !f.IncludeBots {
		clause += " AND NOT is_bot"
	}
	if f.EventType != "" {
		args = append(args, f.EventType)
		clause += fmt.Sprintf(" AND event_type = $%d", len(args))
	}
	return clause, args
}

const siteEventColumns = `
	id, created_at, event_type, source, COALESCE(path, ''), is_entry,
	COALESCE(referrer_host, ''), COALESCE(utm_source, ''), COALESCE(utm_medium, ''),
	COALESCE(utm_campaign, ''), COALESCE(session_id, ''), COALESCE(ip, ''),
	COALESCE(country, ''), COALESCE(device_type, ''), COALESCE(browser, ''),
	COALESCE(os, ''), is_bot, COALESCE(user_agent, ''), properties`

type rowScanner interface {
	Scan(dest ...any) error
}

func scanSiteEvent(row rowScanner) (domain.SiteEvent, error) {
	var e domain.SiteEvent
	var props []byte
	err := row.Scan(
		&e.ID, &e.CreatedAt, &e.EventType, &e.Source, &e.Path, &e.IsEntry,
		&e.ReferrerHost, &e.UTMSource, &e.UTMMedium, &e.UTMCampaign, &e.SessionID, &e.IP,
		&e.Country, &e.DeviceType, &e.Browser, &e.OS, &e.IsBot, &e.UserAgent, &props,
	)
	if err != nil {
		return e, err
	}
	if len(props) > 0 {
		_ = json.Unmarshal(props, &e.Properties)
	}
	return e, nil
}

func (r *PostgresSiteEventsRepository) ListEvents(ctx context.Context, f SiteEventFilter, limit, offset int) ([]domain.SiteEvent, int, error) {
	where, args := f.where()

	var total int
	if err := r.db.QueryRow(ctx, "SELECT COUNT(*) FROM site_events WHERE "+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	args = append(args, limit, offset)
	rows, err := r.db.Query(ctx, fmt.Sprintf(
		"SELECT %s FROM site_events WHERE %s ORDER BY created_at DESC, id DESC LIMIT $%d OFFSET $%d",
		siteEventColumns, where, len(args)-1, len(args)), args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var out []domain.SiteEvent
	for rows.Next() {
		e, err := scanSiteEvent(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, e)
	}
	return out, total, rows.Err()
}

// StreamEvents walks every matching row in time order without loading the
// range into memory, so an all-time export stays cheap however large the table
// grows.
func (r *PostgresSiteEventsRepository) StreamEvents(ctx context.Context, f SiteEventFilter, fn func(domain.SiteEvent) error) error {
	where, args := f.where()
	rows, err := r.db.Query(ctx, fmt.Sprintf(
		"SELECT %s FROM site_events WHERE %s ORDER BY created_at, id", siteEventColumns, where), args...)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		e, err := scanSiteEvent(rows)
		if err != nil {
			return err
		}
		if err := fn(e); err != nil {
			return err
		}
	}
	return rows.Err()
}

// entityPrefixes are the detail pages that get their own ranking. Only
// these literals reach SQL.
var entityPrefixes = map[string]string{
	"news":    "/news/",
	"players": "/players/",
	"teams":   "/teams/",
}

// EntityRanking ranks the detail pages of one kind ("/news/<slug>", ...) by
// page views. Listing pages ("/news") and deeper paths are excluded.
func (r *PostgresSiteEventsRepository) EntityRanking(ctx context.Context, kind string, sc SiteScope, limit int) ([]dto.SiteBreakdownRow, error) {
	prefix, ok := entityPrefixes[kind]
	if !ok {
		return nil, fmt.Errorf("unknown entity kind %q", kind)
	}
	where, args := sc.clause("created_at", 1)
	args = append(args, prefix, limit)
	p, l := len(args)-1, len(args)
	rows, err := r.db.Query(ctx, fmt.Sprintf(`
		SELECT path, COUNT(*) AS views, COUNT(DISTINCT ip) AS visitors
		FROM site_events
		WHERE %[1]s
		  AND event_type = 'page_view' AND NOT is_bot
		  AND starts_with(path, $%[2]d)
		  AND length(path) > length($%[2]d)
		  AND strpos(substr(path, length($%[2]d) + 1), '/') = 0
		GROUP BY path
		ORDER BY views DESC, path
		LIMIT $%[3]d`, where, p, l), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []dto.SiteBreakdownRow{}
	for rows.Next() {
		var b dto.SiteBreakdownRow
		if err := rows.Scan(&b.Name, &b.Count, &b.Visitors); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// TopMatches ranks match pages by views in the period and splits each match's
// views into before, on and after its match day (Lagos dates).
func (r *PostgresSiteEventsRepository) TopMatches(ctx context.Context, sc SiteScope, limit int) ([]dto.SiteMatchReach, error) {
	where, args := sc.clause("e.created_at", 1)
	args = append(args, limit)
	rows, err := r.db.Query(ctx, fmt.Sprintf(`
		SELECT m.id::text,
		       COALESCE(h.name, 'TBD') || ' vs ' || COALESCE(a.name, 'TBD'),
		       to_char(m.date, 'YYYY-MM-DD'),
		       COUNT(*),
		       COUNT(DISTINCT e.ip),
		       COUNT(*) FILTER (WHERE (e.created_at AT TIME ZONE '%[1]s')::date < m.date),
		       COUNT(*) FILTER (WHERE (e.created_at AT TIME ZONE '%[1]s')::date = m.date),
		       COUNT(*) FILTER (WHERE (e.created_at AT TIME ZONE '%[1]s')::date > m.date)
		FROM site_events e
		JOIN matches m ON e.path = '/matches/' || m.id::text
		LEFT JOIN teams h ON h.id = m.home_team_id
		LEFT JOIN teams a ON a.id = m.away_team_id
		WHERE %[2]s
		  AND e.event_type = 'page_view' AND NOT e.is_bot
		GROUP BY m.id, h.name, a.name, m.date
		ORDER BY COUNT(*) DESC, m.date DESC
		LIMIT $%[3]d`, siteTZ, where, len(args)), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []dto.SiteMatchReach{}
	for rows.Next() {
		var m dto.SiteMatchReach
		if err := rows.Scan(&m.MatchID, &m.Label, &m.Date, &m.Views, &m.Visitors, &m.BuildUp, &m.MatchDay, &m.After); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// TicketFunnel counts distinct visitors at each step toward a ticket, then the
// online orders actually paid. Online purchases carry an "SFFL-" payment
// reference; gifts use "SFFL-GIFT-" and team allocations have no reference.
func (r *PostgresSiteEventsRepository) TicketFunnel(ctx context.Context, sc SiteScope) (dto.SiteTicketFunnel, error) {
	var f dto.SiteTicketFunnel
	where, args := sc.clause("created_at", 1)
	if err := r.db.QueryRow(ctx, `
		SELECT
			COUNT(DISTINCT ip) FILTER (WHERE event_type = 'page_view'),
			COUNT(DISTINCT ip) FILTER (WHERE event_type = 'page_view' AND path IN ('/tickets', '/game-pass')),
			COUNT(DISTINCT ip) FILTER (WHERE event_type = 'ticket_checkout_started')
		FROM site_events
		WHERE `+where+` AND NOT is_bot`, args...,
	).Scan(&f.Visitors, &f.TicketPageVisitors, &f.CheckoutStarters); err != nil {
		return f, err
	}
	err := r.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM tickets
		WHERE status IN ('PAID', 'USED')
		  AND paystack_reference LIKE 'SFFL-%' AND paystack_reference NOT LIKE 'SFFL-GIFT-%'
		  AND team_id IS NULL
		  AND `+where, args...,
	).Scan(&f.PaidOrders)
	return f, err
}
