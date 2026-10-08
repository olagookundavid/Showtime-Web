package ports

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// IBroadcastStateRepository stores each match's broadcast state as an opaque
// JSON document (the broadcast package owns its shape), plus the event-day
// channels that pick which match a day's overlay shows.
type IBroadcastStateRepository interface {
	// Load returns the stored state, or nil when none exists for the match.
	Load(ctx context.Context, matchID string) ([]byte, error)
	Save(ctx context.Context, matchID string, state []byte) error

	// LoadDayOnAir returns the match a day's overlay shows, or "" for none.
	LoadDayOnAir(ctx context.Context, date string) (string, error)
	// SaveDayOnAir sets the day's on-air match; "" takes the day off air.
	SaveDayOnAir(ctx context.Context, date, matchID string) error
	// ListMatchDays returns today and upcoming days that have matches, soonest
	// first. Past days are left out.
	ListMatchDays(ctx context.Context, page, limit int) ([]BroadcastMatchDay, int, error)
	// GetMatchDay returns one day's summary (zero matches if none are scheduled).
	GetMatchDay(ctx context.Context, date string) (BroadcastMatchDay, error)
	// ListDayMatches returns every match on the date, across competitions.
	ListDayMatches(ctx context.Context, date string) ([]BroadcastDayMatch, error)
}

// BroadcastMatchDay is a date with matches, titled by its event day when one
// exists for that date.
type BroadcastMatchDay struct {
	Date           string `json:"date"`
	MatchCount     int    `json:"match_count"`
	EventTitle     string `json:"event_title,omitempty"`
	EventVenue     string `json:"event_venue,omitempty"`
	OnAirMatchID   string `json:"on_air_match_id,omitempty"`
	LiveMatchCount int    `json:"live_match_count"`
}

type BroadcastDayTeam struct {
	Name string `json:"name"`
	Logo string `json:"logo"`
}

type BroadcastDayMatch struct {
	ID              string           `json:"id"`
	CompetitionName string           `json:"competition_name"`
	Time            string           `json:"time"`
	Venue           string           `json:"venue"`
	Status          string           `json:"status"`
	HomeTeam        BroadcastDayTeam `json:"home_team"`
	AwayTeam        BroadcastDayTeam `json:"away_team"`
	HomeScore       *int             `json:"home_score"`
	AwayScore       *int             `json:"away_score"`
}

type PostgresBroadcastStateRepository struct {
	db *pgxpool.Pool
}

func NewBroadcastStateRepository(db *pgxpool.Pool) IBroadcastStateRepository {
	return &PostgresBroadcastStateRepository{db: db}
}

