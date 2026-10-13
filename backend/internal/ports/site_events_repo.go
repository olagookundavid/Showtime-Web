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

// SiteEventFilter narrows a raw-event query. From is inclusive, To exclusive.
type SiteEventFilter struct {
	From        time.Time
	To          time.Time
	EventType   string
	IncludeBots bool
}

type ISiteEventsRepository interface {
	InsertBatch(ctx context.Context, events []domain.SiteEvent) error
	Totals(ctx context.Context, from, to time.Time) (dto.SiteTotals, error)
	Daily(ctx context.Context, from, to time.Time) ([]dto.SiteDailyPoint, error)
	Monthly(ctx context.Context, from, to time.Time) ([]dto.SiteMonthlyPoint, error)
	Heatmap(ctx context.Context, from, to time.Time) ([]dto.SiteHeatCell, error)
	MatchDates(ctx context.Context, from, to time.Time) (map[string]bool, error)
	PageLabels(ctx context.Context, paths []string) (map[string]string, error)
	EntityRanking(ctx context.Context, kind string, from, to time.Time, limit int) ([]dto.SiteBreakdownRow, error)
	TopMatches(ctx context.Context, from, to time.Time, limit int) ([]dto.SiteMatchReach, error)
	TicketFunnel(ctx context.Context, from, to time.Time) (dto.SiteTicketFunnel, error)
	Breakdown(ctx context.Context, dim string, from, to time.Time, limit int) ([]dto.SiteBreakdownRow, error)
	Conversions(ctx context.Context, from, to time.Time) (dto.SiteConversions, error)
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

func (r *PostgresSiteEventsRepository) Totals(ctx context.Context, from, to time.Time) (dto.SiteTotals, error) {
	var t dto.SiteTotals
	err := r.db.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE event_type = 'page_view'),
			COUNT(DISTINCT ip) FILTER (WHERE event_type = 'page_view'),
			COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'page_view'),
			COUNT(*) FILTER (WHERE event_type <> 'page_view')
		FROM site_events
		WHERE created_at >= $1 AND created_at < $2 AND NOT is_bot`, from, to,
	).Scan(&t.PageViews, &t.UniqueVisitors, &t.Sessions, &t.ActionEvents)
	if err != nil {
		return t, err
	}
	if err := r.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM site_events WHERE created_at >= $1 AND created_at < $2 AND is_bot`, from, to,
	).Scan(&t.BotEventsExcluded); err != nil {
		return t, err
	}

	// Returning = this IP also viewed a page at any time before the period began.
	if err := r.db.QueryRow(ctx, `
		SELECT COUNT(DISTINCT e.ip)
		FROM site_events e
		WHERE e.created_at >= $1 AND e.created_at < $2
		  AND e.event_type = 'page_view' AND NOT e.is_bot AND e.ip IS NOT NULL
		  AND EXISTS (
			SELECT 1 FROM site_events p
			WHERE p.ip = e.ip AND p.created_at < $1
			  AND p.event_type = 'page_view' AND NOT p.is_bot
		  )`, from, to,
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
			WHERE created_at >= $1 AND created_at < $2
			  AND event_type = 'page_view' AND NOT is_bot AND session_id IS NOT NULL
			GROUP BY session_id
		) s`, from, to,
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

func (r *PostgresSiteEventsRepository) Monthly(ctx context.Context, from, to time.Time) ([]dto.SiteMonthlyPoint, error) {
	rows, err := r.db.Query(ctx, fmt.Sprintf(`
		SELECT to_char(month, 'YYYY-MM'), views, visitors, sessions FROM (
			SELECT date_trunc('month', created_at AT TIME ZONE '%s') AS month,
			       COUNT(*) AS views, COUNT(DISTINCT ip) AS visitors, COUNT(DISTINCT session_id) AS sessions
			FROM site_events
			WHERE created_at >= $1 AND created_at < $2
			  AND event_type = 'page_view' AND NOT is_bot
			GROUP BY 1
		) m ORDER BY month`, siteTZ), from, to)
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

func (r *PostgresSiteEventsRepository) Heatmap(ctx context.Context, from, to time.Time) ([]dto.SiteHeatCell, error) {
	rows, err := r.db.Query(ctx, fmt.Sprintf(`
		SELECT EXTRACT(ISODOW FROM created_at AT TIME ZONE '%[1]s')::int,
		       EXTRACT(HOUR FROM created_at AT TIME ZONE '%[1]s')::int,
		       COUNT(*)
		FROM site_events
		WHERE created_at >= $1 AND created_at < $2
		  AND event_type = 'page_view' AND NOT is_bot
		GROUP BY 1, 2
		ORDER BY 1, 2`, siteTZ), from, to)
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

// MatchDates returns the league-calendar dates (YYYY-MM-DD) in [from, to) that
// had at least one fixture that wasn't called off.
func (r *PostgresSiteEventsRepository) MatchDates(ctx context.Context, from, to time.Time) (map[string]bool, error) {
	rows, err := r.db.Query(ctx, fmt.Sprintf(`
		SELECT DISTINCT to_char(date, 'YYYY-MM-DD')
		FROM matches
		WHERE date >= ($1 AT TIME ZONE '%[1]s')::date
		  AND date <  ($2 AT TIME ZONE '%[1]s')::date
		  AND status NOT IN ('CANCELLED', 'POSTPONED')`, siteTZ), from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := map[string]bool{}
	for rows.Next() {
		var d string
		if err := rows.Scan(&d); err != nil {
			return nil, err
		}
		out[d] = true
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

func (r *PostgresSiteEventsRepository) Daily(ctx context.Context, from, to time.Time) ([]dto.SiteDailyPoint, error) {
	rows, err := r.db.Query(ctx, fmt.Sprintf(`
		SELECT to_char(day, 'YYYY-MM-DD'), views, visitors FROM (
			SELECT date_trunc('day', created_at AT TIME ZONE '%s') AS day,
			       COUNT(*) AS views, COUNT(DISTINCT ip) AS visitors
			FROM site_events
			WHERE created_at >= $1 AND created_at < $2
			  AND event_type = 'page_view' AND NOT is_bot
			GROUP BY 1
		) d ORDER BY day`, siteTZ), from, to)
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

func (r *PostgresSiteEventsRepository) Breakdown(ctx context.Context, dim string, from, to time.Time, limit int) ([]dto.SiteBreakdownRow, error) {
	d, ok := breakdownDims[dim]
	if !ok {
		return nil, fmt.Errorf("unknown breakdown dimension %q", dim)
	}
	rows, err := r.db.Query(ctx, fmt.Sprintf(`
		SELECT %s AS name, COUNT(*) AS cnt, COUNT(DISTINCT ip) AS visitors
		FROM site_events
		WHERE created_at >= $1 AND created_at < $2 AND NOT is_bot AND %s
		GROUP BY 1
		ORDER BY cnt DESC, name
		LIMIT $3`, d.expr, d.filter), from, to, limit)
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

func (r *PostgresSiteEventsRepository) Conversions(ctx context.Context, from, to time.Time) (dto.SiteConversions, error) {
	var c dto.SiteConversions
	if err := r.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM users WHERE created_at >= $1 AND created_at < $2`, from, to,
	).Scan(&c.NewUsers); err != nil {
		return c, err
	}
	if err := r.db.QueryRow(ctx, `
		SELECT COUNT(*), COALESCE(SUM(quantity), 0), COALESCE(SUM(total_amount), 0)
		FROM tickets
		WHERE status IN ('PAID', 'USED') AND created_at >= $1 AND created_at < $2`, from, to,
	).Scan(&c.TicketOrders, &c.TicketsSold, &c.TicketRevenue); err != nil {
		return c, err
	}
	err := r.db.QueryRow(ctx, `
		SELECT COUNT(*), COALESCE(SUM(total_amount), 0)::float8
		FROM online_orders
		WHERE payment_status = 'paid' AND created_at >= $1 AND created_at < $2`, from, to,
	).Scan(&c.StoreOrders, &c.StoreRevenue)
	return c, err
}

