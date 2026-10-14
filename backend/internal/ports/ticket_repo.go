package ports

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"showtime-backend/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ═══════════════════════════════════════════════════════════════════════════════
// Interfaces
// ═══════════════════════════════════════════════════════════════════════════════

type EventDayRepository interface {
	Create(ctx context.Context, ed *domain.EventDay) error
	GetByID(ctx context.Context, id string) (*domain.EventDay, error)
	GetByDate(ctx context.Context, date string) (*domain.EventDay, error)
	ListActive(ctx context.Context) ([]domain.EventDay, error)
	ListAll(ctx context.Context, search string, page, limit int) ([]domain.EventDay, int, error)
	Update(ctx context.Context, id string, title *string, date *time.Time, venue *string, isActive *bool) error
	Delete(ctx context.Context, id string) error
}

// TicketProductRepository owns tickets (products), the competitions they are
// linked to, the match days those links put on sale, and the Game Pass ladder.
type TicketProductRepository interface {
	CreateProduct(ctx context.Context, p *domain.TicketProduct) error
	// UpdateProduct saves the ticket. It refuses a seat limit below what is
	// already sold or being paid for on any match day.
	UpdateProduct(ctx context.Context, p *domain.TicketProduct) error
	// GetProduct returns the ticket with its competitions (no days).
	GetProduct(ctx context.Context, id string) (*domain.TicketProduct, error)
	// ListProducts returns tickets with their competitions and every match day
	// those competitions put on sale, past ones included, with seat counts.
	ListProducts(ctx context.Context, activeOnly bool) ([]domain.TicketProduct, error)
	DeleteProduct(ctx context.Context, id string) error

	// SetProductCompetitions replaces the competitions a ticket is linked to.
	SetProductCompetitions(ctx context.Context, productID string, competitionIDs []string) error
	// EnsureEventDays creates a match day (event day) for every date that has a
	// match in a competition linked to an active ticket and none yet. Match days
	// are what tickets are bought for, and not every competition has them.
	EnsureEventDays(ctx context.Context) error
	// ResolveProductDays checks which of the given match days are on sale for the
	// ticket (through its linked competitions), makes sure each has its seat-lock
	// row, and returns them with price and seat counts. A day that is not on sale
	// is simply absent, so callers compare lengths.
	ResolveProductDays(ctx context.Context, productID string, eventDayIDs []string) ([]domain.TicketProductDay, error)

	ListGamePassRules(ctx context.Context) ([]domain.GamePassRule, error)
	ReplaceGamePassRules(ctx context.Context, rules []domain.GamePassRule) error
}

type TicketRepository interface {
	// Create reserves seats on every day in ticket.Days and inserts the ticket, all
	// in one transaction. Each TicketDay needs EventDayID, ProductDayID and
	// UnitPrice set.
	Create(ctx context.Context, ticket *domain.Ticket) error
	GetByID(ctx context.Context, id string) (*domain.Ticket, error)
	GetByReference(ctx context.Context, reference string) (*domain.Ticket, error)
	GetByCode(ctx context.Context, code string) (*domain.Ticket, error)
	SearchByEmail(ctx context.Context, email string, page, limit int) ([]domain.Ticket, int, error)
	UpdateStatus(ctx context.Context, id string, status domain.TicketStatus) error
	// CheckinDay marks one day of a PAID ticket as attended. The ticket becomes
	// USED once every day has been.
	CheckinDay(ctx context.Context, ticketID, eventDayID, checkedInBy string) error
	List(ctx context.Context, eventDayID string, status string, page int, limit int) ([]domain.Ticket, int, error)
	ExpirePastTickets(ctx context.Context) (int64, error)
	GetTotalRevenue(ctx context.Context) (int, error)
	GetTotalTicketsSold(ctx context.Context) (int, error)
	GetRecentSales(ctx context.Context, limit int) ([]domain.Ticket, error)
	CountByTeamAndEventDay(ctx context.Context, teamID string, eventDayID string) (int, error)
	CreateReferralCode(ctx context.Context, rc *domain.TicketReferralCode) error
	GetReferralCode(ctx context.Context, code string) (*domain.TicketReferralCode, error)
	LookupReferralsByName(ctx context.Context, name string) ([]domain.TicketReferralCode, error)
	ListReferralStats(ctx context.Context, search string, page int, limit int) ([]domain.ReferralStats, int, error)
}

// ═══════════════════════════════════════════════════════════════════════════════
// EventDay Repository Implementation
// ═══════════════════════════════════════════════════════════════════════════════

type PostgresEventDayRepository struct {
	db *pgxpool.Pool
}

func NewEventDayRepository(db *pgxpool.Pool) *PostgresEventDayRepository {
	return &PostgresEventDayRepository{db: db}
}

func (r *PostgresEventDayRepository) Create(ctx context.Context, ed *domain.EventDay) error {
	query := `
		INSERT INTO event_days (title, date, venue, is_active)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at, updated_at
	`
	return r.db.QueryRow(ctx, query, ed.Title, ed.Date, ed.Venue, ed.IsActive).
		Scan(&ed.ID, &ed.CreatedAt, &ed.UpdatedAt)
}

