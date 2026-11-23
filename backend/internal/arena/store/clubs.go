package store

import (
	"context"
	"strings"

	"showtime-backend/internal/arena/domain"

	"github.com/jackc/pgx/v5"
)

// clubSelect lists a club with its manager, its division in the given season and
// the size of its current squad. $1 is the season id (may be NULL).
const clubSelect = `
	SELECT c.id, c.slug, c.name, c.short, c.color, c.crest_url, c.founded_year, c.manager_user_id::text,
	       COALESCE(u.full_name, ''), COALESCE(u.email, ''), c.status,
	       dc.division_id::text, COALESCE(d.name, ''),
	       (SELECT COUNT(*) FROM arena_registrations r WHERE r.club_id = c.id AND r.ended_at IS NULL),
	       EXISTS (SELECT 1 FROM arena_matches m WHERE (m.home_club_id = c.id OR m.away_club_id = c.id) AND m.status IN ('completed', 'forfeit')
	               AND ($1::uuid IS NULL OR m.season_id = $1::uuid)),
	       c.created_at
	FROM arena_clubs c
	LEFT JOIN users u ON u.id = c.manager_user_id
	LEFT JOIN arena_division_clubs dc ON dc.club_id = c.id AND dc.season_id = $1::uuid
	LEFT JOIN arena_divisions d ON d.id = dc.division_id`

func scanClub(row pgx.Row) (*domain.Club, error) {
	var c domain.Club
	if err := row.Scan(&c.ID, &c.Slug, &c.Name, &c.Short, &c.Color, &c.CrestURL, &c.FoundedYear, &c.ManagerUserID,
		&c.ManagerName, &c.ManagerEmail, &c.Status, &c.DivisionID, &c.DivisionName, &c.SquadSize, &c.HasPlayed, &c.CreatedAt); err != nil {
		return nil, notFound(err)
	}
	return &c, nil
}

type ClubFilter struct {
	SeasonID        *string
	DivisionID      string
	Query           string
	IncludeArchived bool
	// UnassignedOnly lists clubs with no division this season.
	UnassignedOnly bool
}

func (s *Store) ListClubs(ctx context.Context, f ClubFilter) ([]domain.Club, error) {
	var where []string
	args := []any{f.SeasonID}
	if !f.IncludeArchived {
		where = append(where, "c.status = 'active'")
	}
	if f.DivisionID != "" {
		args = append(args, f.DivisionID)
		where = append(where, "dc.division_id = $"+itoa(len(args)))
	}
	if f.UnassignedOnly {
		where = append(where, "dc.division_id IS NULL")
	}
	if q := strings.TrimSpace(f.Query); q != "" {
		args = append(args, "%"+strings.ToLower(q)+"%")
		where = append(where, "(LOWER(c.name) LIKE $"+itoa(len(args))+" OR LOWER(c.short) LIKE $"+itoa(len(args))+")")
	}
	sql := clubSelect
	if len(where) > 0 {
		sql += " WHERE " + strings.Join(where, " AND ")
	}
	sql += " ORDER BY c.name"
	rows, err := s.db.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Club{}
	for rows.Next() {
		c, err := scanClub(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *c)
	}
	return out, rows.Err()
}

func (s *Store) GetClub(ctx context.Context, id string, seasonID *string) (*domain.Club, error) {
	return scanClub(s.db.QueryRow(ctx, clubSelect+` WHERE c.id = $2`, seasonID, id))
}

func (s *Store) GetClubBySlug(ctx context.Context, slug string, seasonID *string) (*domain.Club, error) {
	return scanClub(s.db.QueryRow(ctx, clubSelect+` WHERE c.slug = $2`, seasonID, slug))
}

// GetClubByManager is the club a user manages.
func (s *Store) GetClubByManager(ctx context.Context, userID string, seasonID *string) (*domain.Club, error) {
	return scanClub(s.db.QueryRow(ctx, clubSelect+` WHERE c.manager_user_id = $2 AND c.status = 'active'`, seasonID, userID))
}

type ClubInput struct {
	Name        string
	Short       string
	Color       string
	CrestURL    string
	FoundedYear *int
}

