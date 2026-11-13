package ports

import (
	"context"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"showtime-backend/internal/domain"
)

// ─── What counts as a repeat customer ────────────────────────────────────────
//
// A ticket is a repeat purchase when the same person paid for another ticket on
// an earlier calendar day (Lagos time). "The same person" is the same email, or
// the same phone number when it has at least 10 digits, so changing one of the
// two does not make a returning buyer look new.
//
// Only real purchases count on either side: paid or used, not a player's free
// ticket, and not a gift or comp (it has no amount). Buying twice on the same
// day is one visit, not a return.

// phoneKey is the last 10 digits of a ticket's phone, or NULL when there are
// fewer than 10, so 0803… and +234803… match and a short typo never does.
func phoneKey(alias string) string {
	digits := `REGEXP_REPLACE(COALESCE(` + alias + `.phone, ''), '\D', '', 'g')`
	return `(CASE WHEN LENGTH(` + digits + `) >= 10 THEN RIGHT(` + digits + `, 10) END)`
}

// isRealSale is true for a ticket somebody paid for.
const isRealSale = `%s.status IN ('PAID', 'USED') AND %s.purchase_type <> 'PLAYER' AND %s.total_amount > 0`

func realSale(alias string) string {
	return strings.ReplaceAll(isRealSale, "%s", alias)
}

// priorPurchasesJoin attaches, to a ticket aliased t, how many earlier real
// purchases the same person made (prior.n) and when the first one was
// (prior.first_at).
var priorPurchasesJoin = `LEFT JOIN LATERAL (
	SELECT COUNT(*) AS n, MIN(p.created_at) AS first_at
	FROM tickets p
	WHERE p.id <> t.id AND ` + realSale("p") + `
	  AND (p.created_at AT TIME ZONE 'Africa/Lagos')::date < (t.created_at AT TIME ZONE 'Africa/Lagos')::date
	  AND (LOWER(p.email) = LOWER(t.email)
	       OR (` + phoneKey("t") + ` IS NOT NULL AND ` + phoneKey("p") + ` = ` + phoneKey("t") + `))
) prior ON TRUE`

// loadPriorPurchases sets PriorPurchases on every ticket that was a real sale.
// Any other ticket is left nil, which the admin screen shows as "—".
func loadPriorPurchases(ctx context.Context, db interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
}, tickets []*domain.Ticket) error {
	if len(tickets) == 0 {
		return nil
	}
	ids := make([]string, len(tickets))
	byID := make(map[string]*domain.Ticket, len(tickets))
	for i, t := range tickets {
		ids[i] = t.ID
		byID[t.ID] = t
	}
	rows, err := db.Query(ctx, `
		SELECT t.id::text, prior.n
		FROM tickets t `+priorPurchasesJoin+`
		WHERE t.id = ANY($1::uuid[]) AND `+realSale("t"), ids)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		var n int
		if err := rows.Scan(&id, &n); err != nil {
			return err
		}
		if t, ok := byID[id]; ok {
			count := n
			t.PriorPurchases = &count
		}
	}
	return rows.Err()
}

// ─── Weekly repeat-customer report ───────────────────────────────────────────

// RepeatCustomerDay is one match day's buyers and how many of them had bought before.
type RepeatCustomerDay struct {
	EventDayID string
	Title      string
	Date       string
	Buyers     int
	Returning  int
}

// RepeatCustomer is one returning buyer for a match day.
type RepeatCustomer struct {
	Name           string
	Email          string
	Phone          string
	Tickets        int
	Spent          int
	PriorPurchases int
	FirstBoughtAt  time.Time
}

// salesCTE is every real sale on a match day with how often that buyer had
// bought before. A Game Pass appears once for each match day it covers.
var salesCTE = `WITH sales AS (
	SELECT t.id, td.event_day_id, LOWER(t.email) AS email, t.email AS raw_email,
	       COALESCE(t.name, '') AS name, COALESCE(t.phone, '') AS phone,
	       t.quantity, t.total_amount, t.created_at,
	       COALESCE(prior.n, 0) AS prior_n, prior.first_at
	FROM tickets t
	JOIN ticket_days td ON td.ticket_id = t.id
	` + priorPurchasesJoin + `
	WHERE ` + realSale("t") + `
)`

// RepeatCustomerDays lists every match day that sold tickets, newest first.
func (r *PostgresAnalyticsRepository) RepeatCustomerDays(ctx context.Context) ([]RepeatCustomerDay, error) {
	rows, err := r.db.Query(ctx, salesCTE+`
		SELECT ed.id::text, ed.title, to_char(ed.date, 'YYYY-MM-DD'),
		       COUNT(DISTINCT s.email),
		       COUNT(DISTINCT s.email) FILTER (WHERE s.prior_n > 0)
		FROM sales s
		JOIN event_days ed ON ed.id = s.event_day_id
		GROUP BY ed.id, ed.title, ed.date
		ORDER BY ed.date DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	days := []RepeatCustomerDay{}
	for rows.Next() {
		var d RepeatCustomerDay
		if err := rows.Scan(&d.EventDayID, &d.Title, &d.Date, &d.Buyers, &d.Returning); err != nil {
			return nil, err
		}
		days = append(days, d)
	}
	return days, rows.Err()
}

// RepeatCustomers lists the returning buyers for one match day, most visits first.
func (r *PostgresAnalyticsRepository) RepeatCustomers(ctx context.Context, eventDayID string) ([]RepeatCustomer, error) {
	rows, err := r.db.Query(ctx, salesCTE+`
		SELECT (ARRAY_AGG(s.name ORDER BY s.created_at DESC))[1],
		       (ARRAY_AGG(s.raw_email ORDER BY s.created_at DESC))[1],
		       (ARRAY_AGG(s.phone ORDER BY s.created_at DESC))[1],
		       SUM(s.quantity)::int, SUM(s.total_amount)::int,
		       MAX(s.prior_n)::int, MIN(s.first_at)
		FROM sales s
		WHERE s.event_day_id = $1::uuid
		GROUP BY s.email
		HAVING MAX(s.prior_n) > 0
		ORDER BY MAX(s.prior_n) DESC, s.email ASC`, eventDayID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []RepeatCustomer{}
	for rows.Next() {
		var c RepeatCustomer
		if err := rows.Scan(&c.Name, &c.Email, &c.Phone, &c.Tickets, &c.Spent, &c.PriorPurchases, &c.FirstBoughtAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}