func (r *PostgresEventDayRepository) GetByID(ctx context.Context, id string) (*domain.EventDay, error) {
	query := `
		SELECT id, title, date, venue, is_active, created_at, updated_at
		FROM event_days WHERE id = $1
	`
	var ed domain.EventDay
	err := r.db.QueryRow(ctx, query, id).Scan(
		&ed.ID, &ed.Title, &ed.Date, &ed.Venue, &ed.IsActive, &ed.CreatedAt, &ed.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &ed, nil
}

func (r *PostgresEventDayRepository) GetByDate(ctx context.Context, date string) (*domain.EventDay, error) {
	query := `
		SELECT id, title, date, venue, is_active, created_at, updated_at
		FROM event_days WHERE date = $1
	`
	var ed domain.EventDay
	err := r.db.QueryRow(ctx, query, date).Scan(
		&ed.ID, &ed.Title, &ed.Date, &ed.Venue, &ed.IsActive, &ed.CreatedAt, &ed.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &ed, nil
}

func (r *PostgresEventDayRepository) ListActive(ctx context.Context) ([]domain.EventDay, error) {
	query := `
		SELECT id, title, date, venue, is_active, created_at, updated_at
		FROM event_days 
		WHERE is_active = true AND date >= CURRENT_DATE
		ORDER BY date ASC
	`
	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var eventDays []domain.EventDay
	for rows.Next() {
		var ed domain.EventDay
		if err := rows.Scan(
			&ed.ID, &ed.Title, &ed.Date, &ed.Venue, &ed.IsActive, &ed.CreatedAt, &ed.UpdatedAt,
		); err != nil {
			return nil, err
		}
		eventDays = append(eventDays, ed)
	}
	return eventDays, nil
}

func (r *PostgresEventDayRepository) Update(ctx context.Context, id string, title *string, date *time.Time, venue *string, isActive *bool) error {
	query := `UPDATE event_days SET updated_at = NOW()`
	args := []interface{}{}
	argIdx := 1

	if title != nil {
		query += fmt.Sprintf(", title = $%d", argIdx)
		args = append(args, *title)
		argIdx++
	}
	if date != nil {
		query += fmt.Sprintf(", date = $%d", argIdx)
		args = append(args, *date)
		argIdx++
	}
	if venue != nil {
		query += fmt.Sprintf(", venue = $%d", argIdx)
		args = append(args, *venue)
		argIdx++
	}
	if isActive != nil {
		query += fmt.Sprintf(", is_active = $%d", argIdx)
		args = append(args, *isActive)
		argIdx++
	}

	query += fmt.Sprintf(" WHERE id = $%d", argIdx)
	args = append(args, id)

	_, err := r.db.Exec(ctx, query, args...)
	return err
}

func (r *PostgresEventDayRepository) ListAll(ctx context.Context, search string, page, limit int) ([]domain.EventDay, int, error) {
	page, limit, offset := paging(page, limit, 25)

	// Match the title or the date as typed, so "arena" and "2026-08" both find
	// something. Filtering here rather than in the browser is the point: the
	// caller only ever holds one page.
	where := ""
	args := []interface{}{}
	if search = strings.TrimSpace(search); search != "" {
		where = ` WHERE (title ILIKE $1 OR date::text ILIKE $1)`
		args = append(args, "%"+search+"%")
	}

	var total int
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM event_days`+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := `
		SELECT id, title, date, venue, is_active, created_at, updated_at
		FROM event_days` + where +
		fmt.Sprintf(` ORDER BY date DESC, id ASC LIMIT $%d OFFSET $%d`, len(args)+1, len(args)+2)
	args = append(args, limit, offset)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	eventDays := make([]domain.EventDay, 0, limit)
	for rows.Next() {
		var ed domain.EventDay
		if err := rows.Scan(
			&ed.ID, &ed.Title, &ed.Date, &ed.Venue, &ed.IsActive, &ed.CreatedAt, &ed.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		eventDays = append(eventDays, ed)
	}
	return eventDays, total, nil
}

func (r *PostgresEventDayRepository) Delete(ctx context.Context, id string) error {
	// Refuse to delete a match day that has paid tickets: the ticket_days rows
	// would lose their link to it. Matches, fantasy and team of the week hang off
	// event days too, so a day that is merely unsold is deleted on the same terms
	// it always was; its product_days go with it (ON DELETE CASCADE).
	var paidCount int
	if err := r.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM ticket_days td JOIN tickets t ON t.id = td.ticket_id
		 WHERE td.event_day_id = $1 AND t.status IN ('PAID', 'USED')`, id,
	).Scan(&paidCount); err != nil {
		return err
	}
	if paidCount > 0 {
		return fmt.Errorf("cannot delete match day: %d paid ticket(s) exist for it", paidCount)
	}

	_, err := r.db.Exec(ctx, `DELETE FROM event_days WHERE id = $1`, id)
	return err
}

// ═══════════════════════════════════════════════════════════════════════════════
// Ticket Product Repository Implementation
// ═══════════════════════════════════════════════════════════════════════════════

type PostgresTicketProductRepository struct {
	db *pgxpool.Pool
}

func NewTicketProductRepository(db *pgxpool.Pool) *PostgresTicketProductRepository {
	return &PostgresTicketProductRepository{db: db}
}

// pendingReservationTTL bounds how long an unpaid PENDING ticket holds capacity.
// Abandoned purchases (user closes the Paystack tab, no webhook ever lands) stop
// counting against capacity after this window, so they can't permanently block
// sales while still preventing concurrent overselling within the window.
const pendingReservationTTL = "30 minutes"

// Seat counts for a product day, derived from tickets so they cannot drift.
// Sold is paid seats; held is unpaid seats still inside the reservation window.
// They read the seat-lock row as `pd`, which is NULL (so 0) for a day nobody has
// bought yet.
const productDaySoldSQL = `COALESCE((
	SELECT SUM(t.quantity) FROM ticket_days td JOIN tickets t ON t.id = td.ticket_id
	WHERE td.product_day_id = pd.id AND t.status IN ('PAID', 'USED')), 0)`

const productDayHeldSQL = `COALESCE((
	SELECT SUM(t.quantity) FROM ticket_days td JOIN tickets t ON t.id = td.ticket_id
	WHERE td.product_day_id = pd.id AND t.status = 'PENDING'
	  AND t.created_at > NOW() - INTERVAL '` + pendingReservationTTL + `'), 0)`

const productColumns = `id, name, slug, description, base_price, is_hidden, access_code, is_active, capacity, sort_order, created_at, updated_at`

func scanProduct(row pgx.Row, p *domain.TicketProduct) error {
	return row.Scan(&p.ID, &p.Name, &p.Slug, &p.Description, &p.BasePrice, &p.IsHidden, &p.AccessCode,
		&p.IsActive, &p.Capacity, &p.SortOrder, &p.CreatedAt, &p.UpdatedAt)
}

func (r *PostgresTicketProductRepository) CreateProduct(ctx context.Context, p *domain.TicketProduct) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO ticket_products (name, slug, description, base_price, is_hidden, access_code, is_active, capacity, sort_order)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at, updated_at`,
		p.Name, p.Slug, p.Description, p.BasePrice, p.IsHidden, p.AccessCode, p.IsActive, p.Capacity, p.SortOrder,
	).Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)
}

func (r *PostgresTicketProductRepository) UpdateProduct(ctx context.Context, p *domain.TicketProduct) error {
	// Lowering the seat limit below what one match day has already sold or is
	// holding would strand buyers, so it is refused rather than silently accepted.
	if p.Capacity > 0 {
		var committed int
		if err := r.db.QueryRow(ctx, `
			SELECT COALESCE(MAX(per_day.seats), 0) FROM (
				SELECT SUM(t.quantity) AS seats
				FROM ticket_product_days pd
				JOIN ticket_days td ON td.product_day_id = pd.id
				JOIN tickets t ON t.id = td.ticket_id
				WHERE pd.product_id = $1
				  AND (t.status IN ('PAID', 'USED')
				       OR (t.status = 'PENDING' AND t.created_at > NOW() - INTERVAL '`+pendingReservationTTL+`'))
				GROUP BY pd.id
			) per_day`, p.ID,
		).Scan(&committed); err != nil {
			return err
		}
		if p.Capacity < committed {
			return fmt.Errorf("seats per match day (%d) cannot be less than seats already sold or held on one day (%d)", p.Capacity, committed)
		}
	}
	return r.db.QueryRow(ctx, `
		UPDATE ticket_products
		SET name = $1, description = $2, base_price = $3, is_hidden = $4, access_code = $5,
		    is_active = $6, capacity = $7, sort_order = $8, updated_at = NOW()
		WHERE id = $9
		RETURNING updated_at`,
		p.Name, p.Description, p.BasePrice, p.IsHidden, p.AccessCode, p.IsActive, p.Capacity, p.SortOrder, p.ID,
	).Scan(&p.UpdatedAt)
}

// loadCompetitions attaches each ticket's linked competitions, by name.
func (r *PostgresTicketProductRepository) loadCompetitions(ctx context.Context, products []domain.TicketProduct) error {
	if len(products) == 0 {
		return nil
	}
	ids := make([]string, len(products))
	index := make(map[string]int, len(products))
	for i := range products {
		ids[i] = products[i].ID
		index[products[i].ID] = i
		products[i].Competitions = []domain.TicketCompetition{}
	}
	rows, err := r.db.Query(ctx, `
		SELECT pc.product_id, c.id, c.name
		FROM ticket_product_competitions pc
		JOIN competitions c ON c.id = pc.competition_id
		WHERE pc.product_id = ANY($1::uuid[])
		ORDER BY c.name ASC`, ids)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var productID string
		var c domain.TicketCompetition
		if err := rows.Scan(&productID, &c.ID, &c.Name); err != nil {
			return err
		}
		if i, ok := index[productID]; ok {
			products[i].Competitions = append(products[i].Competitions, c)
		}
	}
	return rows.Err()
}

func (r *PostgresTicketProductRepository) GetProduct(ctx context.Context, id string) (*domain.TicketProduct, error) {
	var p domain.TicketProduct
	if err := scanProduct(r.db.QueryRow(ctx, `SELECT `+productColumns+` FROM ticket_products WHERE id = $1`, id), &p); err != nil {
		return nil, err
	}
	list := []domain.TicketProduct{p}
	if err := r.loadCompetitions(ctx, list); err != nil {
		return nil, err
	}
	return &list[0], nil
}

func (r *PostgresTicketProductRepository) ListProducts(ctx context.Context, activeOnly bool) ([]domain.TicketProduct, error) {
	query := `SELECT ` + productColumns + ` FROM ticket_products`
	if activeOnly {
		query += ` WHERE is_active = TRUE`
	}
	query += ` ORDER BY sort_order ASC, base_price ASC, name ASC`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	products := []domain.TicketProduct{}
	index := map[string]int{}
	for rows.Next() {
		var p domain.TicketProduct
		if err := scanProduct(rows, &p); err != nil {
			return nil, err
		}
		index[p.ID] = len(products)
		products = append(products, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	rows.Close()
	if len(products) == 0 {
		return products, nil
	}

	if err := r.loadCompetitions(ctx, products); err != nil {
		return nil, err
	}
	days, err := r.queryGameDays(ctx, ``, nil)
	if err != nil {
		return nil, err
	}
	for _, d := range days {
		if i, ok := index[d.ProductID]; ok {
			products[i].Days = append(products[i].Days, d)
		}
	}
	return products, nil
}

func (r *PostgresTicketProductRepository) DeleteProduct(ctx context.Context, id string) error {
	var sold int
	if err := r.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM tickets WHERE product_id = $1 AND status IN ('PAID', 'USED')`, id,
	).Scan(&sold); err != nil {
		return err
	}
	if sold > 0 {
		return fmt.Errorf("cannot delete a ticket with %d paid ticket(s); turn it off instead", sold)
	}
	_, err := r.db.Exec(ctx, `DELETE FROM ticket_products WHERE id = $1`, id)
	return err
}

