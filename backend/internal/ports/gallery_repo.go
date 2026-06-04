package ports

import (
	"context"
	"fmt"
	"showtime-backend/internal/domain"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type GalleryRepository interface {
	Create(ctx context.Context, gallery *domain.Gallery) error
	Update(ctx context.Context, gallery *domain.Gallery) error
	FindAll(ctx context.Context, competitionID *string, limit, offset int) ([]*domain.Gallery, int64, error)
	FindByID(ctx context.Context, id string) (*domain.Gallery, error)
	Delete(ctx context.Context, id string) error
}

type GalleryPGRepository struct {
	db *pgxpool.Pool
}

func NewGalleryRepository(db *pgxpool.Pool) GalleryRepository {
	return &GalleryPGRepository{db: db}
}

func (r *GalleryPGRepository) Create(ctx context.Context, gallery *domain.Gallery) error {
	query := `
		INSERT INTO gallery (competition_id, game_week, date, players_photo_url, fans_photo_url, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	err := r.db.QueryRow(ctx, query,
		gallery.CompetitionID, gallery.GameWeek, gallery.Date, gallery.PlayersPhotoURL, gallery.FansPhotoURL, gallery.CreatedAt,
	).Scan(&gallery.ID)

	if err != nil {
		return fmt.Errorf("failed to create gallery item: %w", err)
	}
	return nil
}

func (r *GalleryPGRepository) Update(ctx context.Context, gallery *domain.Gallery) error {
	query := `
		UPDATE gallery
		SET competition_id = $2, game_week = $3, date = $4, players_photo_url = $5, fans_photo_url = $6
		WHERE id = $1
	`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	tag, err := r.db.Exec(ctx, query,
		gallery.ID, gallery.CompetitionID, gallery.GameWeek, gallery.Date, gallery.PlayersPhotoURL, gallery.FansPhotoURL,
	)
	if err != nil {
		return fmt.Errorf("failed to update gallery item: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("gallery item not found")
	}
	return nil
}

func (r *GalleryPGRepository) FindAll(ctx context.Context, competitionID *string, limit, offset int) ([]*domain.Gallery, int64, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	baseQuery := `
		SELECT g.id, g.competition_id, g.game_week, g.date, g.players_photo_url, g.fans_photo_url, g.created_at,
			c.id, c.name, c.logo, c.status,
			count(*) OVER()
		FROM gallery g
		LEFT JOIN competitions c ON g.competition_id = c.id
	`

	var (
		rows pgx.Rows
		err  error
	)

	if competitionID != nil && *competitionID != "" {
		query := baseQuery + `
			WHERE g.competition_id = $1
			ORDER BY g.created_at DESC
			LIMIT $2 OFFSET $3
		`
		rows, err = r.db.Query(ctx, query, *competitionID, limit, offset)
	} else {
		query := baseQuery + `
			ORDER BY g.created_at DESC
			LIMIT $1 OFFSET $2
		`
		rows, err = r.db.Query(ctx, query, limit, offset)
	}

	if err != nil {
		return nil, 0, fmt.Errorf("failed to fetch gallery items: %w", err)
	}
	defer rows.Close()

	var galleryList []*domain.Gallery
	var total int64

	for rows.Next() {
		var g domain.Gallery
		var compID, compName, compLogo, compStatus *string
		if err := rows.Scan(
			&g.ID, &g.CompetitionID, &g.GameWeek, &g.Date, &g.PlayersPhotoURL, &g.FansPhotoURL, &g.CreatedAt,
			&compID, &compName, &compLogo, &compStatus,
			&total,
		); err != nil {
			return nil, 0, fmt.Errorf("failed to scan gallery item: %w", err)
		}
		if compID != nil {
			g.Competition = &domain.Competition{
				ID:     *compID,
				Name:   derefStr(compName),
				Logo:   derefStr(compLogo),
				Status: derefStr(compStatus),
			}
		}
		galleryList = append(galleryList, &g)
	}

	return galleryList, total, nil
}

func (r *GalleryPGRepository) FindByID(ctx context.Context, id string) (*domain.Gallery, error) {
	query := `
		SELECT g.id, g.competition_id, g.game_week, g.date, g.players_photo_url, g.fans_photo_url, g.created_at,
			c.id, c.name, c.logo, c.status
		FROM gallery g
		LEFT JOIN competitions c ON g.competition_id = c.id
		WHERE g.id = $1
	`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	var g domain.Gallery
	var compID, compName, compLogo, compStatus *string
	err := r.db.QueryRow(ctx, query, id).Scan(
		&g.ID, &g.CompetitionID, &g.GameWeek, &g.Date, &g.PlayersPhotoURL, &g.FansPhotoURL, &g.CreatedAt,
		&compID, &compName, &compLogo, &compStatus,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to find gallery item: %w", err)
	}
	if compID != nil {
		g.Competition = &domain.Competition{
			ID:     *compID,
			Name:   derefStr(compName),
			Logo:   derefStr(compLogo),
			Status: derefStr(compStatus),
		}
	}
	return &g, nil
}

func (r *GalleryPGRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM gallery WHERE id = $1`
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	_, err := r.db.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete gallery item: %w", err)
	}
	return nil
}

func derefStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