func (f SiteEventFilter) where() (string, []any) {
	clause := "created_at >= $1 AND created_at < $2"
	args := []any{f.From, f.To}
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
func (r *PostgresSiteEventsRepository) EntityRanking(ctx context.Context, kind string, from, to time.Time, limit int) ([]dto.SiteBreakdownRow, error) {
	prefix, ok := entityPrefixes[kind]
	if !ok {
		return nil, fmt.Errorf("unknown entity kind %q", kind)
	}
	rows, err := r.db.Query(ctx, `
		SELECT path, COUNT(*) AS views, COUNT(DISTINCT ip) AS visitors
		FROM site_events
		WHERE created_at >= $1 AND created_at < $2
		  AND event_type = 'page_view' AND NOT is_bot
		  AND starts_with(path, $3)
		  AND length(path) > length($3)
		  AND strpos(substr(path, length($3) + 1), '/') = 0
		GROUP BY path
		ORDER BY views DESC, path
		LIMIT $4`, from, to, prefix, limit)
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
func (r *PostgresSiteEventsRepository) TopMatches(ctx context.Context, from, to time.Time, limit int) ([]dto.SiteMatchReach, error) {
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
		WHERE e.created_at >= $1 AND e.created_at < $2
		  AND e.event_type = 'page_view' AND NOT e.is_bot
		GROUP BY m.id, h.name, a.name, m.date
		ORDER BY COUNT(*) DESC, m.date DESC
		LIMIT $3`, siteTZ), from, to, limit)
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
func (r *PostgresSiteEventsRepository) TicketFunnel(ctx context.Context, from, to time.Time) (dto.SiteTicketFunnel, error) {
	var f dto.SiteTicketFunnel
	if err := r.db.QueryRow(ctx, `
		SELECT
			COUNT(DISTINCT ip) FILTER (WHERE event_type = 'page_view'),
			COUNT(DISTINCT ip) FILTER (WHERE event_type = 'page_view' AND path IN ('/tickets', '/game-pass')),
			COUNT(DISTINCT ip) FILTER (WHERE event_type = 'ticket_checkout_started')
		FROM site_events
		WHERE created_at >= $1 AND created_at < $2 AND NOT is_bot`, from, to,
	).Scan(&f.Visitors, &f.TicketPageVisitors, &f.CheckoutStarters); err != nil {
		return f, err
	}
	err := r.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM tickets
		WHERE status IN ('PAID', 'USED')
		  AND paystack_reference LIKE 'SFFL-%' AND paystack_reference NOT LIKE 'SFFL-GIFT-%'
		  AND team_id IS NULL
		  AND created_at >= $1 AND created_at < $2`, from, to,
	).Scan(&f.PaidOrders)
	return f, err
}