func (r *PostgresTicketProductRepository) SetProductCompetitions(ctx context.Context, productID string, competitionIDs []string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `DELETE FROM ticket_product_competitions WHERE product_id = $1`, productID); err != nil {
		return err
	}
	for _, id := range competitionIDs {
		if _, err := tx.Exec(ctx, `
			INSERT INTO ticket_product_competitions (product_id, competition_id) VALUES ($1, $2)
			ON CONFLICT DO NOTHING`, productID, id); err != nil {
			return fmt.Errorf("unknown tournament %s: %w", id, err)
		}
	}
	return tx.Commit(ctx)
}

func (r *PostgresTicketProductRepository) EnsureEventDays(ctx context.Context) error {
	// One event day per calendar date (event_days.date is unique), so a date that
	// two competitions share is created once. An existing day, whoever made it
	// (the admin, or fantasy), is never touched.
	_, err := r.db.Exec(ctx, `
		INSERT INTO event_days (title, date, venue, is_active)
		SELECT DISTINCT ON (m.date)
			'Game Day · ' || to_char(m.date, 'FMDD Mon'),
			m.date,
			COALESCE(NULLIF(m.venue, ''), 'Showtime Arena'),
			TRUE
		FROM ticket_product_competitions pc
		JOIN ticket_products p ON p.id = pc.product_id AND p.is_active
		JOIN matches m ON m.competition_id = pc.competition_id
		WHERE NOT EXISTS (SELECT 1 FROM event_days ed WHERE ed.date = m.date)
		ORDER BY m.date, m.time
		ON CONFLICT (date) DO NOTHING`)
	return err
}

