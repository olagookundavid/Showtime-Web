package ports

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"showtime-backend/internal/domain"
)

// PlayerTicketMatch is a match as player tickets need it: when and where it is
// played, the two teams, and the game day its tickets are for.
type PlayerTicketMatch struct {
	ID          string
	Date        time.Time
	Kickoff     string // HH:MM, empty when not set
	Status      string
	Venue       string
	Competition string
	HomeTeamID  string
	HomeTeam    string
	AwayTeamID  string
	AwayTeam    string
}

// SheetPlayer is one player named on a team's sheet for a match.
type SheetPlayer struct {
	PlayerID     string
	Name         string
	JerseyNumber int
	Position     string
	Image        string
	// Email is where their ticket is sent: the player's own, else the email of the
	// account that claimed them. Empty when there is neither.
	Email     string
	IsStarter bool
}

// MyPlayerTicketRow is a player ticket with the match it is for, as a player sees it.
type MyPlayerTicketRow struct {
	TicketID    string
	TicketCode  string
	Status      string
	CheckedInAt *time.Time
	TeamID      string
	TeamName    string
	Match       PlayerTicketMatch
}

// SheetRef is one team's sheet for one match.
type SheetRef struct {
	MatchID string
	TeamID  string
}

// PlayerTicketRepository reads team sheets and the player tickets issued from them.
// Tickets themselves are created and checked in through TicketRepository, so a
// player ticket is the same row the gate already knows how to handle.
type PlayerTicketRepository interface {
	GetMatch(ctx context.Context, matchID string) (*PlayerTicketMatch, error)
	// EnsureGameDay returns the match day a match is played on, creating it if no
	// match day exists for that date yet.
	EnsureGameDay(ctx context.Context, matchID string) (string, error)
	SheetPlayers(ctx context.Context, matchID, teamID string) ([]SheetPlayer, error)
	// LiveTickets is every player ticket for a team's sheet that has not been cancelled.
	LiveTickets(ctx context.Context, matchID, teamID string) ([]domain.Ticket, error)
	// CancelUnused cancels the given player tickets, except any already checked in:
	// a player who came through the gate keeps the record. Returns how many changed.
	CancelUnused(ctx context.Context, ticketIDs []string) (int64, error)
	// TeamSheets is every match a team has named a sheet for, newest first.
	TeamSheets(ctx context.Context, teamID string, limit int) ([]SheetRef, error)
	// SheetsOnDay is every team sheet for the matches on one match day.
	SheetsOnDay(ctx context.Context, eventDayID string) ([]SheetRef, error)
	// SheetDays is every match day that has at least one team sheet, newest first.
	SheetDays(ctx context.Context, limit int) ([]domain.EventDay, error)
	GetDay(ctx context.Context, eventDayID string) (*domain.EventDay, error)
	// Holder is who a player ticket admits and for which match.
	Holder(ctx context.Context, ticketID string) (*domain.PlayerTicketHolder, error)
	// MyTickets is the live player tickets of the player an account is linked to,
	// upcoming matches first (soonest first), then played ones (latest first).
	// linked is false when the account has no player behind it.
	MyTickets(ctx context.Context, userID string, limit int) (tickets []MyPlayerTicketRow, linked bool, err error)
}

type PostgresPlayerTicketRepository struct {
	db *pgxpool.Pool
}

func NewPlayerTicketRepository(db *pgxpool.Pool) *PostgresPlayerTicketRepository {
	return &PostgresPlayerTicketRepository{db: db}
}

