package ports

import (
	"context"
	"fmt"

	"showtime-backend/internal/domain"

	"github.com/jackc/pgx/v5/pgxpool"
)

type TicketRepository interface {
	Create(ctx context.Context, ticket *domain.Ticket) error
	GetByID(ctx context.Context, id string) (*domain.Ticket, error)
	GetByReference(ctx context.Context, reference string) (*domain.Ticket, error)
	GetByCode(ctx context.Context, code string) (*domain.Ticket, error)
	UpdateStatus(ctx context.Context, id string, status domain.TicketStatus, accessCode string, ticketCode string) error
	Checkin(ctx context.Context, id string, checkedInBy string) error
	List(ctx context.Context, matchID string, status string, page int, limit int) ([]domain.Ticket, int, error)
}

type PostgresTicketRepository struct {
	db *pgxpool.Pool
}

func NewTicketRepository(db *pgxpool.Pool) *PostgresTicketRepository {
	return &PostgresTicketRepository{db: db}
}

func (r *PostgresTicketRepository) Create(ctx context.Context, ticket *domain.Ticket) error {
	query := `
		INSERT INTO tickets (match_id, email, user_id, quantity, unit_price, total_amount, status, paystack_reference, paystack_access_code, ticket_code)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, created_at, updated_at
	`
	return r.db.QueryRow(ctx, query,
		ticket.MatchID, ticket.Email, ticket.UserID, ticket.Quantity,
		ticket.UnitPrice, ticket.TotalAmount, ticket.Status,
		ticket.PaystackReference, ticket.PaystackAccessCode, ticket.TicketCode,
	).Scan(&ticket.ID, &ticket.CreatedAt, &ticket.UpdatedAt)
}

func (r *PostgresTicketRepository) GetByID(ctx context.Context, id string) (*domain.Ticket, error) {
	query := `
		SELECT t.id, t.match_id, t.email, t.user_id, t.quantity, t.unit_price, t.total_amount,
			t.status, t.paystack_reference, t.paystack_access_code, t.ticket_code,
			t.checked_in_at, t.checked_in_by, t.created_at, t.updated_at,
			m.date, m.venue, m.status,
			ht.name, at.name
		FROM tickets t
		JOIN matches m ON t.match_id = m.id
		JOIN teams ht ON m.home_team_id = ht.id
		JOIN teams at ON m.away_team_id = at.id
		WHERE t.id = $1
	`
	return r.scanTicketRow(ctx, query, id)
}

func (r *PostgresTicketRepository) GetByReference(ctx context.Context, reference string) (*domain.Ticket, error) {
	query := `
		SELECT t.id, t.match_id, t.email, t.user_id, t.quantity, t.unit_price, t.total_amount,
			t.status, t.paystack_reference, t.paystack_access_code, t.ticket_code,
			t.checked_in_at, t.checked_in_by, t.created_at, t.updated_at,
			m.date, m.venue, m.status,
			ht.name, at.name
		FROM tickets t
		JOIN matches m ON t.match_id = m.id
		JOIN teams ht ON m.home_team_id = ht.id
		JOIN teams at ON m.away_team_id = at.id
		WHERE t.paystack_reference = $1
	`
	return r.scanTicketRow(ctx, query, reference)
}

func (r *PostgresTicketRepository) GetByCode(ctx context.Context, code string) (*domain.Ticket, error) {
	query := `
		SELECT t.id, t.match_id, t.email, t.user_id, t.quantity, t.unit_price, t.total_amount,
			t.status, t.paystack_reference, t.paystack_access_code, t.ticket_code,
			t.checked_in_at, t.checked_in_by, t.created_at, t.updated_at,
			m.date, m.venue, m.status,
			ht.name, at.name
		FROM tickets t
		JOIN matches m ON t.match_id = m.id
		JOIN teams ht ON m.home_team_id = ht.id
		JOIN teams at ON m.away_team_id = at.id
		WHERE t.ticket_code = $1
	`
	return r.scanTicketRow(ctx, query, code)
}

func (r *PostgresTicketRepository) scanTicketRow(ctx context.Context, query string, arg string) (*domain.Ticket, error) {
	var t domain.Ticket
	var matchDate, matchVenue, matchStatus string
	var homeTeam, awayTeam string
	err := r.db.QueryRow(ctx, query, arg).Scan(
		&t.ID, &t.MatchID, &t.Email, &t.UserID, &t.Quantity, &t.UnitPrice, &t.TotalAmount,
		&t.Status, &t.PaystackReference, &t.PaystackAccessCode, &t.TicketCode,
		&t.CheckedInAt, &t.CheckedInBy, &t.CreatedAt, &t.UpdatedAt,
		&matchDate, &matchVenue, &matchStatus,
		&homeTeam, &awayTeam,
	)
	if err != nil {
		return nil, err
	}
	t.Match = &domain.Match{
		ID:    t.MatchID,
		Venue: matchVenue,
	}
	t.Match.HomeTeam = &domain.Team{Name: homeTeam}
	t.Match.AwayTeam = &domain.Team{Name: awayTeam}
	return &t, nil
}

func (r *PostgresTicketRepository) UpdateStatus(ctx context.Context, id string, status domain.TicketStatus, accessCode string, ticketCode string) error {
	query := `UPDATE tickets SET status=$1, paystack_access_code=$2, ticket_code=$3, updated_at=NOW() WHERE id=$4`
	_, err := r.db.Exec(ctx, query, status, accessCode, ticketCode, id)
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

func (r *PostgresTicketRepository) List(ctx context.Context, matchID string, status string, page int, limit int) ([]domain.Ticket, int, error) {
	// Count query
	countQuery := `SELECT COUNT(*) FROM tickets WHERE 1=1`
	args := []interface{}{}
	argIdx := 1

	if matchID != "" {
		countQuery += fmt.Sprintf(" AND match_id=$%d", argIdx)
		args = append(args, matchID)
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
		SELECT t.id, t.match_id, t.email, t.user_id, t.quantity, t.unit_price, t.total_amount,
			t.status, t.paystack_reference, t.paystack_access_code, t.ticket_code,
			t.checked_in_at, t.checked_in_by, t.created_at, t.updated_at,
			ht.name, at.name
		FROM tickets t
		JOIN matches m ON t.match_id = m.id
		JOIN teams ht ON m.home_team_id = ht.id
		JOIN teams at ON m.away_team_id = at.id
		WHERE 1=1`

	dataArgs := []interface{}{}
	dataIdx := 1
	if matchID != "" {
		dataQuery += fmt.Sprintf(" AND t.match_id=$%d", dataIdx)
		dataArgs = append(dataArgs, matchID)
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
		var homeTeam, awayTeam string
		if err := rows.Scan(
			&t.ID, &t.MatchID, &t.Email, &t.UserID, &t.Quantity, &t.UnitPrice, &t.TotalAmount,
			&t.Status, &t.PaystackReference, &t.PaystackAccessCode, &t.TicketCode,
			&t.CheckedInAt, &t.CheckedInBy, &t.CreatedAt, &t.UpdatedAt,
			&homeTeam, &awayTeam,
		); err != nil {
			return nil, 0, err
		}
		t.Match = &domain.Match{ID: t.MatchID}
		t.Match.HomeTeam = &domain.Team{Name: homeTeam}
		t.Match.AwayTeam = &domain.Team{Name: awayTeam}
		tickets = append(tickets, t)
	}
	return tickets, total, nil
}
