package store

import (
	"context"
	"strings"
	"time"

	"showtime-backend/internal/arena/domain"

	"github.com/jackc/pgx/v5"
)

const matchSelect = `
	SELECT m.id, m.season_id, m.division_id, d.name, m.stage, m.matchweek,
	       m.home_club_id::text, m.away_club_id::text,
	       h.slug, h.name, h.short, h.color, h.crest_url,
	       a.slug, a.name, a.short, a.color, a.crest_url,
	       m.kickoff_at, m.status, m.home_score, m.away_score, m.penalty_winner, m.feeds_match_id::text, m.feeds_slot
	FROM arena_matches m
	JOIN arena_divisions d ON d.id = m.division_id
	LEFT JOIN arena_clubs h ON h.id = m.home_club_id
	LEFT JOIN arena_clubs a ON a.id = m.away_club_id`

func scanMatch(row pgx.Row) (*domain.Match, error) {
	var m domain.Match
	var hSlug, hName, hShort, hColor, hCrest, aSlug, aName, aShort, aColor, aCrest *string
	if err := row.Scan(&m.ID, &m.SeasonID, &m.DivisionID, &m.DivisionName, &m.Stage, &m.Matchweek,
		&m.HomeClubID, &m.AwayClubID, &hSlug, &hName, &hShort, &hColor, &hCrest, &aSlug, &aName, &aShort, &aColor, &aCrest,
		&m.KickoffAt, &m.Status, &m.HomeScore, &m.AwayScore, &m.PenaltyWinner, &m.FeedsMatchID, &m.FeedsSlot); err != nil {
		return nil, notFound(err)
	}
	if m.HomeClubID != nil && hName != nil {
		m.Home = &domain.ClubRef{ID: *m.HomeClubID, Slug: *hSlug, Name: *hName, Short: *hShort, Color: *hColor, CrestURL: *hCrest}
	}
	if m.AwayClubID != nil && aName != nil {
		m.Away = &domain.ClubRef{ID: *m.AwayClubID, Slug: *aSlug, Name: *aName, Short: *aShort, Color: *aColor, CrestURL: *aCrest}
	}
	return &m, nil
}

type MatchFilter struct {
	SeasonID   string
	DivisionID string
	ClubID     string
	Stage      string
	// State is "results" (played), "upcoming" (not yet played) or "" for all.
	State     string
	Matchweek int
	// Newest orders by kick-off descending; default is ascending.
	Newest bool
	Limit  int
}

func (s *Store) ListMatches(ctx context.Context, f MatchFilter) ([]domain.Match, error) {
	var where []string
	var args []any
	add := func(cond string, v any) {
		args = append(args, v)
		where = append(where, strings.ReplaceAll(cond, "?", "$"+itoa(len(args))))
	}
	if f.SeasonID != "" {
		add("m.season_id = ?", f.SeasonID)
	}
	if f.DivisionID != "" {
		add("m.division_id = ?", f.DivisionID)
	}
	if f.ClubID != "" {
		add("(m.home_club_id = ? OR m.away_club_id = ?)", f.ClubID)
	}
	if f.Stage != "" {
		add("m.stage = ?", f.Stage)
	}
	if f.Matchweek > 0 {
		add("m.matchweek = ?", f.Matchweek)
	}
	switch f.State {
	case "results":
		where = append(where, "m.status IN ('completed', 'forfeit')")
	case "upcoming":
		where = append(where, "m.status IN ('scheduled', 'postponed')")
	}
	sql := matchSelect
	if len(where) > 0 {
		sql += " WHERE " + strings.Join(where, " AND ")
	}
	dir := "ASC"
	if f.Newest {
		dir = "DESC"
	}
	sql += " ORDER BY m.kickoff_at " + dir + " NULLS LAST, m.matchweek " + dir + ", m.created_at"
	if f.Limit > 0 {
		sql += " LIMIT " + itoa(f.Limit)
	}
	rows, err := s.db.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Match{}
	for rows.Next() {
		m, err := scanMatch(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *m)
	}
	return out, rows.Err()
}

func (s *Store) GetMatch(ctx context.Context, id string) (*domain.Match, error) {
	return scanMatch(s.db.QueryRow(ctx, matchSelect+` WHERE m.id = $1`, id))
}

// LockMatch locks a match row so two admins can't record a result at once.
func (s *Store) LockMatch(ctx context.Context, id string) error {
	var x string
	return notFound(s.db.QueryRow(ctx, `SELECT id::text FROM arena_matches WHERE id = $1 FOR UPDATE`, id).Scan(&x))
}