// gameDaysSelect is every match day a ticket is on sale for: a day with a match
// in a competition the ticket is linked to. A day reached through two linked
// competitions is listed once, under the first by name. `where` narrows it.
const gameDaysSelect = `
	SELECT x.product_id, x.pd_id, x.event_day_id, x.competition_id, x.competition_name,
	       x.price, x.capacity, x.sold, x.held, x.title, x.date, x.venue, x.is_active
	FROM (
		SELECT DISTINCT ON (p.id, ed.id)
		       p.id AS product_id, COALESCE(pd.id::text, '') AS pd_id, ed.id AS event_day_id,
		       c.id AS competition_id, c.name AS competition_name,
		       p.base_price AS price, p.capacity AS capacity,
		       ` + productDaySoldSQL + ` AS sold, ` + productDayHeldSQL + ` AS held,
		       ed.title, ed.date, ed.venue, ed.is_active
		FROM ticket_products p
		JOIN ticket_product_competitions pc ON pc.product_id = p.id
		JOIN competitions c ON c.id = pc.competition_id
		JOIN LATERAL (
			SELECT DISTINCT ed2.id, ed2.title, ed2.date, ed2.venue, ed2.is_active
			FROM matches m JOIN event_days ed2 ON ed2.id = m.event_day_id OR ed2.date = m.date
			WHERE m.competition_id = c.id
		) ed ON TRUE
		LEFT JOIN ticket_product_days pd ON pd.product_id = p.id AND pd.event_day_id = ed.id
		%s
		ORDER BY p.id, ed.id, c.name
	) x
	ORDER BY x.date ASC, x.product_id`

