package store

import (
	"context"
	"strconv"
	"strings"

	"showtime-backend/internal/arena/domain"

	"github.com/jackc/pgx/v5"
)

func itoa(n int) string { return strconv.Itoa(n) }

// playerSelect lists a player with their current club (the open registration).
const playerSelect = `
	SELECT p.id, p.user_id::text, p.gamertag, p.ea_id, p.platform, p.primary_position, p.avatar_url,
	       r.club_id::text, COALESCE(c.name, ''), COALESCE(c.short, ''), COALESCE(c.color, ''),
	       r.shirt_number, COALESCE(r.squad_role, ''), p.created_at
	FROM arena_players p
	LEFT JOIN arena_registrations r ON r.player_id = p.id AND r.ended_at IS NULL
	LEFT JOIN arena_clubs c ON c.id = r.club_id`

func scanPlayer(row pgx.Row) (*domain.Player, error) {
	var p domain.Player
	var shirt *int16
	if err := row.Scan(&p.ID, &p.UserID, &p.Gamertag, &p.EAID, &p.Platform, &p.PrimaryPosition, &p.AvatarURL,
		&p.ClubID, &p.ClubName, &p.ClubShort, &p.ClubColor, &shirt, &p.SquadRole, &p.CreatedAt); err != nil {
		return nil, notFound(err)
	}
	if shirt != nil {
		n := int(*shirt)
		p.ShirtNumber = &n
	}
	return &p, nil
}

type PlayerFilter struct {
	ClubID     string
	Query      string
	FreeAgents bool
	Limit      int
	Offset     int
}

func (s *Store) ListPlayers(ctx context.Context, f PlayerFilter) ([]domain.Player, error) {
	var where []string
	var args []any
	if f.ClubID != "" {
		args = append(args, f.ClubID)
		where = append(where, "r.club_id = $"+itoa(len(args)))
	}
	if f.FreeAgents {
		where = append(where, "r.club_id IS NULL")
	}
	if q := strings.TrimSpace(f.Query); q != "" {
		args = append(args, "%"+strings.ToLower(q)+"%")
		where = append(where, "(LOWER(p.gamertag) LIKE $"+itoa(len(args))+" OR LOWER(p.ea_id) LIKE $"+itoa(len(args))+")")
	}
	sql := playerSelect
	if len(where) > 0 {
		sql += " WHERE " + strings.Join(where, " AND ")
	}
	sql += " ORDER BY r.shirt_number NULLS LAST, LOWER(p.gamertag)"
	if f.Limit > 0 {
		args = append(args, f.Limit, f.Offset)
		sql += " LIMIT $" + itoa(len(args)-1) + " OFFSET $" + itoa(len(args))
	}
	rows, err := s.db.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Player{}
	for rows.Next() {
		p, err := scanPlayer(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *p)
	}
	return out, rows.Err()
}

func (s *Store) GetPlayer(ctx context.Context, id string) (*domain.Player, error) {
	return scanPlayer(s.db.QueryRow(ctx, playerSelect+` WHERE p.id = $1`, id))
}

func (s *Store) GetPlayerByUser(ctx context.Context, userID string) (*domain.Player, error) {
	return scanPlayer(s.db.QueryRow(ctx, playerSelect+` WHERE p.user_id = $1`, userID))
}

// LockPlayer serialises everything that changes one player's club.
func (s *Store) LockPlayer(ctx context.Context, id string) error {
	var x string
	return notFound(s.db.QueryRow(ctx, `SELECT id::text FROM arena_players WHERE id = $1 FOR UPDATE`, id).Scan(&x))
}

type PlayerInput struct {
	UserID          *string
	Gamertag        string
	EAID            string
	Platform        string
	PrimaryPosition string
	AvatarURL       string
}