// NewMatch is a match to insert.
type NewMatch struct {
	SeasonID     string
	DivisionID   string
	Stage        string
	Matchweek    int
	HomeClubID   *string
	AwayClubID   *string
	KickoffAt    *time.Time
	FeedsMatchID *string
	FeedsSlot    *string
}

func (s *Store) InsertMatch(ctx context.Context, m NewMatch) (string, error) {
	var id string
	err := s.db.QueryRow(ctx, `
		INSERT INTO arena_matches (season_id, division_id, stage, matchweek, home_club_id, away_club_id, kickoff_at, feeds_match_id, feeds_slot)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id::text`,
		m.SeasonID, m.DivisionID, m.Stage, m.Matchweek, m.HomeClubID, m.AwayClubID, m.KickoffAt, m.FeedsMatchID, m.FeedsSlot).Scan(&id)
	return id, err
}

// SetFeeds points a match at the one its winner moves into.
func (s *Store) SetFeeds(ctx context.Context, id, feedsMatchID, slot string) error {
	_, err := s.db.Exec(ctx, `UPDATE arena_matches SET feeds_match_id = $2, feeds_slot = $3 WHERE id = $1`, id, feedsMatchID, slot)
	return err
}

// DeleteMatches removes a division's matches of a stage ("" = all stages). The
// caller has already made sure none has a result.
func (s *Store) DeleteMatches(ctx context.Context, divisionID, stage string) error {
	if stage == "" {
		_, err := s.db.Exec(ctx, `DELETE FROM arena_matches WHERE division_id = $1`, divisionID)
		return err
	}
	_, err := s.db.Exec(ctx, `DELETE FROM arena_matches WHERE division_id = $1 AND stage = $2`, divisionID, stage)
	return err
}

// CountMatches counts a division's matches of a stage, and how many are played.
func (s *Store) CountMatches(ctx context.Context, divisionID, stage string) (total, played int, err error) {
	err = s.db.QueryRow(ctx, `
		SELECT COUNT(*), COUNT(*) FILTER (WHERE status IN ('completed', 'forfeit'))
		FROM arena_matches WHERE division_id = $1 AND stage = $2`, divisionID, stage).Scan(&total, &played)
	return
}