func (r *PostgresTicketProductRepository) queryGameDays(ctx context.Context, where string, args []interface{}) ([]domain.TicketProductDay, error) {
	rows, err := r.db.Query(ctx, fmt.Sprintf(gameDaysSelect, where), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	days := []domain.TicketProductDay{}
	for rows.Next() {
		var d domain.TicketProductDay
		ed := domain.EventDay{}
		if err := rows.Scan(&d.ProductID, &d.ID, &d.EventDayID, &d.CompetitionID, &d.CompetitionName,
			&d.Price, &d.Capacity, &d.SoldCount, &d.HeldCount,
			&ed.Title, &ed.Date, &ed.Venue, &ed.IsActive,
		); err != nil {
			return nil, err
		}
		ed.ID = d.EventDayID
		d.EventDay = &ed
		days = append(days, d)
	}
	return days, rows.Err()
}

func (r *PostgresTicketProductRepository) ResolveProductDays(ctx context.Context, productID string, eventDayIDs []string) ([]domain.TicketProductDay, error) {
	if len(eventDayIDs) == 0 {
		return []domain.TicketProductDay{}, nil
	}
	days, err := r.queryGameDays(ctx,
		`WHERE p.id = $1 AND ed.id = ANY($2::uuid[])`,
		[]interface{}{productID, eventDayIDs})
	if err != nil {
		return nil, err
	}
	// Give every valid day its seat-lock row, so Create has something to lock.
	missing := []string{}
	for _, d := range days {
		if d.ID == "" {
			missing = append(missing, d.EventDayID)
		}
	}
	if len(missing) > 0 {
		if _, err := r.db.Exec(ctx, `
			INSERT INTO ticket_product_days (product_id, event_day_id)
			SELECT $1, UNNEST($2::uuid[])
			ON CONFLICT (product_id, event_day_id) DO NOTHING`, productID, missing); err != nil {
			return nil, err
		}
		days, err = r.queryGameDays(ctx,
			`WHERE p.id = $1 AND ed.id = ANY($2::uuid[])`,
			[]interface{}{productID, eventDayIDs})
		if err != nil {
			return nil, err
		}
	}
	return days, nil
}

func (r *PostgresTicketProductRepository) ListGamePassRules(ctx context.Context) ([]domain.GamePassRule, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, min_days, percent_off::float8, is_active
		FROM game_pass_discount_rules ORDER BY min_days ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	rules := []domain.GamePassRule{}
	for rows.Next() {
		var g domain.GamePassRule
		if err := rows.Scan(&g.ID, &g.MinDays, &g.PercentOff, &g.IsActive); err != nil {
			return nil, err
		}
		rules = append(rules, g)
	}
	return rules, rows.Err()
}

// ReplaceGamePassRules swaps the whole ladder atomically, so the editor can add,
// change and remove rungs in one save without leaving a half-written ladder.
func (r *PostgresTicketProductRepository) ReplaceGamePassRules(ctx context.Context, rules []domain.GamePassRule) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `DELETE FROM game_pass_discount_rules`); err != nil {
		return err
	}
	for _, g := range rules {
		if _, err := tx.Exec(ctx, `
			INSERT INTO game_pass_discount_rules (min_days, percent_off, is_active) VALUES ($1, $2, $3)`,
			g.MinDays, g.PercentOff, g.IsActive); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// ═══════════════════════════════════════════════════════════════════════════════
// Ticket Repository Implementation
// ═══════════════════════════════════════════════════════════════════════════════

type PostgresTicketRepository struct {
	db *pgxpool.Pool
}

func NewTicketRepository(db *pgxpool.Pool) *PostgresTicketRepository {
	return &PostgresTicketRepository{db: db}
}

// lagosToday is "today" for the league, as a SQL expression. Match days are plain
// dates with no time zone, so which day it is has to be pinned to where the games
// are played rather than to the database server's clock.
const lagosToday = `(NOW() AT TIME ZONE 'Africa/Lagos')::date`

const ticketColumns = `t.id, t.product_id, t.product_name, t.purchase_type, t.email,
	COALESCE(t.phone, ''), COALESCE(t.name, ''), t.user_id, t.quantity, t.unit_price, t.subtotal,
	t.total_amount, t.status, t.paystack_reference, t.paystack_access_code, t.ticket_code, t.team_id,
	t.referral_code, t.created_at, t.updated_at, t.discount_code, t.discount_amount,
	t.game_pass_discount_percent::float8, t.game_pass_discount_amount`

func scanTicket(row pgx.Row, t *domain.Ticket) error {
	return row.Scan(
		&t.ID, &t.ProductID, &t.ProductName, &t.PurchaseType, &t.Email,
		&t.Phone, &t.Name, &t.UserID, &t.Quantity, &t.UnitPrice, &t.Subtotal,
		&t.TotalAmount, &t.Status, &t.PaystackReference, &t.PaystackAccessCode, &t.TicketCode, &t.TeamID,
		&t.ReferralCode, &t.CreatedAt, &t.UpdatedAt, &t.DiscountCode, &t.DiscountAmount,
		&t.GamePassDiscountPercent, &t.GamePassDiscountAmount,
	)
}

// loadDays attaches each ticket's days. The live match day wins over the copy
// taken at purchase, so a retitled or moved day shows correctly; the copy is what
// remains if the day was deleted.
func loadTicketDays(ctx context.Context, db interface {
	Query(context.Context, string, ...interface{}) (pgx.Rows, error)
}, tickets []*domain.Ticket) error {
	if len(tickets) == 0 {
		return nil
	}
	ids := make([]string, len(tickets))
	byID := make(map[string]*domain.Ticket, len(tickets))
	for i, t := range tickets {
		ids[i] = t.ID
		byID[t.ID] = t
		t.Days = nil
	}

	rows, err := db.Query(ctx, `
		SELECT td.id, td.ticket_id, COALESCE(td.event_day_id::text, ''), COALESCE(td.product_day_id::text, ''),
		       td.unit_price, COALESCE(ed.title, td.day_title), COALESCE(ed.date, td.day_date),
		       COALESCE(ed.venue, td.day_venue), td.checked_in_at, td.checked_in_by
		FROM ticket_days td
		LEFT JOIN event_days ed ON ed.id = td.event_day_id
		WHERE td.ticket_id = ANY($1::uuid[])
		ORDER BY COALESCE(ed.date, td.day_date) ASC NULLS LAST, td.created_at ASC`, ids)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var d domain.TicketDay
		var date *time.Time
		if err := rows.Scan(&d.ID, &d.TicketID, &d.EventDayID, &d.ProductDayID, &d.UnitPrice,
			&d.Title, &date, &d.Venue, &d.CheckedInAt, &d.CheckedInBy); err != nil {
			return err
		}
		if date != nil {
			d.Date = *date
		}
		if t, ok := byID[d.TicketID]; ok {
			t.Days = append(t.Days, d)
		}
	}
	return rows.Err()
}

