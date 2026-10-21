package ports

import (
	"context"
	"errors"
	"fmt"
	"time"

	"showtime-backend/internal/domain"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrMediaSlugConflict is returned by Create when another file already has the slug.
var ErrMediaSlugConflict = errors.New("media slug already in use")

type MediaRepository interface {
	// List returns every file, most recently changed first.
	List(ctx context.Context) ([]*domain.MediaFile, error)
	// FindByID returns nil, nil when the id is unknown.
	FindByID(ctx context.Context, id string) (*domain.MediaFile, error)
	SlugExists(ctx context.Context, slug string) (bool, error)
	// Create fills in ID, CreatedAt and UpdatedAt. Returns ErrMediaSlugConflict when the slug is taken.
	Create(ctx context.Context, f *domain.MediaFile) error
	UpdateTitle(ctx context.Context, id, title string) error
	// UpdateFile records a replacement upload; the key and URL don't change.
	UpdateFile(ctx context.Context, id, filename, contentType string, size int64) error
	Delete(ctx context.Context, id string) error
}

type MediaPGRepository struct {
	db *pgxpool.Pool
}

func NewMediaRepository(db *pgxpool.Pool) MediaRepository {
	return &MediaPGRepository{db: db}
}

const mediaTimeout = 3 * time.Second

const mediaSelect = `
	SELECT m.id, m.slug, m.object_key, m.url, m.title, m.original_filename, m.content_type,
	       m.size_bytes, m.uploaded_by, COALESCE(u.full_name, ''), m.created_at, m.updated_at
	FROM media_files m
	LEFT JOIN users u ON u.id = m.uploaded_by`

func scanMediaFile(row pgx.Row) (*domain.MediaFile, error) {
	var f domain.MediaFile
	err := row.Scan(&f.ID, &f.Slug, &f.ObjectKey, &f.URL, &f.Title, &f.OriginalFilename, &f.ContentType,
		&f.SizeBytes, &f.UploadedBy, &f.UploadedByName, &f.CreatedAt, &f.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &f, nil
}

func (r *MediaPGRepository) List(ctx context.Context) ([]*domain.MediaFile, error) {
	ctx, cancel := context.WithTimeout(ctx, mediaTimeout)
	defer cancel()

	rows, err := r.db.Query(ctx, mediaSelect+` ORDER BY m.updated_at DESC, m.slug ASC`)
	if err != nil {
		return nil, fmt.Errorf("failed to list media files: %w", err)
	}
	defer rows.Close()

	out := []*domain.MediaFile{}
	for rows.Next() {
		f, err := scanMediaFile(rows)
		if err != nil {
			return nil, fmt.Errorf("failed to scan media file: %w", err)
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

func (r *MediaPGRepository) FindByID(ctx context.Context, id string) (*domain.MediaFile, error) {
	ctx, cancel := context.WithTimeout(ctx, mediaTimeout)
	defer cancel()

	f, err := scanMediaFile(r.db.QueryRow(ctx, mediaSelect+` WHERE m.id = $1`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to find media file: %w", err)
	}
	return f, nil
}

func (r *MediaPGRepository) SlugExists(ctx context.Context, slug string) (bool, error) {
	ctx, cancel := context.WithTimeout(ctx, mediaTimeout)
	defer cancel()

	var exists bool
	err := r.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM media_files WHERE slug = $1)`, slug).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check media slug: %w", err)
	}
	return exists, nil
}

func (r *MediaPGRepository) Create(ctx context.Context, f *domain.MediaFile) error {
	ctx, cancel := context.WithTimeout(ctx, mediaTimeout)
	defer cancel()

	err := r.db.QueryRow(ctx, `
		INSERT INTO media_files (slug, object_key, url, title, original_filename, content_type, size_bytes, uploaded_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at, updated_at`,
		f.Slug, f.ObjectKey, f.URL, f.Title, f.OriginalFilename, f.ContentType, f.SizeBytes, f.UploadedBy).
		Scan(&f.ID, &f.CreatedAt, &f.UpdatedAt)
	if isUniqueViolation(err) {
		return ErrMediaSlugConflict
	}
	if err != nil {
		return fmt.Errorf("failed to create media file: %w", err)
	}
	return nil
}

func (r *MediaPGRepository) UpdateTitle(ctx context.Context, id, title string) error {
	ctx, cancel := context.WithTimeout(ctx, mediaTimeout)
	defer cancel()

	if _, err := r.db.Exec(ctx, `UPDATE media_files SET title = $1, updated_at = NOW() WHERE id = $2`, title, id); err != nil {
		return fmt.Errorf("failed to update media file: %w", err)
	}
	return nil
}

func (r *MediaPGRepository) UpdateFile(ctx context.Context, id, filename, contentType string, size int64) error {
	ctx, cancel := context.WithTimeout(ctx, mediaTimeout)
	defer cancel()

	_, err := r.db.Exec(ctx, `
		UPDATE media_files SET original_filename = $1, content_type = $2, size_bytes = $3, updated_at = NOW()
		WHERE id = $4`, filename, contentType, size, id)
	if err != nil {
		return fmt.Errorf("failed to update media file: %w", err)
	}
	return nil
}

func (r *MediaPGRepository) Delete(ctx context.Context, id string) error {
	ctx, cancel := context.WithTimeout(ctx, mediaTimeout)
	defer cancel()

	if _, err := r.db.Exec(ctx, `DELETE FROM media_files WHERE id = $1`, id); err != nil {
		return fmt.Errorf("failed to delete media file: %w", err)
	}
	return nil
}
