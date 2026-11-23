package store

import (
	"context"

	"showtime-backend/internal/arena/domain"

	"github.com/jackc/pgx/v5"
)

const seasonCols = `s.id, s.number, s.name, to_char(s.starts_on, 'YYYY-MM-DD'), to_char(s.ends_on, 'YYYY-MM-DD'),
	s.status, s.transfer_window_open, s.created_at, s.updated_at`

func scanSeason(row pgx.Row) (*domain.Season, error) {
	var s domain.Season
	if err := row.Scan(&s.ID, &s.Number, &s.Name, &s.StartsOn, &s.EndsOn, &s.Status, &s.TransferWindowOpen, &s.CreatedAt, &s.UpdatedAt); err != nil {
		return nil, notFound(err)
	}
	return &s, nil
}

// ListSeasons returns every season, newest first.
func (s *Store) ListSeasons(ctx context.Context) ([]domain.Season, error) {
	rows, err := s.db.Query(ctx, `SELECT `+seasonCols+` FROM arena_seasons s ORDER BY s.number DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Season{}
	for rows.Next() {
		var x domain.Season
		if err := rows.Scan(&x.ID, &x.Number, &x.Name, &x.StartsOn, &x.EndsOn, &x.Status, &x.TransferWindowOpen, &x.CreatedAt, &x.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, x)
	}
	return out, rows.Err()
}

func (s *Store) GetSeason(ctx context.Context, id string) (*domain.Season, error) {
	return scanSeason(s.db.QueryRow(ctx, `SELECT `+seasonCols+` FROM arena_seasons s WHERE s.id = $1`, id))
}

// GetSeasonForUpdate locks the season row for the length of the transaction.
func (s *Store) GetSeasonForUpdate(ctx context.Context, id string) (*domain.Season, error) {
	return scanSeason(s.db.QueryRow(ctx, `SELECT `+seasonCols+` FROM arena_seasons s WHERE s.id = $1 FOR UPDATE`, id))
}

// CurrentSeason is the live season (active or in playoffs), else the newest one.
func (s *Store) CurrentSeason(ctx context.Context) (*domain.Season, error) {
	return scanSeason(s.db.QueryRow(ctx, `SELECT `+seasonCols+` FROM arena_seasons s
		ORDER BY (s.status IN ('active', 'playoffs')) DESC, s.number DESC LIMIT 1`))
}

func (s *Store) CreateSeason(ctx context.Context, number int, name string, startsOn, endsOn *string) (*domain.Season, error) {
	return scanSeason(s.db.QueryRow(ctx, `
		INSERT INTO arena_seasons AS s (number, name, starts_on, ends_on) VALUES ($1, $2, $3::date, $4::date)
		RETURNING `+seasonCols, number, name, startsOn, endsOn))
}

func (s *Store) UpdateSeason(ctx context.Context, id, name string, startsOn, endsOn *string) (*domain.Season, error) {
	return scanSeason(s.db.QueryRow(ctx, `
		UPDATE arena_seasons s SET name = $2, starts_on = $3::date, ends_on = $4::date, updated_at = NOW()
		WHERE s.id = $1 RETURNING `+seasonCols, id, name, startsOn, endsOn))
}

func (s *Store) SetSeasonStatus(ctx context.Context, id, status string) error {
	tag, err := s.db.Exec(ctx, `UPDATE arena_seasons SET status = $2, updated_at = NOW() WHERE id = $1`, id, status)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) SetTransferWindow(ctx context.Context, id string, open bool) error {
	tag, err := s.db.Exec(ctx, `UPDATE arena_seasons SET transfer_window_open = $2, updated_at = NOW() WHERE id = $1`, id, open)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ---- divisions -------------------------------------------------------------

const divisionCols = `d.id, d.season_id, d.name, d.description, d.sort_order, d.playoff_spots, d.kickoff_day, d.kickoff_slots,
	COALESCE((SELECT array_agg(dc.club_id::text ORDER BY dc.club_id) FROM arena_division_clubs dc WHERE dc.division_id = d.id), '{}'),
	EXISTS (SELECT 1 FROM arena_matches m WHERE m.division_id = d.id AND m.status IN ('completed', 'forfeit'))`

func scanDivision(row pgx.Row) (*domain.Division, error) {
	var d domain.Division
	if err := row.Scan(&d.ID, &d.SeasonID, &d.Name, &d.Description, &d.SortOrder, &d.PlayoffSpots, &d.KickoffDay, &d.KickoffSlots, &d.ClubIDs, &d.Locked); err != nil {
		return nil, notFound(err)
	}
	d.ClubCount = len(d.ClubIDs)
	return &d, nil
}

func (s *Store) ListDivisions(ctx context.Context, seasonID string) ([]domain.Division, error) {
	rows, err := s.db.Query(ctx, `SELECT `+divisionCols+` FROM arena_divisions d WHERE d.season_id = $1 ORDER BY d.sort_order, d.name`, seasonID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Division{}
	for rows.Next() {
		var d domain.Division
		if err := rows.Scan(&d.ID, &d.SeasonID, &d.Name, &d.Description, &d.SortOrder, &d.PlayoffSpots, &d.KickoffDay, &d.KickoffSlots, &d.ClubIDs, &d.Locked); err != nil {
			return nil, err
		}
		d.ClubCount = len(d.ClubIDs)
		out = append(out, d)
	}
	return out, rows.Err()
}

func (s *Store) GetDivision(ctx context.Context, id string) (*domain.Division, error) {
	return scanDivision(s.db.QueryRow(ctx, `SELECT `+divisionCols+` FROM arena_divisions d WHERE d.id = $1`, id))
}

func (s *Store) GetDivisionForUpdate(ctx context.Context, id string) error {
	var x string
	return notFound(s.db.QueryRow(ctx, `SELECT id FROM arena_divisions WHERE id = $1 FOR UPDATE`, id).Scan(&x))
}

type DivisionInput struct {
	Name         string
	Description  string
	PlayoffSpots int
	KickoffDay   int
	KickoffSlots []string
}

func (s *Store) CreateDivision(ctx context.Context, seasonID string, in DivisionInput) (*domain.Division, error) {
	var id string
	err := s.db.QueryRow(ctx, `
		INSERT INTO arena_divisions (season_id, name, description, playoff_spots, kickoff_day, kickoff_slots, sort_order)
		VALUES ($1, $2, $3, $4, $5, $6, COALESCE((SELECT MAX(sort_order) + 1 FROM arena_divisions WHERE season_id = $1), 0))
		RETURNING id`, seasonID, in.Name, in.Description, in.PlayoffSpots, in.KickoffDay, in.KickoffSlots).Scan(&id)
	if err != nil {
		return nil, err
	}
	return s.GetDivision(ctx, id)
}

func (s *Store) UpdateDivision(ctx context.Context, id string, in DivisionInput) (*domain.Division, error) {
	tag, err := s.db.Exec(ctx, `
		UPDATE arena_divisions SET name = $2, description = $3, playoff_spots = $4, kickoff_day = $5, kickoff_slots = $6, updated_at = NOW()
		WHERE id = $1`, id, in.Name, in.Description, in.PlayoffSpots, in.KickoffDay, in.KickoffSlots)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	return s.GetDivision(ctx, id)
}

func (s *Store) DeleteDivision(ctx context.Context, id string) error {
	tag, err := s.db.Exec(ctx, `DELETE FROM arena_divisions WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ClubsWithResults are the club ids in a division that have a played match there.
func (s *Store) ClubsWithResults(ctx context.Context, divisionID string) (map[string]bool, error) {
	rows, err := s.db.Query(ctx, `
		SELECT DISTINCT c FROM (
			SELECT home_club_id AS c FROM arena_matches WHERE division_id = $1 AND status IN ('completed', 'forfeit')
			UNION ALL
			SELECT away_club_id FROM arena_matches WHERE division_id = $1 AND status IN ('completed', 'forfeit')
		) t WHERE c IS NOT NULL`, divisionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]bool{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out[id] = true
	}
	return out, rows.Err()
}

// SetDivisionClubs makes the division's clubs exactly clubIDs for the season.
// Clubs not listed are removed, and clubs already in another division this season
// move. The caller has already checked that no club with results is being moved.
func (s *Store) SetDivisionClubs(ctx context.Context, divisionID, seasonID string, clubIDs []string) error {
	if _, err := s.db.Exec(ctx, `DELETE FROM arena_division_clubs WHERE division_id = $1 AND NOT (club_id::text = ANY($2))`, divisionID, clubIDs); err != nil {
		return err
	}
	// Moving a club out of another division this season.
	if _, err := s.db.Exec(ctx, `DELETE FROM arena_division_clubs WHERE season_id = $1 AND division_id <> $2 AND club_id::text = ANY($3)`, seasonID, divisionID, clubIDs); err != nil {
		return err
	}
	for _, id := range clubIDs {
		if _, err := s.db.Exec(ctx, `
			INSERT INTO arena_division_clubs (division_id, club_id, season_id) VALUES ($1, $2, $3)
			ON CONFLICT DO NOTHING`, divisionID, id, seasonID); err != nil {
			return err
		}
	}
	return nil
}

// DivisionOfClub is the division a club plays in for a season, if any.
func (s *Store) DivisionOfClub(ctx context.Context, clubID, seasonID string) (*domain.Division, error) {
	var id string
	err := s.db.QueryRow(ctx, `SELECT division_id FROM arena_division_clubs WHERE club_id = $1 AND season_id = $2`, clubID, seasonID).Scan(&id)
	if err != nil {
		return nil, notFound(err)
	}
	return s.GetDivision(ctx, id)
}

// DivisionClubRefs are the clubs in a division, for building its table.
func (s *Store) DivisionClubRefs(ctx context.Context, divisionID string) ([]domain.ClubRef, error) {
	rows, err := s.db.Query(ctx, `
		SELECT c.id, c.name, c.short, c.color, c.crest_url
		FROM arena_division_clubs dc JOIN arena_clubs c ON c.id = dc.club_id
		WHERE dc.division_id = $1 ORDER BY c.name`, divisionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.ClubRef{}
	for rows.Next() {
		var c domain.ClubRef
		if err := rows.Scan(&c.ID, &c.Name, &c.Short, &c.Color, &c.CrestURL); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}