func (r *PostgresTicketRepository) Create(ctx context.Context, ticket *domain.Ticket) error {
	if len(ticket.Days) == 0 {
		return fmt.Errorf("a ticket needs at least one day")
	}

	// Reserve seats on every day and insert atomically. The product-day rows are
	// locked FOR UPDATE in a fixed order (by event day), so two game passes that
	// overlap queue up instead of deadlocking, and concurrent buyers of the last
	// seats serialize and each see the others' in-flight reservations.
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	productDayIDs := make([]string, len(ticket.Days))
	for i, d := range ticket.Days {
		productDayIDs[i] = d.ProductDayID
	}

	lockRows, err := tx.Query(ctx, `
		SELECT pd.id, p.capacity, p.is_active, ed.title
		FROM ticket_product_days pd
		JOIN ticket_products p ON p.id = pd.product_id
		JOIN event_days ed ON ed.id = pd.event_day_id
		WHERE pd.id = ANY($1::uuid[])
		ORDER BY pd.event_day_id
		FOR UPDATE OF pd`, productDayIDs)
	if err != nil {
		return err
	}
	type lockedDay struct {
		id       string
		capacity int
		active   bool
		title    string
	}
	var locked []lockedDay
	for lockRows.Next() {
		var l lockedDay
		if err := lockRows.Scan(&l.id, &l.capacity, &l.active, &l.title); err != nil {
			lockRows.Close()
			return err
		}
		locked = append(locked, l)
	}
	lockRows.Close()
	if err := lockRows.Err(); err != nil {
		return err
	}
	if len(locked) != len(productDayIDs) {
		return fmt.Errorf("this ticket is no longer on sale for one of the selected days")
	}

	for _, l := range locked {
		if !l.active {
			return fmt.Errorf("tickets are not on sale for %s", l.title)
		}
		if l.capacity <= 0 { // 0 = unlimited
			continue
		}
		// Seats already held: all PAID/USED tickets plus PENDING tickets still
		// inside the reservation window.
		var reserved int
		if err := tx.QueryRow(ctx, `
			SELECT COALESCE(SUM(t.quantity), 0)
			FROM ticket_days td JOIN tickets t ON t.id = td.ticket_id
			WHERE td.product_day_id = $1
			  AND (t.status IN ('PAID', 'USED')
			       OR (t.status = 'PENDING' AND t.created_at > NOW() - INTERVAL '`+pendingReservationTTL+`'))`,
			l.id).Scan(&reserved); err != nil {
			return err
		}
		if reserved+ticket.Quantity > l.capacity {
			remaining := l.capacity - reserved
			if remaining < 0 {
				remaining = 0
			}
			return fmt.Errorf("not enough tickets available for %s, only %d remaining", l.title, remaining)
		}
	}

	err = tx.QueryRow(ctx, `
		INSERT INTO tickets (product_id, product_name, purchase_type, email, phone, name, user_id, quantity,
			unit_price, subtotal, total_amount, status, paystack_reference, paystack_access_code, ticket_code,
			team_id, referral_code, discount_code, discount_amount, game_pass_discount_percent, game_pass_discount_amount)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
		ON CONFLICT (paystack_reference) DO NOTHING
		RETURNING id, created_at, updated_at`,
		ticket.ProductID, ticket.ProductName, ticket.PurchaseType, ticket.Email, ticket.Phone, ticket.Name,
		ticket.UserID, ticket.Quantity, ticket.UnitPrice, ticket.Subtotal, ticket.TotalAmount, ticket.Status,
		ticket.PaystackReference, ticket.PaystackAccessCode, ticket.TicketCode, ticket.TeamID,
		ticket.ReferralCode, ticket.DiscountCode, ticket.DiscountAmount,
		ticket.GamePassDiscountPercent, ticket.GamePassDiscountAmount,
	).Scan(&ticket.ID, &ticket.CreatedAt, &ticket.UpdatedAt)
	if err != nil {
		return err
	}

	for _, d := range ticket.Days {
		if _, err := tx.Exec(ctx, `
			INSERT INTO ticket_days (ticket_id, event_day_id, product_day_id, unit_price, day_title, day_date, day_venue)
			SELECT $1::uuid, ed.id, $3::uuid, $4::int, ed.title, ed.date, ed.venue FROM event_days ed WHERE ed.id = $2`,
			ticket.ID, d.EventDayID, d.ProductDayID, d.UnitPrice); err != nil {
			return err
		}
	}

	// Hold the code in the same transaction that claims the seats, so a buyer
	// never takes one without the other.
	if ticket.DiscountCodeID != nil && *ticket.DiscountCodeID != "" {
		if err := reserveDiscountTx(ctx, tx, *ticket.DiscountCodeID, ticket.Email, ticket.UserID, nil, &ticket.ID, float64(ticket.DiscountAmount)); err != nil {
			return err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	return loadTicketDays(ctx, r.db, []*domain.Ticket{ticket})
}

func (r *PostgresTicketRepository) getOne(ctx context.Context, where string, arg string) (*domain.Ticket, error) {
	var t domain.Ticket
	if err := scanTicket(r.db.QueryRow(ctx, `SELECT `+ticketColumns+` FROM tickets t WHERE `+where, arg), &t); err != nil {
		return nil, err
	}
	if err := loadTicketDays(ctx, r.db, []*domain.Ticket{&t}); err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *PostgresTicketRepository) GetByID(ctx context.Context, id string) (*domain.Ticket, error) {
	return r.getOne(ctx, `t.id = $1`, id)
}

func (r *PostgresTicketRepository) GetByReference(ctx context.Context, reference string) (*domain.Ticket, error) {
	return r.getOne(ctx, `t.paystack_reference = $1`, reference)
}

func (r *PostgresTicketRepository) GetByCode(ctx context.Context, code string) (*domain.Ticket, error) {
	return r.getOne(ctx, `UPPER(t.ticket_code) = UPPER($1)`, code)
}

// scanTickets reads a result set of ticketColumns rows and attaches their days.
func (r *PostgresTicketRepository) scanTickets(ctx context.Context, rows pgx.Rows) ([]domain.Ticket, error) {
	defer rows.Close()
	tickets := []domain.Ticket{}
	for rows.Next() {
		var t domain.Ticket
		if err := scanTicket(rows, &t); err != nil {
			return nil, err
		}
		tickets = append(tickets, t)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	rows.Close()

	ptrs := make([]*domain.Ticket, len(tickets))
	for i := range tickets {
		ptrs[i] = &tickets[i]
	}
	if err := loadTicketDays(ctx, r.db, ptrs); err != nil {
		return nil, err
	}
	return tickets, nil
}

func (r *PostgresTicketRepository) SearchByEmail(ctx context.Context, email string, page, limit int) ([]domain.Ticket, int, error) {
	page, limit, offset := paging(page, limit, 20)

	var total int
	if err := r.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM tickets WHERE LOWER(email) = LOWER($1)`, email,
	).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := r.db.Query(ctx, `
		SELECT `+ticketColumns+`
		FROM tickets t
		WHERE LOWER(t.email) = LOWER($1)
		ORDER BY t.created_at DESC, t.id ASC
		LIMIT $2 OFFSET $3`, email, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	tickets, err := r.scanTickets(ctx, rows)
	if err != nil {
		return nil, 0, err
	}
	return tickets, total, nil
}

func (r *PostgresTicketRepository) UpdateStatus(ctx context.Context, id string, status domain.TicketStatus) error {
	query := `UPDATE tickets SET status = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.Exec(ctx, query, status, id)
	return err
}

func (r *PostgresTicketRepository) CheckinDay(ctx context.Context, ticketID, eventDayID, checkedInBy string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var status domain.TicketStatus
	if err := tx.QueryRow(ctx, `SELECT status FROM tickets WHERE id = $1 FOR UPDATE`, ticketID).Scan(&status); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("ticket not found")
		}
		return err
	}
	if status != domain.TicketStatusPaid && status != domain.TicketStatusUsed {
		return fmt.Errorf("ticket is %s, not PAID", status)
	}

	res, err := tx.Exec(ctx, `
		UPDATE ticket_days SET checked_in_at = NOW(), checked_in_by = $3
		WHERE ticket_id = $1 AND event_day_id = $2 AND checked_in_at IS NULL`,
		ticketID, eventDayID, checkedInBy)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		var at *time.Time
		err := tx.QueryRow(ctx,
			`SELECT checked_in_at FROM ticket_days WHERE ticket_id = $1 AND event_day_id = $2`,
			ticketID, eventDayID).Scan(&at)
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("ticket is not valid for that day")
		}
		if err != nil {
			return err
		}
		return fmt.Errorf("ticket already checked in for that day")
	}

	// Fully used only once every day has been attended.
	if _, err := tx.Exec(ctx, `
		UPDATE tickets SET status = 'USED', updated_at = NOW()
		WHERE id = $1 AND status = 'PAID'
		  AND NOT EXISTS (SELECT 1 FROM ticket_days WHERE ticket_id = $1 AND checked_in_at IS NULL)`,
		ticketID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *PostgresTicketRepository) List(ctx context.Context, eventDayID string, status string, page int, limit int) ([]domain.Ticket, int, error) {
	where := ` WHERE 1=1`
	args := []interface{}{}
	if eventDayID != "" {
		args = append(args, eventDayID)
		where += fmt.Sprintf(` AND EXISTS (SELECT 1 FROM ticket_days td WHERE td.ticket_id = t.id AND td.event_day_id = $%d)`, len(args))
	}
	if status != "" {
		args = append(args, status)
		where += fmt.Sprintf(` AND t.status = $%d`, len(args))
	}

	var total int
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM tickets t`+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	page, limit, offset := paging(page, limit, 10)
	dataArgs := append(append([]interface{}{}, args...), limit, offset)
	rows, err := r.db.Query(ctx, `
		SELECT `+ticketColumns+` FROM tickets t`+where+
		fmt.Sprintf(` ORDER BY t.created_at DESC, t.id ASC LIMIT $%d OFFSET $%d`, len(args)+1, len(args)+2),
		dataArgs...)
	if err != nil {
		return nil, 0, err
	}
	tickets, err := r.scanTickets(ctx, rows)
	if err != nil {
		return nil, 0, err
	}
	return tickets, total, nil
}

// ExpirePastTickets retires tickets once their last day has passed. A ticket that
// still has a day to come is left alone, so a game pass lives until its final day.
func (r *PostgresTicketRepository) ExpirePastTickets(ctx context.Context) (int64, error) {
	query := `
		UPDATE tickets
		SET status = CASE WHEN tickets.status = 'PAID' THEN 'EXPIRED' ELSE 'CANCELLED' END,
		    updated_at = NOW()
		WHERE tickets.status IN ('PAID', 'PENDING', 'FAILED')
		  AND EXISTS (SELECT 1 FROM ticket_days td WHERE td.ticket_id = tickets.id)
		  AND NOT EXISTS (
		      SELECT 1 FROM ticket_days td
		      LEFT JOIN event_days ed ON ed.id = td.event_day_id
		      WHERE td.ticket_id = tickets.id
		        AND (COALESCE(ed.date, td.day_date) IS NULL OR COALESCE(ed.date, td.day_date) >= ` + lagosToday + `))`
	res, err := r.db.Exec(ctx, query)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected(), nil
}

func (r *PostgresTicketRepository) GetTotalRevenue(ctx context.Context) (int, error) {
	query := `SELECT COALESCE(SUM(total_amount), 0) FROM tickets WHERE status IN ('PAID', 'USED')`
	var total int
	err := r.db.QueryRow(ctx, query).Scan(&total)
	return total, err
}

func (r *PostgresTicketRepository) GetTotalTicketsSold(ctx context.Context) (int, error) {
	query := `SELECT COALESCE(SUM(quantity), 0) FROM tickets WHERE status IN ('PAID', 'USED')`
	var total int
	err := r.db.QueryRow(ctx, query).Scan(&total)
	return total, err
}

func (r *PostgresTicketRepository) GetRecentSales(ctx context.Context, limit int) ([]domain.Ticket, error) {
	rows, err := r.db.Query(ctx, `
		SELECT `+ticketColumns+`
		FROM tickets t
		WHERE t.status IN ('PAID', 'USED')
		ORDER BY t.created_at DESC
		LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	return r.scanTickets(ctx, rows)
}

