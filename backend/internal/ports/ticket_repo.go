package ports

import (
	"context"
	"fmt"
	"time"

	"showtime-backend/internal/domain"

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
	ListAll(ctx context.Context) ([]domain.EventDay, error)
	Update(ctx context.Context, id string, title *string, venue *string, isActive *bool) error
	Delete(ctx context.Context, id string) error
}

type TicketTierRepository interface {
	Create(ctx context.Context, tier *domain.TicketTier) error
	ListByEventDay(ctx context.Context, eventDayID string) ([]domain.TicketTier, error)
	GetByID(ctx context.Context, id string) (*domain.TicketTier, error)
	IncrementSoldCount(ctx context.Context, id string, qty int) error
	Delete(ctx context.Context, id string) error
}

type TicketRepository interface {
	Create(ctx context.Context, ticket *domain.Ticket) error
	GetByID(ctx context.Context, id string) (*domain.Ticket, error)
	GetByReference(ctx context.Context, reference string) (*domain.Ticket, error)
	GetByCode(ctx context.Context, code string) (*domain.Ticket, error)
	SearchByEmail(ctx context.Context, email string) ([]domain.Ticket, error)
	UpdateStatus(ctx context.Context, id string, status domain.TicketStatus) error
	Checkin(ctx context.Context, id string, checkedInBy string) error
	AdminCheckin(ctx context.Context, id string, checkedInBy string) error
	List(ctx context.Context, eventDayID string, status string, page int, limit int) ([]domain.Ticket, int, error)
	ExpirePastTickets(ctx context.Context) (int64, error)
	GetTotalRevenue(ctx context.Context) (int, error)
	GetTotalTicketsSold(ctx context.Context) (int, error)
	GetRecentSales(ctx context.Context, limit int) ([]domain.Ticket, error)
	CountByTeamAndEventDay(ctx context.Context, teamID string, eventDayID string) (int, error)
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

func (r *PostgresEventDayRepository) Update(ctx context.Context, id string, title *string, venue *string, isActive *bool) error {
	query := `UPDATE event_days SET updated_at = NOW()`
	args := []interface{}{}
	argIdx := 1

	if title != nil {
		query += fmt.Sprintf(", title = $%d", argIdx)
		args = append(args, *title)
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

func (r *PostgresEventDayRepository) ListAll(ctx context.Context) ([]domain.EventDay, error) {
	query := `
		SELECT id, title, date, venue, is_active, created_at, updated_at
		FROM event_days
		ORDER BY date DESC
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

func (r *PostgresEventDayRepository) Delete(ctx context.Context, id string) error {
	// Delete tiers first (cascade), then event day
	_, err := r.db.Exec(ctx, `DELETE FROM ticket_tiers WHERE event_day_id = $1`, id)
	if err != nil {
		return err
	}
	_, err = r.db.Exec(ctx, `DELETE FROM event_days WHERE id = $1`, id)
	return err
}

// TicketTier Repository Implementation
// ═══════════════════════════════════════════════════════════════════════════════

type PostgresTicketTierRepository struct {
	db *pgxpool.Pool
}

func NewTicketTierRepository(db *pgxpool.Pool) *PostgresTicketTierRepository {
	return &PostgresTicketTierRepository{db: db}
}

func (r *PostgresTicketTierRepository) Create(ctx context.Context, tier *domain.TicketTier) error {
	query := `
		INSERT INTO ticket_tiers (event_day_id, name, price, capacity, description, is_hidden, access_code)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, sold_count, created_at, updated_at
	`
	return r.db.QueryRow(ctx, query,
		tier.EventDayID, tier.Name, tier.Price, tier.Capacity, tier.Description, tier.IsHidden, tier.AccessCode,
	).Scan(&tier.ID, &tier.SoldCount, &tier.CreatedAt, &tier.UpdatedAt)
}

func (r *PostgresTicketTierRepository) ListByEventDay(ctx context.Context, eventDayID string) ([]domain.TicketTier, error) {
	query := `
		SELECT id, event_day_id, name, price, capacity, sold_count, description, is_hidden, access_code, created_at, updated_at
		FROM ticket_tiers WHERE event_day_id = $1
		ORDER BY price ASC
	`
	rows, err := r.db.Query(ctx, query, eventDayID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tiers []domain.TicketTier
	for rows.Next() {
		var t domain.TicketTier
		if err := rows.Scan(
			&t.ID, &t.EventDayID, &t.Name, &t.Price, &t.Capacity, &t.SoldCount,
			&t.Description, &t.IsHidden, &t.AccessCode, &t.CreatedAt, &t.UpdatedAt,
		); err != nil {
			return nil, err
		}
		tiers = append(tiers, t)
	}
	return tiers, nil
}

func (r *PostgresTicketTierRepository) GetByID(ctx context.Context, id string) (*domain.TicketTier, error) {
	query := `
		SELECT id, event_day_id, name, price, capacity, sold_count, description, is_hidden, access_code, created_at, updated_at
		FROM ticket_tiers WHERE id = $1
	`
	var t domain.TicketTier
	err := r.db.QueryRow(ctx, query, id).Scan(
		&t.ID, &t.EventDayID, &t.Name, &t.Price, &t.Capacity, &t.SoldCount,
		&t.Description, &t.IsHidden, &t.AccessCode, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *PostgresTicketTierRepository) IncrementSoldCount(ctx context.Context, id string, qty int) error {
	query := `UPDATE ticket_tiers SET sold_count = sold_count + $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.Exec(ctx, query, qty, id)
	return err
}

func (r *PostgresTicketTierRepository) Delete(ctx context.Context, id string) error {
	// Check if any tickets have been sold for this tier
	var soldCount int
	err := r.db.QueryRow(ctx, "SELECT sold_count FROM ticket_tiers WHERE id = $1", id).Scan(&soldCount)
	if err != nil {
		return err
	}
	if soldCount > 0 {
		return fmt.Errorf("cannot delete tier with existing sales")
	}

	_, err = r.db.Exec(ctx, "DELETE FROM ticket_tiers WHERE id = $1", id)
	return err
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

func (r *PostgresTicketRepository) Create(ctx context.Context, ticket *domain.Ticket) error {
	query := `
		INSERT INTO tickets (event_day_id, tier_id, email, phone, name, user_id, quantity, unit_price, total_amount, status, paystack_reference, paystack_access_code, ticket_code, team_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		ON CONFLICT (paystack_reference) DO NOTHING
		RETURNING id, created_at, updated_at
	`

	err := r.db.QueryRow(ctx, query,
		ticket.EventDayID, ticket.TierID, ticket.Email, ticket.Phone, ticket.Name, ticket.UserID,
		ticket.Quantity, ticket.UnitPrice, ticket.TotalAmount, ticket.Status,
		ticket.PaystackReference, ticket.PaystackAccessCode, ticket.TicketCode, ticket.TeamID,
	).Scan(&ticket.ID, &ticket.CreatedAt, &ticket.UpdatedAt)

	if err != nil {
		return err
	}

	return nil
}

func (r *PostgresTicketRepository) GetByID(ctx context.Context, id string) (*domain.Ticket, error) {
	query := `
		SELECT t.id, t.event_day_id, t.tier_id, t.email, COALESCE(t.phone, ''), COALESCE(t.name, ''), t.user_id, t.quantity, t.unit_price, t.total_amount,
			t.status, t.paystack_reference, t.paystack_access_code, t.ticket_code, t.team_id,
			t.checked_in_at, t.checked_in_by, t.created_at, t.updated_at,
			ed.title, ed.date, ed.venue,
			tt.name, tt.price
		FROM tickets t
		JOIN event_days ed ON t.event_day_id = ed.id
		JOIN ticket_tiers tt ON t.tier_id = tt.id
		WHERE t.id = $1
	`
	return r.scanTicketRow(ctx, query, id)
}

func (r *PostgresTicketRepository) GetByReference(ctx context.Context, reference string) (*domain.Ticket, error) {
	query := `
		SELECT t.id, t.event_day_id, t.tier_id, t.email, COALESCE(t.phone, ''), COALESCE(t.name, ''), t.user_id, t.quantity, t.unit_price, t.total_amount,
			t.status, t.paystack_reference, t.paystack_access_code, t.ticket_code, t.team_id,
			t.checked_in_at, t.checked_in_by, t.created_at, t.updated_at,
			ed.title, ed.date, ed.venue,
			tt.name, tt.price
		FROM tickets t
		JOIN event_days ed ON t.event_day_id = ed.id
		JOIN ticket_tiers tt ON t.tier_id = tt.id
		WHERE t.paystack_reference = $1
	`
	return r.scanTicketRow(ctx, query, reference)
}

func (r *PostgresTicketRepository) GetByCode(ctx context.Context, code string) (*domain.Ticket, error) {
	query := `
		SELECT t.id, t.event_day_id, t.tier_id, t.email, COALESCE(t.phone, ''), COALESCE(t.name, ''), t.user_id, t.quantity, t.unit_price, t.total_amount,
			t.status, t.paystack_reference, t.paystack_access_code, t.ticket_code, t.team_id,
			t.checked_in_at, t.checked_in_by, t.created_at, t.updated_at,
			ed.title, ed.date, ed.venue,
			tt.name, tt.price
		FROM tickets t
		JOIN event_days ed ON t.event_day_id = ed.id
		JOIN ticket_tiers tt ON t.tier_id = tt.id
		WHERE UPPER(t.ticket_code) = UPPER($1)
	`
	return r.scanTicketRow(ctx, query, code)
}

func (r *PostgresTicketRepository) scanTicketRow(ctx context.Context, query string, arg string) (*domain.Ticket, error) {
	var t domain.Ticket
	var edTitle, edVenue, tierName string
	var edDate interface{}
	var tierPrice int

	err := r.db.QueryRow(ctx, query, arg).Scan(
		&t.ID, &t.EventDayID, &t.TierID, &t.Email, &t.Phone, &t.Name, &t.UserID,
		&t.Quantity, &t.UnitPrice, &t.TotalAmount,
		&t.Status, &t.PaystackReference, &t.PaystackAccessCode, &t.TicketCode, &t.TeamID,
		&t.CheckedInAt, &t.CheckedInBy, &t.CreatedAt, &t.UpdatedAt,
		&edTitle, &edDate, &edVenue,
		&tierName, &tierPrice,
	)
	if err != nil {
		return nil, err
	}

	t.EventDay = &domain.EventDay{
		ID:    t.EventDayID,
		Title: edTitle,
		Venue: edVenue,
	}
	// Parse event day date
	switch v := edDate.(type) {
	case time.Time:
		t.EventDay.Date = v
	case string:
		if dt, err := time.Parse("2006-01-02", v); err == nil {
			t.EventDay.Date = dt
		}
	}

	t.Tier = &domain.TicketTier{
		ID:    t.TierID,
		Name:  tierName,
		Price: tierPrice,
	}

	return &t, nil
}

func (r *PostgresTicketRepository) SearchByEmail(ctx context.Context, email string) ([]domain.Ticket, error) {
	query := `
		SELECT t.id, t.event_day_id, t.tier_id, t.email, COALESCE(t.phone, ''), COALESCE(t.name, ''), t.user_id, t.quantity, t.unit_price, t.total_amount,
			t.status, t.paystack_reference, t.paystack_access_code, t.ticket_code, t.team_id,
			t.checked_in_at, t.checked_in_by, t.created_at, t.updated_at,
			ed.title, tt.name
		FROM tickets t
		JOIN event_days ed ON t.event_day_id = ed.id
		JOIN ticket_tiers tt ON t.tier_id = tt.id
		WHERE LOWER(t.email) = LOWER($1)
		ORDER BY t.created_at DESC
		LIMIT 20
	`
	rows, err := r.db.Query(ctx, query, email)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tickets []domain.Ticket
	for rows.Next() {
		var t domain.Ticket
		var edTitle, tierName string
		if err := rows.Scan(
			&t.ID, &t.EventDayID, &t.TierID, &t.Email, &t.Phone, &t.Name, &t.UserID,

			&t.Quantity, &t.UnitPrice, &t.TotalAmount,
			&t.Status, &t.PaystackReference, &t.PaystackAccessCode, &t.TicketCode, &t.TeamID,
			&t.CheckedInAt, &t.CheckedInBy, &t.CreatedAt, &t.UpdatedAt,
			&edTitle, &tierName,
		); err != nil {
			return nil, err
		}
		t.EventDay = &domain.EventDay{ID: t.EventDayID, Title: edTitle}
		t.Tier = &domain.TicketTier{ID: t.TierID, Name: tierName}
		tickets = append(tickets, t)
	}
	return tickets, nil
}

func (r *PostgresTicketRepository) UpdateStatus(ctx context.Context, id string, status domain.TicketStatus) error {
	query := `UPDATE tickets SET status = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.Exec(ctx, query, status, id)
	return err
}

func (r *PostgresTicketRepository) Checkin(ctx context.Context, id string, checkedInBy string) error {
	query := `UPDATE tickets SET status='USED', checked_in_at=NOW(), checked_in_by=$1, updated_at=NOW() WHERE id=$2 AND status='PAID'`
	result, err := r.db.Exec(ctx, query, checkedInBy, id)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("ticket already used or not in PAID status")
	}
	return nil
}

func (r *PostgresTicketRepository) AdminCheckin(ctx context.Context, id string, checkedInBy string) error {
	query := `UPDATE tickets SET status='USED', checked_in_at=NOW(), checked_in_by=$1, updated_at=NOW() WHERE id=$2 AND status != 'USED'`
	result, err := r.db.Exec(ctx, query, checkedInBy, id)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("ticket already checked in")
	}
	return nil
}

func (r *PostgresTicketRepository) List(ctx context.Context, eventDayID string, status string, page int, limit int) ([]domain.Ticket, int, error) {
	// Count query
	countQuery := `SELECT COUNT(*) FROM tickets WHERE 1=1`
	args := []interface{}{}
	argIdx := 1

	if eventDayID != "" {
		countQuery += fmt.Sprintf(" AND event_day_id=$%d", argIdx)
		args = append(args, eventDayID)
		argIdx++
	}
	if status != "" {
		countQuery += fmt.Sprintf(" AND status=$%d", argIdx)
		args = append(args, status)
		argIdx++
	}

	var total int
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	// Data query
	dataQuery := `
		SELECT t.id, t.event_day_id, t.tier_id, t.email, COALESCE(t.phone, ''), COALESCE(t.name, ''), t.user_id, t.quantity, t.unit_price, t.total_amount,
			t.status, t.paystack_reference, t.paystack_access_code, t.ticket_code, t.team_id,
			t.checked_in_at, t.checked_in_by, t.created_at, t.updated_at,
			ed.title, tt.name
		FROM tickets t
		JOIN event_days ed ON t.event_day_id = ed.id
		JOIN ticket_tiers tt ON t.tier_id = tt.id
		WHERE 1=1`

	dataArgs := []interface{}{}
	dataIdx := 1
	if eventDayID != "" {
		dataQuery += fmt.Sprintf(" AND t.event_day_id=$%d", dataIdx)
		dataArgs = append(dataArgs, eventDayID)
		dataIdx++
	}
	if status != "" {
		dataQuery += fmt.Sprintf(" AND t.status=$%d", dataIdx)
		dataArgs = append(dataArgs, status)
		dataIdx++
	}

	dataQuery += " ORDER BY t.created_at DESC"
	dataQuery += fmt.Sprintf(" LIMIT $%d OFFSET $%d", dataIdx, dataIdx+1)
	dataArgs = append(dataArgs, limit, (page-1)*limit)

	rows, err := r.db.Query(ctx, dataQuery, dataArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var tickets []domain.Ticket
	for rows.Next() {
		var t domain.Ticket
		var edTitle, tierName string
		if err := rows.Scan(
			&t.ID, &t.EventDayID, &t.TierID, &t.Email, &t.Phone, &t.Name, &t.UserID,

			&t.Quantity, &t.UnitPrice, &t.TotalAmount,
			&t.Status, &t.PaystackReference, &t.PaystackAccessCode, &t.TicketCode, &t.TeamID,
			&t.CheckedInAt, &t.CheckedInBy, &t.CreatedAt, &t.UpdatedAt,
			&edTitle, &tierName,
		); err != nil {
			return nil, 0, err
		}
		t.EventDay = &domain.EventDay{ID: t.EventDayID, Title: edTitle}
		t.Tier = &domain.TicketTier{ID: t.TierID, Name: tierName}
		tickets = append(tickets, t)
	}
	return tickets, total, nil
}

func (r *PostgresTicketRepository) ExpirePastTickets(ctx context.Context) (int64, error) {
	query := `
		UPDATE tickets 
		SET status = CASE 
			WHEN tickets.status = 'PAID' THEN 'EXPIRED'
			ELSE 'CANCELLED'
		END, 
		updated_at = NOW() 
		FROM event_days 
		WHERE tickets.event_day_id = event_days.id 
		  AND event_days.date < CURRENT_DATE 
		  AND tickets.status IN ('PAID', 'PENDING', 'FAILED')
	`
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
	query := `
		SELECT t.id, t.event_day_id, t.tier_id, t.email, COALESCE(t.phone, ''), COALESCE(t.name, ''), t.user_id, t.quantity, t.unit_price, t.total_amount,
			t.status, t.paystack_reference, t.paystack_access_code, t.ticket_code, t.team_id,
			t.checked_in_at, t.checked_in_by, t.created_at, t.updated_at,
			ed.title, tt.name
		FROM tickets t
		JOIN event_days ed ON t.event_day_id = ed.id
		JOIN ticket_tiers tt ON t.tier_id = tt.id
		WHERE t.status IN ('PAID', 'USED')
		ORDER BY t.created_at DESC
		LIMIT $1
	`
	rows, err := r.db.Query(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tickets []domain.Ticket
	for rows.Next() {
		var t domain.Ticket
		var edTitle, tierName string
		if err := rows.Scan(
			&t.ID, &t.EventDayID, &t.TierID, &t.Email, &t.Phone, &t.Name, &t.UserID,

			&t.Quantity, &t.UnitPrice, &t.TotalAmount,
			&t.Status, &t.PaystackReference, &t.PaystackAccessCode, &t.TicketCode, &t.TeamID,
			&t.CheckedInAt, &t.CheckedInBy, &t.CreatedAt, &t.UpdatedAt,
			&edTitle, &tierName,
		); err != nil {
			return nil, err
		}
		t.EventDay = &domain.EventDay{ID: t.EventDayID, Title: edTitle}
		t.Tier = &domain.TicketTier{ID: t.TierID, Name: tierName}
		tickets = append(tickets, t)
	}
	return tickets, nil
}

func (r *PostgresTicketRepository) CountByTeamAndEventDay(ctx context.Context, teamID string, eventDayID string) (int, error) {
	query := `SELECT COUNT(*) FROM tickets WHERE team_id = $1 AND event_day_id = $2`
	var count int
	err := r.db.QueryRow(ctx, query, teamID, eventDayID).Scan(&count)
	return count, err
}