func (r *PostgresPlayerTicketRepository) GetMatch(ctx context.Context, matchID string) (*PlayerTicketMatch, error) {
	var m PlayerTicketMatch
	err := r.db.QueryRow(ctx, `
		SELECT m.id, m.date, CASE WHEN m.time = '00:00' THEN '' ELSE to_char(m.time, 'HH24:MI') END,
		       COALESCE(m.status, ''), COALESCE(m.venue, ''), COALESCE(c.name, ''),
		       COALESCE(m.home_team_id::text, ''), COALESCE(ht.name, ''),
		       COALESCE(m.away_team_id::text, ''), COALESCE(at.name, '')
		FROM matches m
		LEFT JOIN competitions c ON c.id = m.competition_id
		LEFT JOIN teams ht ON ht.id = m.home_team_id
		LEFT JOIN teams at ON at.id = m.away_team_id
		WHERE m.id = $1`, matchID,
	).Scan(&m.ID, &m.Date, &m.Kickoff, &m.Status, &m.Venue, &m.Competition,
		&m.HomeTeamID, &m.HomeTeam, &m.AwayTeamID, &m.AwayTeam)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *PostgresPlayerTicketRepository) EnsureGameDay(ctx context.Context, matchID string) (string, error) {
	// The match's own day when it has one, else the day on its date (event_days.date
	// is unique). Created the way ticket products create theirs when neither exists.
	const find = `
		SELECT ed.id FROM matches m
		JOIN event_days ed ON ed.id = m.event_day_id OR ed.date = m.date
		WHERE m.id = $1
		ORDER BY (ed.id = m.event_day_id) DESC NULLS LAST
		LIMIT 1`
	var id string
	err := r.db.QueryRow(ctx, find, matchID).Scan(&id)
	if err == nil {
		return id, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}
	if _, err := r.db.Exec(ctx, `
		INSERT INTO event_days (title, date, venue, is_active)
		SELECT 'Game Day · ' || to_char(m.date, 'FMDD Mon'), m.date,
		       COALESCE(NULLIF(m.venue, ''), 'Showtime Arena'), TRUE
		FROM matches m WHERE m.id = $1
		ON CONFLICT (date) DO NOTHING`, matchID); err != nil {
		return "", err
	}
	err = r.db.QueryRow(ctx, find, matchID).Scan(&id)
	return id, err
}