func (r *PostgresTicketRepository) CountByTeamAndEventDay(ctx context.Context, teamID string, eventDayID string) (int, error) {
	query := `SELECT COUNT(DISTINCT t.id) FROM tickets t
		JOIN ticket_days td ON td.ticket_id = t.id
		WHERE t.team_id = $1 AND td.event_day_id = $2`
	var count int
	err := r.db.QueryRow(ctx, query, teamID, eventDayID).Scan(&count)
	return count, err
}

func (r *PostgresTicketRepository) CreateReferralCode(ctx context.Context, rc *domain.TicketReferralCode) error {
	query := `
		INSERT INTO ticket_referral_codes (code, name, email)
		VALUES ($1, $2, $3)
		RETURNING id, created_at, updated_at
	`
	return r.db.QueryRow(ctx, query, rc.Code, rc.Name, rc.Email).
		Scan(&rc.ID, &rc.CreatedAt, &rc.UpdatedAt)
}

func (r *PostgresTicketRepository) GetReferralCode(ctx context.Context, code string) (*domain.TicketReferralCode, error) {
	query := `
		SELECT id, code, name, email, created_at, updated_at
		FROM ticket_referral_codes
		WHERE UPPER(code) = UPPER($1)
	`
	var rc domain.TicketReferralCode
	err := r.db.QueryRow(ctx, query, code).Scan(&rc.ID, &rc.Code, &rc.Name, &rc.Email, &rc.CreatedAt, &rc.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &rc, nil
}

func (r *PostgresTicketRepository) LookupReferralsByName(ctx context.Context, name string) ([]domain.TicketReferralCode, error) {
	query := `
		SELECT id, code, name, email, created_at, updated_at
		FROM ticket_referral_codes
		WHERE LOWER(name) LIKE LOWER($1)
		ORDER BY created_at DESC
	`
	rows, err := r.db.Query(ctx, query, "%"+name+"%")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []domain.TicketReferralCode
	for rows.Next() {
		var rc domain.TicketReferralCode
		if err := rows.Scan(&rc.ID, &rc.Code, &rc.Name, &rc.Email, &rc.CreatedAt, &rc.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, rc)
	}
	return list, nil
}

func (r *PostgresTicketRepository) ListReferralStats(ctx context.Context, search string, page int, limit int) ([]domain.ReferralStats, int, error) {
	countQuery := `SELECT COUNT(*) FROM ticket_referral_codes WHERE 1=1`
	var countArgs []interface{}
	if search != "" {
		countQuery += ` AND (name ILIKE $1 OR code ILIKE $1)`
		countArgs = append(countArgs, "%"+search+"%")
	}

	var total int
	err := r.db.QueryRow(ctx, countQuery, countArgs...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	dataQuery := `
		SELECT tr.id, tr.code, tr.name, tr.email, tr.created_at,
		       COALESCE(SUM(t.quantity)::integer, 0) AS tickets_sold,
		       COALESCE(SUM(t.total_amount)::integer, 0) AS total_revenue
		FROM ticket_referral_codes tr
		LEFT JOIN tickets t ON t.referral_code = tr.code AND t.status IN ('PAID', 'USED')
		WHERE 1=1
	`
	var dataArgs []interface{}
	argIdx := 1
	if search != "" {
		dataQuery += fmt.Sprintf(" AND (tr.name ILIKE $%d OR tr.code ILIKE $%d)", argIdx, argIdx)
		dataArgs = append(dataArgs, "%"+search+"%")
		argIdx++
	}
	dataQuery += " GROUP BY tr.id, tr.code, tr.name, tr.email, tr.created_at"
	dataQuery += " ORDER BY tr.created_at DESC"
	dataQuery += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	dataArgs = append(dataArgs, limit, (page-1)*limit)

	rows, err := r.db.Query(ctx, dataQuery, dataArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var stats []domain.ReferralStats
	for rows.Next() {
		var s domain.ReferralStats
		err := rows.Scan(&s.ID, &s.Code, &s.Name, &s.Email, &s.CreatedAt, &s.TicketsSold, &s.TotalRevenue)
		if err != nil {
			return nil, 0, err
		}
		stats = append(stats, s)
	}
	return stats, total, nil
}