func (r *PostgresBroadcastStateRepository) Load(ctx context.Context, matchID string) ([]byte, error) {
	query := `SELECT state FROM broadcast_states WHERE match_id = $1`

	var state []byte
	err := r.db.QueryRow(ctx, query, matchID).Scan(&state)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	// The overlay endpoint is public, so a malformed match ID is just "not found".
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "22P02" {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return state, nil
}

func (r *PostgresBroadcastStateRepository) Save(ctx context.Context, matchID string, state []byte) error {
	query := `
		INSERT INTO broadcast_states (match_id, state, updated_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (match_id)
		DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()
	`
	_, err := r.db.Exec(ctx, query, matchID, state)
	return err
}

func (r *PostgresBroadcastStateRepository) LoadDayOnAir(ctx context.Context, date string) (string, error) {
	query := `SELECT COALESCE(on_air_match_id::text, '') FROM broadcast_days WHERE date = $1`

	var matchID string
	err := r.db.QueryRow(ctx, query, date).Scan(&matchID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	return matchID, err
}

func (r *PostgresBroadcastStateRepository) SaveDayOnAir(ctx context.Context, date, matchID string) error {
	query := `
		INSERT INTO broadcast_days (date, on_air_match_id, updated_at)
		VALUES ($1, NULLIF($2, '')::uuid, NOW())
		ON CONFLICT (date)
		DO UPDATE SET on_air_match_id = EXCLUDED.on_air_match_id, updated_at = NOW()
	`
	_, err := r.db.Exec(ctx, query, date, matchID)
	return err
}

// matchDaySelect summarises match days; the caller adds WHERE/ORDER/LIMIT.
const matchDaySelect = `
	SELECT to_char(m.date, 'YYYY-MM-DD'),
		COUNT(*)::int,
		COUNT(*) FILTER (WHERE m.status = 'LIVE')::int,
		COALESCE(MAX(ed.title), ''),
		COALESCE(MAX(ed.venue), ''),
		COALESCE(MAX(bd.on_air_match_id::text), '')
	FROM matches m
	LEFT JOIN event_days ed ON ed.date = m.date
	LEFT JOIN broadcast_days bd ON bd.date = m.date
`

func scanMatchDay(row pgx.Row) (BroadcastMatchDay, error) {
	var d BroadcastMatchDay
	err := row.Scan(&d.Date, &d.MatchCount, &d.LiveMatchCount, &d.EventTitle, &d.EventVenue, &d.OnAirMatchID)
	return d, err
}

func (r *PostgresBroadcastStateRepository) ListMatchDays(ctx context.Context, page, limit int) ([]BroadcastMatchDay, int, error) {
	// A producer only streams what's coming, so past days are left out and the
	// next match day comes first. Match days are dated in Lagos time, so
	// "today" is taken there, not in the database's zone.
	const upcoming = ` WHERE m.date >= (NOW() AT TIME ZONE 'Africa/Lagos')::date`

	var total int
	if err := r.db.QueryRow(ctx, `SELECT COUNT(DISTINCT m.date)::int FROM matches m`+upcoming).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := matchDaySelect + upcoming + ` GROUP BY m.date ORDER BY m.date ASC LIMIT $1 OFFSET $2`
	rows, err := r.db.Query(ctx, query, limit, (page-1)*limit)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	days := make([]BroadcastMatchDay, 0, limit)
	for rows.Next() {
		d, err := scanMatchDay(rows)
		if err != nil {
			return nil, 0, err
		}
		days = append(days, d)
	}
	return days, total, rows.Err()
}

func (r *PostgresBroadcastStateRepository) GetMatchDay(ctx context.Context, date string) (BroadcastMatchDay, error) {
	d, err := scanMatchDay(r.db.QueryRow(ctx, matchDaySelect+` WHERE m.date = $1 GROUP BY m.date`, date))
	if errors.Is(err, pgx.ErrNoRows) {
		// No matches that day: still report the event day and on-air choice, if any.
		d = BroadcastMatchDay{Date: date}
		_ = r.db.QueryRow(ctx, `SELECT title, venue FROM event_days WHERE date = $1`, date).Scan(&d.EventTitle, &d.EventVenue)
		onAir, loadErr := r.LoadDayOnAir(ctx, date)
		d.OnAirMatchID = onAir
		return d, loadErr
	}
	return d, err
}

func (r *PostgresBroadcastStateRepository) ListDayMatches(ctx context.Context, date string) ([]BroadcastDayMatch, error) {
	query := `
		SELECT m.id::text, COALESCE(c.name, ''), to_char(m.time, 'HH24:MI'), COALESCE(m.venue, ''), COALESCE(m.status, 'SCHEDULED'),
			COALESCE(ht.name, ''), COALESCE(ht.logo, ''), COALESCE(at.name, ''), COALESCE(at.logo, ''),
			m.home_score, m.away_score
		FROM matches m
		LEFT JOIN competitions c ON c.id = m.competition_id
		LEFT JOIN teams ht ON ht.id = m.home_team_id
		LEFT JOIN teams at ON at.id = m.away_team_id
		WHERE m.date = $1
		ORDER BY m.time ASC, ht.name ASC
	`
	rows, err := r.db.Query(ctx, query, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	matches := make([]BroadcastDayMatch, 0)
	for rows.Next() {
		var m BroadcastDayMatch
		if err := rows.Scan(&m.ID, &m.CompetitionName, &m.Time, &m.Venue, &m.Status,
			&m.HomeTeam.Name, &m.HomeTeam.Logo, &m.AwayTeam.Name, &m.AwayTeam.Logo,
			&m.HomeScore, &m.AwayScore); err != nil {
			return nil, err
		}
		matches = append(matches, m)
	}
	return matches, rows.Err()
}