func (r *PostgresPlayerTicketRepository) SheetPlayers(ctx context.Context, matchID, teamID string) ([]SheetPlayer, error) {
	rows, err := r.db.Query(ctx, `
		SELECT p.id, p.name, COALESCE(p.jersey_number, 0), COALESCE(p.position, ''), COALESCE(p.image, ''),
		       COALESCE(NULLIF(TRIM(p.email), ''), u.email, ''), mts.is_starter
		FROM match_team_sheets mts
		JOIN players p ON p.id = mts.player_id
		LEFT JOIN users u ON u.id = p.user_id
		WHERE mts.match_id = $1 AND mts.team_id = $2
		ORDER BY mts.is_starter DESC, COALESCE(p.jersey_number, 0), p.name`, matchID, teamID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []SheetPlayer{}
	for rows.Next() {
		var p SheetPlayer
		if err := rows.Scan(&p.PlayerID, &p.Name, &p.JerseyNumber, &p.Position, &p.Image, &p.Email, &p.IsStarter); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *PostgresPlayerTicketRepository) LiveTickets(ctx context.Context, matchID, teamID string) ([]domain.Ticket, error) {
	rows, err := r.db.Query(ctx, `
		SELECT `+ticketColumns+` FROM tickets t
		WHERE t.purchase_type = 'PLAYER' AND t.match_id = $1 AND t.team_id = $2 AND t.status <> 'CANCELLED'
		ORDER BY t.created_at`, matchID, teamID)
	if err != nil {
		return nil, err
	}
	return (&PostgresTicketRepository{db: r.db}).scanTickets(ctx, rows)
}

func (r *PostgresPlayerTicketRepository) CancelUnused(ctx context.Context, ticketIDs []string) (int64, error) {
	if len(ticketIDs) == 0 {
		return 0, nil
	}
	tag, err := r.db.Exec(ctx, `
		UPDATE tickets t SET status = 'CANCELLED', updated_at = NOW()
		WHERE t.id = ANY($1::uuid[]) AND t.purchase_type = 'PLAYER' AND t.status = 'PAID'
		  AND NOT EXISTS (SELECT 1 FROM ticket_days td WHERE td.ticket_id = t.id AND td.checked_in_at IS NOT NULL)`,
		ticketIDs)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

func scanSheetRefs(rows pgx.Rows) ([]SheetRef, error) {
	defer rows.Close()
	out := []SheetRef{}
	for rows.Next() {
		var s SheetRef
		if err := rows.Scan(&s.MatchID, &s.TeamID); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func (r *PostgresPlayerTicketRepository) TeamSheets(ctx context.Context, teamID string, limit int) ([]SheetRef, error) {
	rows, err := r.db.Query(ctx, `
		SELECT m.id::text, $1::uuid::text
		FROM matches m
		WHERE EXISTS (SELECT 1 FROM match_team_sheets mts WHERE mts.match_id = m.id AND mts.team_id = $1::uuid)
		ORDER BY m.date DESC, m.time DESC
		LIMIT $2`, teamID, limit)
	if err != nil {
		return nil, err
	}
	return scanSheetRefs(rows)
}

func (r *PostgresPlayerTicketRepository) SheetsOnDay(ctx context.Context, eventDayID string) ([]SheetRef, error) {
	// By kickoff, then the home team's sheet before the away team's.
	rows, err := r.db.Query(ctx, `
		SELECT x.match_id, x.team_id FROM (
			SELECT DISTINCT m.id::text AS match_id, mts.team_id::text AS team_id, m.time,
			       (mts.team_id IS DISTINCT FROM m.home_team_id) AS away_side
			FROM event_days ed
			JOIN matches m ON m.event_day_id = ed.id OR m.date = ed.date
			JOIN match_team_sheets mts ON mts.match_id = m.id
			WHERE ed.id = $1
		) x
		ORDER BY x.time, x.match_id, x.away_side`, eventDayID)
	if err != nil {
		return nil, err
	}
	return scanSheetRefs(rows)
}

func (r *PostgresPlayerTicketRepository) SheetDays(ctx context.Context, limit int) ([]domain.EventDay, error) {
	rows, err := r.db.Query(ctx, `
		SELECT ed.id, ed.title, ed.date, COALESCE(ed.venue, ''), ed.is_active
		FROM event_days ed
		WHERE EXISTS (
			SELECT 1 FROM matches m JOIN match_team_sheets mts ON mts.match_id = m.id
			WHERE m.event_day_id = ed.id OR m.date = ed.date)
		ORDER BY ed.date DESC
		LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.EventDay{}
	for rows.Next() {
		var ed domain.EventDay
		if err := rows.Scan(&ed.ID, &ed.Title, &ed.Date, &ed.Venue, &ed.IsActive); err != nil {
			return nil, err
		}
		out = append(out, ed)
	}
	return out, rows.Err()
}

func (r *PostgresPlayerTicketRepository) Holder(ctx context.Context, ticketID string) (*domain.PlayerTicketHolder, error) {
	var h domain.PlayerTicketHolder
	var matchDate *time.Time
	err := r.db.QueryRow(ctx, `
		SELECT COALESCE(p.id::text, ''), COALESCE(p.name, t.name, ''), COALESCE(p.jersey_number, 0),
		       COALESCE(p.position, ''), COALESCE(p.image, ''),
		       COALESCE(t.team_id::text, ''), COALESCE(tm.name, ''),
		       COALESCE(m.id::text, ''), COALESCE(ht.name, ''), COALESCE(at.name, ''), COALESCE(c.name, ''),
		       m.date, CASE WHEN m.time IS NULL OR m.time = '00:00' THEN '' ELSE to_char(m.time, 'HH24:MI') END
		FROM tickets t
		LEFT JOIN players p ON p.id = t.player_id
		LEFT JOIN teams tm ON tm.id = t.team_id
		LEFT JOIN matches m ON m.id = t.match_id
		LEFT JOIN teams ht ON ht.id = m.home_team_id
		LEFT JOIN teams at ON at.id = m.away_team_id
		LEFT JOIN competitions c ON c.id = m.competition_id
		WHERE t.id = $1 AND t.purchase_type = 'PLAYER'`, ticketID,
	).Scan(&h.PlayerID, &h.Name, &h.JerseyNumber, &h.Position, &h.Image,
		&h.TeamID, &h.TeamName, &h.MatchID, &h.HomeTeam, &h.AwayTeam, &h.Competition,
		&matchDate, &h.Kickoff)
	if err != nil {
		return nil, err
	}
	if matchDate != nil {
		h.MatchDate = *matchDate
	}
	return &h, nil
}

// GetDay is one match day, for the heading of a day's sheets.
func (r *PostgresPlayerTicketRepository) GetDay(ctx context.Context, eventDayID string) (*domain.EventDay, error) {
	var ed domain.EventDay
	err := r.db.QueryRow(ctx, `SELECT id, title, date, COALESCE(venue, ''), is_active FROM event_days WHERE id = $1`, eventDayID).
		Scan(&ed.ID, &ed.Title, &ed.Date, &ed.Venue, &ed.IsActive)
	if err != nil {
		return nil, err
	}
	return &ed, nil
}

func (r *PostgresPlayerTicketRepository) MyTickets(ctx context.Context, userID string, limit int) ([]MyPlayerTicketRow, bool, error) {
	var linked bool
	if err := r.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM players WHERE user_id = $1::uuid)`, userID).Scan(&linked); err != nil {
		return nil, false, err
	}
	if !linked {
		return nil, false, nil
	}
	rows, err := r.db.Query(ctx, `
		SELECT t.id::text, t.ticket_code, t.status, 
		       (SELECT MIN(td.checked_in_at) FROM ticket_days td WHERE td.ticket_id = t.id),
		       COALESCE(t.team_id::text, ''), COALESCE(tm.name, ''),
		       m.id::text, m.date, CASE WHEN m.time = '00:00' THEN '' ELSE to_char(m.time, 'HH24:MI') END,
		       COALESCE(m.status, ''), COALESCE(m.venue, ''), COALESCE(c.name, ''),
		       COALESCE(m.home_team_id::text, ''), COALESCE(ht.name, ''),
		       COALESCE(m.away_team_id::text, ''), COALESCE(at.name, '')
		FROM tickets t
		JOIN players p ON p.id = t.player_id AND p.user_id = $1::uuid
		JOIN matches m ON m.id = t.match_id
		LEFT JOIN teams tm ON tm.id = t.team_id
		LEFT JOIN competitions c ON c.id = m.competition_id
		LEFT JOIN teams ht ON ht.id = m.home_team_id
		LEFT JOIN teams at ON at.id = m.away_team_id
		WHERE t.purchase_type = 'PLAYER' AND t.status IN ('PAID', 'USED', 'EXPIRED')
		ORDER BY (m.date < `+lagosToday+`), 
		         CASE WHEN m.date >= `+lagosToday+` THEN m.date END ASC,
		         m.date DESC, m.time DESC
		LIMIT $2`, userID, limit)
	if err != nil {
		return nil, true, err
	}
	defer rows.Close()
	out := []MyPlayerTicketRow{}
	for rows.Next() {
		var x MyPlayerTicketRow
		if err := rows.Scan(&x.TicketID, &x.TicketCode, &x.Status, &x.CheckedInAt, &x.TeamID, &x.TeamName,
			&x.Match.ID, &x.Match.Date, &x.Match.Kickoff, &x.Match.Status, &x.Match.Venue, &x.Match.Competition,
			&x.Match.HomeTeamID, &x.Match.HomeTeam, &x.Match.AwayTeamID, &x.Match.AwayTeam); err != nil {
			return nil, true, err
		}
		out = append(out, x)
	}
	return out, true, rows.Err()
}
