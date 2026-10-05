package ports

import (
	"context"
	"errors"
	"fmt"
	"showtime-backend/internal/domain"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrPOTWNotNominee is returned when a vote names a player who is not on the ballot.
var ErrPOTWNotNominee = errors.New("that player is not one of this week's nominees")

type POTWRepository interface {
	GetPollByID(ctx context.Context, pollID string) (*domain.POTWPoll, error)
	GetPollByTOTWID(ctx context.Context, totwID string) (*domain.POTWPoll, error)
	GetLatestPublicPoll(ctx context.Context) (*domain.POTWPoll, error)
	ListPublicPolls(ctx context.Context) ([]domain.POTWPoll, error)
	HasPoll(ctx context.Context, totwID string) (bool, error)

	CreatePoll(ctx context.Context, poll *domain.POTWPoll, nomineeIDs []string) error
	UpdatePoll(ctx context.Context, poll *domain.POTWPoll, nomineeIDs []string) error
	DeletePoll(ctx context.Context, totwID string) error

	CastVote(ctx context.Context, pollID, userID, playerID string) error
	GetUserVote(ctx context.Context, pollID, userID string) (*string, error)

	ListDuePollIDs(ctx context.Context) ([]string, error)
	FinalizePoll(ctx context.Context, pollID string, now time.Time) (totwID string, applied bool, err error)
	SetWinner(ctx context.Context, pollID string, playerID *string, source *string, finalized bool) (totwID string, err error)
	ResetResultNotification(ctx context.Context, pollID string) error

	ClaimOpenAnnouncements(ctx context.Context) ([]POTWAnnouncement, error)
	ClaimResultAnnouncements(ctx context.Context) ([]POTWAnnouncement, error)
}

// POTWAnnouncement is what a fan notification about a poll needs.
type POTWAnnouncement struct {
	PollID       string
	WeekTitle    string
	ClosesAt     time.Time
	Nominees     int
	WinnerName   string
	WinnerSource string
}

type PostgresPOTWRepository struct {
	db *pgxpool.Pool
}

func NewPOTWRepository(db *pgxpool.Pool) *PostgresPOTWRepository {
	return &PostgresPOTWRepository{db: db}
}

// potwQuerier is what both the pool and a transaction offer, so the loaders below
// work inside FinalizePoll's transaction as well as on their own.
type potwQuerier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

const potwPollSelect = `
	SELECT pp.id, pp.totw_id, pp.opens_at, pp.closes_at, pp.finalized_at,
	       pp.winner_player_id::text, pp.winner_source, pp.created_by::text,
	       pp.created_at, pp.updated_at,
	       tw.is_published, tw.week_title, tw.headline, tw.competition_id::text,
	       COALESCE(c.name, ''), tw.player_of_the_week_id::text
	FROM potw_polls pp
	JOIN team_of_the_week tw ON tw.id = pp.totw_id
	LEFT JOIN competitions c ON c.id = tw.competition_id
`

func scanPOTWPoll(row pgx.Row) (*domain.POTWPoll, error) {
	var p domain.POTWPoll
	err := row.Scan(
		&p.ID, &p.TOTWID, &p.OpensAt, &p.ClosesAt, &p.FinalizedAt,
		&p.WinnerPlayerID, &p.WinnerSource, &p.CreatedBy,
		&p.CreatedAt, &p.UpdatedAt,
		&p.TOTWPublished, &p.WeekTitle, &p.Headline, &p.CompetitionID,
		&p.CompetitionName, &p.TOTWPOTWID,
	)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// loadPollDetail fills a poll's nominees (with vote counts), total votes and the
// votes-per-day breakdown.
func loadPollDetail(ctx context.Context, q potwQuerier, p *domain.POTWPoll) error {
	nominees, err := loadNominees(ctx, q, p.ID)
	if err != nil {
		return err
	}
	p.Nominees = nominees
	p.TotalVotes = 0
	for _, n := range nominees {
		p.TotalVotes += n.Votes
	}

	rows, err := q.Query(ctx, `
		SELECT date_trunc('day', created_at), COUNT(*)
		FROM potw_votes WHERE poll_id = $1
		GROUP BY 1 ORDER BY 1
	`, p.ID)
	if err != nil {
		return err
	}
	defer rows.Close()
	p.VotesByDay = nil
	for rows.Next() {
		var d domain.POTWDayCount
		if err := rows.Scan(&d.Day, &d.Votes); err != nil {
			return err
		}
		p.VotesByDay = append(p.VotesByDay, d)
	}
	return rows.Err()
}

func loadNominees(ctx context.Context, q potwQuerier, pollID string) ([]domain.POTWNominee, error) {
	// LATERAL ... LIMIT 1: a player could in theory hold two slots in one lineup;
	// one row per nominee keeps the vote counts from being doubled.
	rows, err := q.Query(ctx, `
		SELECT n.player_id::text, n.display_order, COALESCE(v.cnt, 0),
		       p.name, COALESCE(p.image, ''), COALESCE(p.jersey_number, 0), COALESCE(p.position, ''),
		       COALESCE(t.name, ''), COALESCE(t.logo, ''),
		       COALESCE(tp.position, ''), COALESCE(tp.rating, 0)::float8,
		       COALESCE(tp.stat1_value, ''), COALESCE(tp.stat1_label, ''),
		       COALESCE(tp.stat2_value, ''), COALESCE(tp.stat2_label, ''),
		       COALESCE(tp.stat3_value, ''), COALESCE(tp.stat3_label, '')
		FROM potw_poll_nominees n
		JOIN potw_polls pp ON pp.id = n.poll_id
		JOIN players p ON p.id = n.player_id
		LEFT JOIN teams t ON t.id = p.team_id
		LEFT JOIN LATERAL (
			SELECT position, rating, stat1_value, stat1_label, stat2_value, stat2_label, stat3_value, stat3_label
			FROM team_of_the_week_players
			WHERE totw_id = pp.totw_id AND player_id = n.player_id
			ORDER BY display_order
			LIMIT 1
		) tp ON true
		LEFT JOIN (
			SELECT player_id, COUNT(*) AS cnt FROM potw_votes WHERE poll_id = $1 GROUP BY player_id
		) v ON v.player_id = n.player_id
		WHERE n.poll_id = $1
		ORDER BY n.display_order, p.name
	`, pollID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.POTWNominee
	for rows.Next() {
		var n domain.POTWNominee
		if err := rows.Scan(
			&n.PlayerID, &n.DisplayOrder, &n.Votes,
			&n.Name, &n.Image, &n.JerseyNumber, &n.Position,
			&n.TeamName, &n.TeamLogo,
			&n.TOTWPosition, &n.Rating,
			&n.Stat1Value, &n.Stat1Label, &n.Stat2Value, &n.Stat2Label, &n.Stat3Value, &n.Stat3Label,
		); err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, rows.Err()
}

func (r *PostgresPOTWRepository) getPoll(ctx context.Context, where string, arg any) (*domain.POTWPoll, error) {
	p, err := scanPOTWPoll(r.db.QueryRow(ctx, potwPollSelect+where, arg))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if err := loadPollDetail(ctx, r.db, p); err != nil {
		return nil, err
	}
	return p, nil
}

// GetPollByID returns nil, nil when there is no such poll.
func (r *PostgresPOTWRepository) GetPollByID(ctx context.Context, pollID string) (*domain.POTWPoll, error) {
	return r.getPoll(ctx, ` WHERE pp.id = $1`, pollID)
}

// GetPollByTOTWID returns nil, nil when the edition has no poll.
func (r *PostgresPOTWRepository) GetPollByTOTWID(ctx context.Context, totwID string) (*domain.POTWPoll, error) {
	return r.getPoll(ctx, ` WHERE pp.totw_id = $1`, totwID)
}

// GetLatestPublicPoll is the newest poll on a published edition that has already
// opened, or nil, nil when there is none. A scheduled poll stays out of sight
// until it opens.
func (r *PostgresPOTWRepository) GetLatestPublicPoll(ctx context.Context) (*domain.POTWPoll, error) {
	p, err := scanPOTWPoll(r.db.QueryRow(ctx, potwPollSelect+`
		WHERE tw.is_published = true AND pp.opens_at <= NOW()
		ORDER BY pp.opens_at DESC, pp.created_at DESC
		LIMIT 1
	`))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if err := loadPollDetail(ctx, r.db, p); err != nil {
		return nil, err
	}
	return p, nil
}

// ListPublicPolls lists every opened poll on a published edition, newest first,
// with vote totals (nominees are not loaded).
func (r *PostgresPOTWRepository) ListPublicPolls(ctx context.Context) ([]domain.POTWPoll, error) {
	rows, err := r.db.Query(ctx, `
		SELECT pp.id, pp.totw_id, pp.opens_at, pp.closes_at, pp.finalized_at,
		       pp.winner_player_id::text, pp.winner_source, pp.created_by::text,
		       pp.created_at, pp.updated_at,
		       tw.is_published, tw.week_title, tw.headline, tw.competition_id::text,
		       COALESCE(c.name, ''), tw.player_of_the_week_id::text,
		       (SELECT COUNT(*) FROM potw_votes v WHERE v.poll_id = pp.id),
		       COALESCE(wp.name, '')
		FROM potw_polls pp
		JOIN team_of_the_week tw ON tw.id = pp.totw_id
		LEFT JOIN competitions c ON c.id = tw.competition_id
		LEFT JOIN players wp ON wp.id = pp.winner_player_id
		WHERE tw.is_published = true AND pp.opens_at <= NOW()
		ORDER BY pp.opens_at DESC, pp.created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.POTWPoll
	for rows.Next() {
		var p domain.POTWPoll
		var winnerName string
		if err := rows.Scan(
			&p.ID, &p.TOTWID, &p.OpensAt, &p.ClosesAt, &p.FinalizedAt,
			&p.WinnerPlayerID, &p.WinnerSource, &p.CreatedBy,
			&p.CreatedAt, &p.UpdatedAt,
			&p.TOTWPublished, &p.WeekTitle, &p.Headline, &p.CompetitionID,
			&p.CompetitionName, &p.TOTWPOTWID,
			&p.TotalVotes, &winnerName,
		); err != nil {
			return nil, err
		}
		if p.WinnerPlayerID != nil {
			p.Nominees = []domain.POTWNominee{{PlayerID: *p.WinnerPlayerID, Name: winnerName}}
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *PostgresPOTWRepository) HasPoll(ctx context.Context, totwID string) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM potw_polls WHERE totw_id = $1)`, totwID).Scan(&exists)
	return exists, err
}

func insertNominees(ctx context.Context, tx pgx.Tx, pollID string, nomineeIDs []string) error {
	for i, pid := range nomineeIDs {
		if _, err := tx.Exec(ctx, `
			INSERT INTO potw_poll_nominees (poll_id, player_id, display_order) VALUES ($1, $2, $3)
		`, pollID, pid, i); err != nil {
			return fmt.Errorf("add nominee %s: %w", pid, err)
		}
	}
	return nil
}

func (r *PostgresPOTWRepository) CreatePoll(ctx context.Context, poll *domain.POTWPoll, nomineeIDs []string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := tx.QueryRow(ctx, `
		INSERT INTO potw_polls (totw_id, opens_at, closes_at, created_by)
		VALUES ($1, $2, $3, NULLIF($4::text, '')::uuid)
		RETURNING id, created_at, updated_at
	`, poll.TOTWID, poll.OpensAt, poll.ClosesAt, derefString(poll.CreatedBy)).Scan(&poll.ID, &poll.CreatedAt, &poll.UpdatedAt); err != nil {
		return err
	}
	if err := insertNominees(ctx, tx, poll.ID, nomineeIDs); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// UpdatePoll changes the poll's window and, when nomineeIDs is non-nil, replaces
// the ballot. The service only passes nominees while nobody has voted yet.
func (r *PostgresPOTWRepository) UpdatePoll(ctx context.Context, poll *domain.POTWPoll, nomineeIDs []string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `
		UPDATE potw_polls SET opens_at = $2, closes_at = $3, updated_at = NOW() WHERE id = $1
	`, poll.ID, poll.OpensAt, poll.ClosesAt); err != nil {
		return err
	}
	if nomineeIDs != nil {
		if _, err := tx.Exec(ctx, `DELETE FROM potw_poll_nominees WHERE poll_id = $1`, poll.ID); err != nil {
			return err
		}
		if err := insertNominees(ctx, tx, poll.ID, nomineeIDs); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (r *PostgresPOTWRepository) DeletePoll(ctx context.Context, totwID string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM potw_polls WHERE totw_id = $1`, totwID)
	return err
}

// CastVote records the user's vote, or moves it to another nominee if they have
// already voted. The service checks the poll is open first; the foreign key on
// (poll_id, player_id) is what guarantees the player is on the ballot.
func (r *PostgresPOTWRepository) CastVote(ctx context.Context, pollID, userID, playerID string) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO potw_votes (poll_id, user_id, player_id) VALUES ($1, $2, $3)
		ON CONFLICT (poll_id, user_id) DO UPDATE SET player_id = EXCLUDED.player_id, updated_at = NOW()
	`, pollID, userID, playerID)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23503" { // foreign_key_violation
		return ErrPOTWNotNominee
	}
	return err
}

// GetUserVote returns the player the user voted for, or nil if they have not voted.
func (r *PostgresPOTWRepository) GetUserVote(ctx context.Context, pollID, userID string) (*string, error) {
	var playerID string
	err := r.db.QueryRow(ctx, `SELECT player_id::text FROM potw_votes WHERE poll_id = $1 AND user_id = $2`, pollID, userID).Scan(&playerID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &playerID, nil
}

// ListDuePollIDs returns polls whose deadline has passed but whose result has not
// been applied yet.
func (r *PostgresPOTWRepository) ListDuePollIDs(ctx context.Context) ([]string, error) {
	rows, err := r.db.Query(ctx, `SELECT id::text FROM potw_polls WHERE finalized_at IS NULL AND closes_at <= NOW()`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// applyPOTWToTOTW writes the winner onto the edition: its player_of_the_week_id and
// the per-player flag the pitch highlights. A nil playerID clears both.
func applyPOTWToTOTW(ctx context.Context, q potwQuerier, totwID string, playerID *string) error {
	if _, err := q.Exec(ctx, `
		UPDATE team_of_the_week SET player_of_the_week_id = $2::uuid, updated_at = NOW() WHERE id = $1
	`, totwID, playerID); err != nil {
		return fmt.Errorf("set edition player of the week: %w", err)
	}
	if _, err := q.Exec(ctx, `
		UPDATE team_of_the_week_players
		SET is_player_of_the_week = COALESCE(player_id = $2::uuid, false)
		WHERE totw_id = $1
	`, totwID, playerID); err != nil {
		return fmt.Errorf("flag edition player of the week: %w", err)
	}
	return nil
}

// FinalizePoll tallies a poll whose deadline has passed and applies the winner to
// its edition, in one transaction holding the poll row. It is safe to call from
// the scheduled job and from a page load at the same time: whoever gets the lock
// first finalizes, the other sees finalized_at set and does nothing.
//
// applied is true when this call changed the edition's Player of the Week, so the
// caller knows to resync badges.
func (r *PostgresPOTWRepository) FinalizePoll(ctx context.Context, pollID string, now time.Time) (string, bool, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return "", false, err
	}
	defer tx.Rollback(ctx)

	var totwID string
	var closesAt time.Time
	var finalizedAt *time.Time
	var source *string
	err = tx.QueryRow(ctx, `
		SELECT totw_id::text, closes_at, finalized_at, winner_source
		FROM potw_polls WHERE id = $1 FOR UPDATE
	`, pollID).Scan(&totwID, &closesAt, &finalizedAt, &source)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	if finalizedAt != nil || now.Before(closesAt) {
		return totwID, false, nil
	}

	// An admin override already set the edition's Player of the Week; closing the
	// vote only stamps the poll so the job stops picking it up.
	if source != nil && *source == domain.POTWWinnerByAdmin {
		if _, err := tx.Exec(ctx, `UPDATE potw_polls SET finalized_at = NOW(), updated_at = NOW() WHERE id = $1`, pollID); err != nil {
			return "", false, err
		}
		return totwID, false, tx.Commit(ctx)
	}

	nominees, err := loadNominees(ctx, tx, pollID)
	if err != nil {
		return "", false, err
	}
	winner := domain.PickPOTWWinner(nominees)
	if winner == "" {
		// Nobody voted: close the poll without touching the edition, so an admin
		// pick (if any) stands and the admin can still choose one.
		if _, err := tx.Exec(ctx, `UPDATE potw_polls SET finalized_at = NOW(), updated_at = NOW() WHERE id = $1`, pollID); err != nil {
			return "", false, err
		}
		return totwID, false, tx.Commit(ctx)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE potw_polls
		SET finalized_at = NOW(), winner_player_id = $2, winner_source = $3, updated_at = NOW()
		WHERE id = $1
	`, pollID, winner, domain.POTWWinnerByVote); err != nil {
		return "", false, err
	}
	if err := applyPOTWToTOTW(ctx, tx, totwID, &winner); err != nil {
		return "", false, err
	}
	return totwID, true, tx.Commit(ctx)
}

// SetWinner records a winner decided outside the tally (an admin override, or
// clearing one) and applies it to the edition. finalized controls whether the
// poll is marked done; clearing an override reopens it to the tally.
func (r *PostgresPOTWRepository) SetWinner(ctx context.Context, pollID string, playerID *string, source *string, finalized bool) (string, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)

	var totwID string
	if err := tx.QueryRow(ctx, `
		UPDATE potw_polls
		SET winner_player_id = $2::uuid, winner_source = $3,
		    finalized_at = CASE WHEN $4 THEN COALESCE(finalized_at, NOW()) ELSE NULL END,
		    updated_at = NOW()
		WHERE id = $1
		RETURNING totw_id::text
	`, pollID, playerID, source, finalized).Scan(&totwID); err != nil {
		return "", err
	}
	if err := applyPOTWToTOTW(ctx, tx, totwID, playerID); err != nil {
		return "", err
	}
	return totwID, tx.Commit(ctx)
}

// ResetResultNotification lets a reopened poll announce its new winner.
func (r *PostgresPOTWRepository) ResetResultNotification(ctx context.Context, pollID string) error {
	_, err := r.db.Exec(ctx, `UPDATE potw_polls SET result_notified_at = NULL WHERE id = $1`, pollID)
	return err
}

// ClaimOpenAnnouncements marks every poll that is open on a published edition and
// hasn't been announced yet, and returns them. Marking first means two runs can
// never announce the same poll twice.
func (r *PostgresPOTWRepository) ClaimOpenAnnouncements(ctx context.Context) ([]POTWAnnouncement, error) {
	rows, err := r.db.Query(ctx, `
		UPDATE potw_polls pp
		SET open_notified_at = NOW()
		FROM team_of_the_week tw
		WHERE tw.id = pp.totw_id
		  AND tw.is_published = true
		  AND pp.open_notified_at IS NULL
		  AND pp.opens_at <= NOW() AND pp.closes_at > NOW()
		RETURNING pp.id::text, tw.week_title, pp.closes_at,
		          (SELECT COUNT(*) FROM potw_poll_nominees n WHERE n.poll_id = pp.id)
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []POTWAnnouncement
	for rows.Next() {
		var a POTWAnnouncement
		if err := rows.Scan(&a.PollID, &a.WeekTitle, &a.ClosesAt, &a.Nominees); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// ClaimResultAnnouncements marks every closed poll on a published edition that has
// a winner but hasn't been announced, and returns them. A later override does not
// re-announce; a reopened poll does (see ResetResultNotification).
func (r *PostgresPOTWRepository) ClaimResultAnnouncements(ctx context.Context) ([]POTWAnnouncement, error) {
	rows, err := r.db.Query(ctx, `
		UPDATE potw_polls pp
		SET result_notified_at = NOW()
		FROM team_of_the_week tw, players p
		WHERE tw.id = pp.totw_id
		  AND p.id = pp.winner_player_id
		  AND tw.is_published = true
		  AND pp.result_notified_at IS NULL
		  AND pp.finalized_at IS NOT NULL
		  AND pp.closes_at <= NOW()
		RETURNING pp.id::text, tw.week_title, pp.closes_at, p.name, COALESCE(pp.winner_source, '')
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []POTWAnnouncement
	for rows.Next() {
		var a POTWAnnouncement
		if err := rows.Scan(&a.PollID, &a.WeekTitle, &a.ClosesAt, &a.WinnerName, &a.WinnerSource); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}