func (s *Store) CreatePlayer(ctx context.Context, in PlayerInput) (string, error) {
	var id string
	err := s.db.QueryRow(ctx, `
		INSERT INTO arena_players (user_id, gamertag, ea_id, platform, primary_position, avatar_url)
		VALUES ($1, $2, $3, $4, $5, $6) RETURNING id::text`,
		in.UserID, in.Gamertag, in.EAID, in.Platform, in.PrimaryPosition, in.AvatarURL).Scan(&id)
	return id, err
}

// UpdatePlayer changes a player's details; it never touches the account link.
func (s *Store) UpdatePlayer(ctx context.Context, id string, in PlayerInput) error {
	tag, err := s.db.Exec(ctx, `
		UPDATE arena_players SET gamertag = $2, ea_id = $3, platform = $4, primary_position = $5, avatar_url = $6, updated_at = NOW()
		WHERE id = $1`, id, in.Gamertag, in.EAID, in.Platform, in.PrimaryPosition, in.AvatarURL)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) SetPlayerUser(ctx context.Context, id string, userID *string) error {
	tag, err := s.db.Exec(ctx, `UPDATE arena_players SET user_id = $2, updated_at = NOW() WHERE id = $1`, id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) PlayerHasHistory(ctx context.Context, id string) (bool, error) {
	var b bool
	err := s.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM arena_match_player_stats WHERE player_id = $1)
		OR EXISTS (SELECT 1 FROM arena_contracts WHERE player_id = $1 AND status = 'signed')`, id).Scan(&b)
	return b, err
}

func (s *Store) DeletePlayer(ctx context.Context, id string) error {
	tag, err := s.db.Exec(ctx, `DELETE FROM arena_players WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ---- registrations ---------------------------------------------------------

// TakenShirts are the numbers in use at a club by its current squad.
func (s *Store) TakenShirts(ctx context.Context, clubID string) (map[int]bool, error) {
	rows, err := s.db.Query(ctx, `SELECT shirt_number FROM arena_registrations WHERE club_id = $1 AND ended_at IS NULL`, clubID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[int]bool{}
	for rows.Next() {
		var n int16
		if err := rows.Scan(&n); err != nil {
			return nil, err
		}
		out[int(n)] = true
	}
	return out, rows.Err()
}

// OpenRegistration is the player's current club membership, if any.
func (s *Store) OpenRegistration(ctx context.Context, playerID string) (*domain.Registration, error) {
	var r domain.Registration
	var shirt int16
	err := s.db.QueryRow(ctx, `
		SELECT id, player_id, club_id, season_id, shirt_number, squad_role, contract_id::text, started_at, ended_at
		FROM arena_registrations WHERE player_id = $1 AND ended_at IS NULL`, playerID).
		Scan(&r.ID, &r.PlayerID, &r.ClubID, &r.SeasonID, &shirt, &r.SquadRole, &r.ContractID, &r.StartedAt, &r.EndedAt)
	if err != nil {
		return nil, notFound(err)
	}
	r.ShirtNumber = int(shirt)
	return &r, nil
}

// EndRegistration closes the player's current membership.
func (s *Store) EndRegistration(ctx context.Context, playerID string) error {
	_, err := s.db.Exec(ctx, `UPDATE arena_registrations SET ended_at = NOW() WHERE player_id = $1 AND ended_at IS NULL`, playerID)
	return err
}

func (s *Store) CreateRegistration(ctx context.Context, playerID, clubID, seasonID string, shirt int, role string, contractID *string) error {
	_, err := s.db.Exec(ctx, `
		INSERT INTO arena_registrations (player_id, club_id, season_id, shirt_number, squad_role, contract_id)
		VALUES ($1, $2, $3, $4, $5, $6)`, playerID, clubID, seasonID, shirt, role, contractID)
	return err
}

// Roster is a club's current squad, by shirt number.
func (s *Store) Roster(ctx context.Context, clubID string) ([]domain.Player, error) {
	return s.ListPlayers(ctx, PlayerFilter{ClubID: clubID})
}

// RosterMap is the club's squad keyed by player id, in the shape the team sheet
// rules need.
func (s *Store) RosterMap(ctx context.Context, clubID string) (map[string]domain.RosterPlayer, []string, error) {
	players, err := s.Roster(ctx, clubID)
	if err != nil {
		return nil, nil, err
	}
	m := make(map[string]domain.RosterPlayer, len(players))
	order := make([]string, 0, len(players))
	for _, p := range players {
		m[p.ID] = domain.RosterPlayer{Position: p.PrimaryPosition}
		order = append(order, p.ID)
	}
	return m, order, nil
}

// PlayerLite is the little the public pages need about a player named in a sheet.
type PlayerLite struct {
	ID          string
	Gamertag    string
	Position    string
	ShirtNumber *int
}

// PlayersByIDs looks several players up at once, with their shirt number at the
// given club if they still wear one there.
func (s *Store) PlayersByIDs(ctx context.Context, ids []string, clubID string) (map[string]PlayerLite, error) {
	out := map[string]PlayerLite{}
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := s.db.Query(ctx, `
		SELECT p.id::text, p.gamertag, p.primary_position, r.shirt_number
		FROM arena_players p
		LEFT JOIN arena_registrations r ON r.player_id = p.id AND r.club_id::text = $2 AND r.ended_at IS NULL
		WHERE p.id::text = ANY($1)`, ids, clubID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var p PlayerLite
		var shirt *int16
		if err := rows.Scan(&p.ID, &p.Gamertag, &p.Position, &shirt); err != nil {
			return nil, err
		}
		if shirt != nil {
			n := int(*shirt)
			p.ShirtNumber = &n
		}
		out[p.ID] = p
	}
	return out, rows.Err()
}

// PlayerMatchLine is one match's numbers for a player, with the fixture.
type PlayerMatchLine struct {
	MatchID      string   `json:"match_id"`
	KickoffAt    *string  `json:"kickoff_at"`
	ClubID       string   `json:"club_id"`
	Opponent     string   `json:"opponent"`
	HomeAway     string   `json:"home_away"`
	GoalsFor     int      `json:"goals_for"`
	GoalsAgainst int      `json:"goals_against"`
	Goals        int      `json:"goals"`
	Assists      int      `json:"assists"`
	Rating       *float64 `json:"rating"`
	MOTM         bool     `json:"motm"`
}

// PlayerMatchLines is a player's most recent appearances, newest first.
func (s *Store) PlayerMatchLines(ctx context.Context, playerID string, limit int) ([]PlayerMatchLine, error) {
	rows, err := s.db.Query(ctx, `
		SELECT m.id::text, to_char(m.kickoff_at AT TIME ZONE 'Africa/Lagos', 'YYYY-MM-DD"T"HH24:MI'), st.club_id::text,
		       CASE WHEN st.club_id = m.home_club_id THEN a.name ELSE h.name END,
		       CASE WHEN st.club_id = m.home_club_id THEN 'home' ELSE 'away' END,
		       CASE WHEN st.club_id = m.home_club_id THEN m.home_score ELSE m.away_score END,
		       CASE WHEN st.club_id = m.home_club_id THEN m.away_score ELSE m.home_score END,
		       st.goals, st.assists, st.rating::float8, st.motm
		FROM arena_match_player_stats st
		JOIN arena_matches m ON m.id = st.match_id
		JOIN arena_clubs h ON h.id = m.home_club_id
		JOIN arena_clubs a ON a.id = m.away_club_id
		WHERE st.player_id = $1 AND m.status IN ('completed', 'forfeit')
		ORDER BY m.kickoff_at DESC NULLS LAST LIMIT $2`, playerID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []PlayerMatchLine{}
	for rows.Next() {
		var l PlayerMatchLine
		if err := rows.Scan(&l.MatchID, &l.KickoffAt, &l.ClubID, &l.Opponent, &l.HomeAway, &l.GoalsFor, &l.GoalsAgainst,
			&l.Goals, &l.Assists, &l.Rating, &l.MOTM); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}
