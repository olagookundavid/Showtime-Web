package ports

import (
	"context"
	"errors"
	"fmt"
	"showtime-backend/internal/domain"

	"github.com/jackc/pgx/v5"
)

var (
	// ErrBadgeIconNotFound is returned for an unknown library icon.
	ErrBadgeIconNotFound = errors.New("badge artwork not found")
	// ErrBadgeIconDuplicate is returned when the image is already in the library.
	ErrBadgeIconDuplicate = errors.New("this image is already in the badge library")
)

// ErrBadgeIconInUse is returned when deleting artwork that badges still show.
type ErrBadgeIconInUse struct{ Badges []string }

func (e ErrBadgeIconInUse) Error() string {
	return fmt.Sprintf("this artwork is used by %d badge(s): pick different artwork for them first", len(e.Badges))
}

const badgeIconSelect = `
	SELECT i.id, i.name, i.image_url, i.created_at, i.updated_at,
	       COALESCE(ARRAY(SELECT b.name FROM badges b WHERE b.icon = i.image_url ORDER BY b.name), '{}')
	FROM badge_icons i
`

func scanBadgeIcon(row pgx.Row) (*domain.BadgeIcon, error) {
	var ic domain.BadgeIcon
	if err := row.Scan(&ic.ID, &ic.Name, &ic.ImageURL, &ic.CreatedAt, &ic.UpdatedAt, &ic.UsedBy); err != nil {
		return nil, err
	}
	return &ic, nil
}

// ListBadgeIcons returns the library, newest first, each with the badges using it.
func (r *PostgresBadgeRepository) ListBadgeIcons(ctx context.Context) ([]domain.BadgeIcon, error) {
	rows, err := r.db.Query(ctx, badgeIconSelect+` ORDER BY i.created_at DESC, i.name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.BadgeIcon
	for rows.Next() {
		ic, err := scanBadgeIcon(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *ic)
	}
	return out, rows.Err()
}

func (r *PostgresBadgeRepository) getBadgeIcon(ctx context.Context, q potwQuerier, id string) (*domain.BadgeIcon, error) {
	ic, err := scanBadgeIcon(q.QueryRow(ctx, badgeIconSelect+` WHERE i.id = $1`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrBadgeIconNotFound
	}
	return ic, err
}

// CreateBadgeIcon adds artwork to the library.
func (r *PostgresBadgeRepository) CreateBadgeIcon(ctx context.Context, name, imageURL string) (*domain.BadgeIcon, error) {
	var id string
	err := r.db.QueryRow(ctx,
		`INSERT INTO badge_icons (name, image_url) VALUES ($1, $2) RETURNING id`, name, imageURL).Scan(&id)
	if isUniqueViolation(err) {
		return nil, ErrBadgeIconDuplicate
	}
	if err != nil {
		return nil, err
	}
	return r.getBadgeIcon(ctx, r.db, id)
}

// UpdateBadgeIcon renames artwork and/or swaps its image. Swapping the image also
// moves every badge that showed the old image onto the new one, in the same
// transaction, so a badge never points at artwork the library no longer has.
// It returns the icon and how many badges were moved.
func (r *PostgresBadgeRepository) UpdateBadgeIcon(ctx context.Context, id, name, imageURL string) (*domain.BadgeIcon, int, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, 0, err
	}
	defer tx.Rollback(ctx)

	var oldURL string
	err = tx.QueryRow(ctx, `SELECT image_url FROM badge_icons WHERE id = $1 FOR UPDATE`, id).Scan(&oldURL)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, 0, ErrBadgeIconNotFound
	}
	if err != nil {
		return nil, 0, err
	}

	_, err = tx.Exec(ctx,
		`UPDATE badge_icons SET name = $1, image_url = $2, updated_at = NOW() WHERE id = $3`, name, imageURL, id)
	if isUniqueViolation(err) {
		return nil, 0, ErrBadgeIconDuplicate
	}
	if err != nil {
		return nil, 0, err
	}

	moved := 0
	if imageURL != oldURL {
		tag, err := tx.Exec(ctx, `UPDATE badges SET icon = $1, updated_at = NOW() WHERE icon = $2`, imageURL, oldURL)
		if err != nil {
			return nil, 0, err
		}
		moved = int(tag.RowsAffected())
	}

	ic, err := r.getBadgeIcon(ctx, tx, id)
	if err != nil {
		return nil, 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, 0, err
	}
	return ic, moved, nil
}

// DeleteBadgeIcon removes artwork from the library. Artwork a badge still shows
// can't be removed (ErrBadgeIconInUse), so no badge loses its image.
func (r *PostgresBadgeRepository) DeleteBadgeIcon(ctx context.Context, id string) error {
	ic, err := r.getBadgeIcon(ctx, r.db, id)
	if err != nil {
		return err
	}
	if len(ic.UsedBy) > 0 {
		return ErrBadgeIconInUse{Badges: ic.UsedBy}
	}
	tag, err := r.db.Exec(ctx,
		`DELETE FROM badge_icons i WHERE i.id = $1 AND NOT EXISTS (SELECT 1 FROM badges b WHERE b.icon = i.image_url)`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		// A badge picked this artwork in the meantime.
		if ic, err := r.getBadgeIcon(ctx, r.db, id); err == nil && len(ic.UsedBy) > 0 {
			return ErrBadgeIconInUse{Badges: ic.UsedBy}
		}
	}
	return nil
}