// CreateClub adds a club. The slug is made unique by suffixing a number.
func (s *Store) CreateClub(ctx context.Context, in ClubInput, baseSlug string) (string, error) {
	slug := baseSlug
	for i := 2; ; i++ {
		var exists bool
		if err := s.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM arena_clubs WHERE slug = $1)`, slug).Scan(&exists); err != nil {
			return "", err
		}
		if !exists {
			break
		}
		slug = baseSlug + "-" + itoa(i)
	}
	var id string
	err := s.db.QueryRow(ctx, `
		INSERT INTO arena_clubs (slug, name, short, color, crest_url, founded_year) VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id`, slug, in.Name, in.Short, in.Color, in.CrestURL, in.FoundedYear).Scan(&id)
	return id, err
}

func (s *Store) UpdateClub(ctx context.Context, id string, in ClubInput) error {
	tag, err := s.db.Exec(ctx, `
		UPDATE arena_clubs SET name = $2, short = $3, color = $4, crest_url = $5, founded_year = $6, updated_at = NOW()
		WHERE id = $1`, id, in.Name, in.Short, in.Color, in.CrestURL, in.FoundedYear)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) SetClubStatus(ctx context.Context, id, status string) error {
	tag, err := s.db.Exec(ctx, `UPDATE arena_clubs SET status = $2, updated_at = NOW() WHERE id = $1`, id, status)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) SetClubManager(ctx context.Context, clubID string, userID *string) error {
	tag, err := s.db.Exec(ctx, `UPDATE arena_clubs SET manager_user_id = $2, updated_at = NOW() WHERE id = $1`, clubID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ClubHasAnyMatch reports whether a club appears in any match at all.
func (s *Store) ClubHasAnyMatch(ctx context.Context, clubID string) (bool, error) {
	var b bool
	err := s.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM arena_matches WHERE home_club_id = $1 OR away_club_id = $1)`, clubID).Scan(&b)
	return b, err
}

// LockClubForDelete locks the club row so a registration or fixture can't appear
// between the checks and the delete.
func (s *Store) LockClubForDelete(ctx context.Context, id string) error {
	var x string
	return notFound(s.db.QueryRow(ctx, `SELECT id::text FROM arena_clubs WHERE id = $1 FOR UPDATE`, id).Scan(&x))
}

func (s *Store) DeleteClub(ctx context.Context, id string) error {
	tag, err := s.db.Exec(ctx, `DELETE FROM arena_clubs WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// UserRef is a user found by email.
type UserRef struct {
	ID    string
	Name  string
	Email string
}

func (s *Store) FindUserByEmail(ctx context.Context, email string) (*UserRef, error) {
	var u UserRef
	err := s.db.QueryRow(ctx, `SELECT id::text, full_name, email FROM users WHERE LOWER(email) = LOWER($1)`, strings.TrimSpace(email)).
		Scan(&u.ID, &u.Name, &u.Email)
	if err != nil {
		return nil, notFound(err)
	}
	return &u, nil
}

func (s *Store) GetUser(ctx context.Context, id string) (*UserRef, error) {
	var u UserRef
	err := s.db.QueryRow(ctx, `SELECT id::text, full_name, email FROM users WHERE id = $1`, id).Scan(&u.ID, &u.Name, &u.Email)
	if err != nil {
		return nil, notFound(err)
	}
	return &u, nil
}

// ---- follows ---------------------------------------------------------------

func (s *Store) GetFollow(ctx context.Context, userID string) (string, error) {
	var id string
	err := s.db.QueryRow(ctx, `SELECT club_id::text FROM arena_follows WHERE user_id = $1`, userID).Scan(&id)
	if err != nil {
		return "", notFound(err)
	}
	return id, nil
}

func (s *Store) SetFollow(ctx context.Context, userID, clubID string) error {
	_, err := s.db.Exec(ctx, `
		INSERT INTO arena_follows (user_id, club_id) VALUES ($1, $2)
		ON CONFLICT (user_id) DO UPDATE SET club_id = EXCLUDED.club_id, created_at = NOW()`, userID, clubID)
	return err
}

func (s *Store) DeleteFollow(ctx context.Context, userID string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM arena_follows WHERE user_id = $1`, userID)
	return err
}
