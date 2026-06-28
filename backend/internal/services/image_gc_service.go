package services

import (
	"context"
	"fmt"
	"time"

	"pkg-common/logger"
	"showtime-backend/internal/ports"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ImageGCService sweeps the object store for orphaned images — objects that no
// database row references anymore. Orphans accrue from three sources:
//   - abandoned uploads (user picks an image, which uploads immediately via a
//     presigned URL, then never saves the entity),
//   - entity deletes that don't remove the underlying object,
//   - image replacements on update that drop the old object.
//
// Safety design (this DELETES from the bucket, so correctness is paramount):
//   - Opt-in (Enabled) and dry-run by default — first runs only log candidates.
//   - A TTL skips recently-modified objects, so an in-flight upload that hasn't
//     been saved yet is never collected.
//   - The referenced-key set is built from an exhaustive query; if ANY part of
//     that query fails, the whole sweep aborts WITHOUT deleting — an incomplete
//     reference set must never cause an in-use image to be removed.
type ImageGCService struct {
	pool    *pgxpool.Pool
	storage ports.StorageService
	log     *logger.Logger

	Enabled bool
	DryRun  bool
	TTL     time.Duration
}

func NewImageGCService(pool *pgxpool.Pool, storage ports.StorageService, log *logger.Logger, enabled, dryRun bool, ttl time.Duration) *ImageGCService {
	return &ImageGCService{
		pool:    pool,
		storage: storage,
		log:     log,
		Enabled: enabled,
		DryRun:  dryRun,
		TTL:     ttl,
	}
}

// referencedImageQueries lists every column that can hold an object URL. KEEP
// THIS EXHAUSTIVE: a column missing from here makes its images look orphaned and
// they could be deleted. When you add a new image/photo/logo column, add it here.
var referencedImageQueries = []string{
	`SELECT featured_image FROM news WHERE featured_image IS NOT NULL AND featured_image <> ''`,
	`SELECT players_photo_url FROM gallery WHERE players_photo_url IS NOT NULL AND players_photo_url <> ''`,
	`SELECT fans_photo_url FROM gallery WHERE fans_photo_url IS NOT NULL AND fans_photo_url <> ''`,
	`SELECT image FROM players WHERE image IS NOT NULL AND image <> ''`,
	`SELECT logo FROM teams WHERE logo IS NOT NULL AND logo <> ''`,
	`SELECT logo FROM competitions WHERE logo IS NOT NULL AND logo <> ''`,
	`SELECT highlights_url FROM matches WHERE highlights_url IS NOT NULL AND highlights_url <> ''`,
	`SELECT ticket_url FROM matches WHERE ticket_url IS NOT NULL AND ticket_url <> ''`,
	`SELECT image_url FROM store_product_images WHERE image_url IS NOT NULL AND image_url <> ''`,
	`SELECT image_url FROM store_product_variants WHERE image_url IS NOT NULL AND image_url <> ''`,
	`SELECT image_url FROM hero_slides WHERE image_url IS NOT NULL AND image_url <> ''`,
}

// collectReferencedKeys returns the set of object keys still referenced by the
// DB. Any query error aborts (returns the error) so we never delete on a
// partial picture.
func (s *ImageGCService) collectReferencedKeys(ctx context.Context) (map[string]struct{}, error) {
	referenced := make(map[string]struct{})
	for _, q := range referencedImageQueries {
		rows, err := s.pool.Query(ctx, q)
		if err != nil {
			return nil, fmt.Errorf("referenced-image query failed (aborting sweep to avoid deleting in-use images): %w", err)
		}
		for rows.Next() {
			var url string
			if err := rows.Scan(&url); err != nil {
				rows.Close()
				return nil, fmt.Errorf("scanning referenced image url: %w", err)
			}
			if key, ok := s.storage.ObjectKeyFromURL(url); ok {
				referenced[key] = struct{}{}
			}
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return nil, err
		}
		rows.Close()
	}
	return referenced, nil
}

// SweepOrphans is the entry point (call it from a scheduled job).
func (s *ImageGCService) SweepOrphans(ctx context.Context) error {
	if !s.Enabled {
		return nil
	}
	if s.storage == nil {
		return fmt.Errorf("image GC: storage service not configured")
	}

	referenced, err := s.collectReferencedKeys(ctx)
	if err != nil {
		s.log.Error(fmt.Sprintf("image GC aborted: %v", err), nil)
		return err
	}

	objects, err := s.storage.ListObjects(ctx)
	if err != nil {
		s.log.Error(fmt.Sprintf("image GC: failed to list objects: %v", err), nil)
		return err
	}

	cutoff := time.Now().Add(-s.TTL)
	var orphans, deleted, skippedRecent int

	for _, obj := range objects {
		if _, isReferenced := referenced[obj.Key]; isReferenced {
			continue
		}
		// Don't touch freshly uploaded objects — they may belong to an entity
		// that's about to be saved.
		if obj.LastModified.After(cutoff) {
			skippedRecent++
			continue
		}
		orphans++

		if s.DryRun {
			s.log.Info("image GC [dry-run] would delete orphan", map[string]any{"key": obj.Key, "last_modified": obj.LastModified})
			continue
		}

		if err := s.storage.DeleteObjectByKey(ctx, obj.Key); err != nil {
			s.log.Error(fmt.Sprintf("image GC: failed to delete orphan %s: %v", obj.Key, err), nil)
			continue
		}
		deleted++
	}

	s.log.Info("image GC sweep complete", map[string]any{
		"scanned":        len(objects),
		"referenced":     len(referenced),
		"orphans":        orphans,
		"deleted":        deleted,
		"skipped_recent": skippedRecent,
		"dry_run":        s.DryRun,
	})
	return nil
}