// SetSchedule moves a match's kick-off and/or marks it postponed or scheduled.
func (s *Store) SetSchedule(ctx context.Context, id string, kickoff *time.Time, status string) error {
	tag, err := s.db.Exec(ctx, `UPDATE arena_matches SET kickoff_at = $2, status = $3, updated_at = NOW() WHERE id = $1`, id, kickoff, status)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// SetResult records a match's score. status is completed or forfeit.
func (s *Store) SetResult(ctx context.Context, id, status string, home, away int, penaltyWinner *string) error {
	tag, err := s.db.Exec(ctx, `
		UPDATE arena_matches SET status = $2, home_score = $3, away_score = $4, penalty_winner = $5, updated_at = NOW()
		WHERE id = $1`, id, status, home, away, penaltyWinner)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ClearResult takes a result back off a match.
func (s *Store) ClearResult(ctx context.Context, id string) error {
	_, err := s.db.Exec(ctx, `
		UPDATE arena_matches SET status = 'scheduled', home_score = NULL, away_score = NULL, penalty_winner = NULL, updated_at = NOW()
		WHERE id = $1`, id)
	return err
}

// SetMatchClub puts a club into a match's home or away side.
func (s *Store) SetMatchClub(ctx context.Context, id, slot string, clubID *string) error {
	col := "home_club_id"
	if slot == "away" {
		col = "away_club_id"
	}
	_, err := s.db.Exec(ctx, `UPDATE arena_matches SET `+col+` = $2, updated_at = NOW() WHERE id = $1`, id, clubID)
	return err
}

// ---- stats -----------------------------------------------------------------

func (s *Store) ListMatchStats(ctx context.Context, matchID string) ([]domain.PlayerStat, error) {
	rows, err := s.db.Query(ctx, `
		SELECT st.match_id, st.player_id, st.club_id, p.gamertag, st.started, st.goals, st.assists, st.rating::float8, st.motm
		FROM arena_match_player_stats st JOIN arena_players p ON p.id = st.player_id
		WHERE st.match_id = $1 ORDER BY st.started DESC, LOWER(p.gamertag)`, matchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.PlayerStat{}
	for rows.Next() {
		var x domain.PlayerStat
		if err := rows.Scan(&x.MatchID, &x.PlayerID, &x.ClubID, &x.Gamertag, &x.Started, &x.Goals, &x.Assists, &x.Rating, &x.MOTM); err != nil {
			return nil, err
		}
		out = append(out, x)
	}
	return out, rows.Err()
}

// ReplaceMatchStats swaps in the match's full set of player lines.
func (s *Store) ReplaceMatchStats(ctx context.Context, matchID string, stats []domain.PlayerStat) error {
	if _, err := s.db.Exec(ctx, `DELETE FROM arena_match_player_stats WHERE match_id = $1`, matchID); err != nil {
		return err
	}
	for _, x := range stats {
		if _, err := s.db.Exec(ctx, `
			INSERT INTO arena_match_player_stats (match_id, player_id, club_id, started, goals, assists, rating, motm)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			matchID, x.PlayerID, x.ClubID, x.Started, x.Goals, x.Assists, x.Rating, x.MOTM); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) DeleteMatchStats(ctx context.Context, matchID string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM arena_match_player_stats WHERE match_id = $1`, matchID)
	return err
}

type PlayerStatsFilter struct {
	DivisionID string
	ClubID     string
	Query      string
}

// PlayerSeasonStats totals each player's appearances, goals, assists and rating
// in a division, per club played for, so a transferred player's earlier numbers
// stay with their old club. Everyone on a division club's current squad appears,
// with zeros if they haven't played.
func (s *Store) PlayerSeasonStats(ctx context.Context, f PlayerStatsFilter) ([]domain.PlayerSeasonStats, error) {
	args := []any{f.DivisionID}
	var filters []string
	if f.ClubID != "" {
		args = append(args, f.ClubID)
		filters = append(filters, "t.club_id = $"+itoa(len(args)))
	}
	if q := strings.TrimSpace(f.Query); q != "" {
		args = append(args, "%"+strings.ToLower(q)+"%")
		filters = append(filters, "(LOWER(p.gamertag) LIKE $"+itoa(len(args))+" OR LOWER(c.name) LIKE $"+itoa(len(args))+")")
	}
	where := ""
	if len(filters) > 0 {
		where = "WHERE " + strings.Join(filters, " AND ")
	}
	rows, err := s.db.Query(ctx, `
		WITH played AS (
			SELECT st.player_id, st.club_id, 1 AS apps, st.goals, st.assists, st.rating, st.motm
			FROM arena_match_player_stats st
			JOIN arena_matches m ON m.id = st.match_id
			WHERE m.division_id = $1 AND m.status IN ('completed', 'forfeit')
		), squad AS (
			SELECT r.player_id, r.club_id, 0 AS apps, 0 AS goals, 0 AS assists, NULL::numeric AS rating, FALSE AS motm
			FROM arena_registrations r
			JOIN arena_division_clubs dc ON dc.club_id = r.club_id AND dc.division_id = $1
			WHERE r.ended_at IS NULL
		), t AS (
			SELECT * FROM played UNION ALL SELECT * FROM squad
		)
		SELECT p.id, p.gamertag, p.primary_position, c.id, c.name, c.short, c.color, cur.shirt_number,
		       SUM(t.apps)::int, SUM(t.goals)::int, SUM(t.assists)::int,
		       ROUND(AVG(t.rating), 2)::float8, COUNT(*) FILTER (WHERE t.motm)::int
		FROM t
		JOIN arena_players p ON p.id = t.player_id
		JOIN arena_clubs c ON c.id = t.club_id
		LEFT JOIN arena_registrations cur ON cur.player_id = p.id AND cur.club_id = c.id AND cur.ended_at IS NULL
		`+where+`
		GROUP BY p.id, p.gamertag, p.primary_position, c.id, c.name, c.short, c.color, cur.shirt_number
		ORDER BY SUM(t.goals) DESC, SUM(t.assists) DESC, LOWER(p.gamertag)`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.PlayerSeasonStats{}
	for rows.Next() {
		var x domain.PlayerSeasonStats
		var shirt *int16
		if err := rows.Scan(&x.PlayerID, &x.Gamertag, &x.Position, &x.ClubID, &x.ClubName, &x.ClubShort, &x.ClubColor, &shirt,
			&x.Apps, &x.Goals, &x.Assists, &x.AvgRating, &x.MOTMs); err != nil {
			return nil, err
		}
		if shirt != nil {
			n := int(*shirt)
			x.ShirtNumber = &n
		}
		out = append(out, x)
	}
	return out, rows.Err()
}
