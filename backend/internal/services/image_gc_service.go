package services

import (
	"context"
	"fmt"
	"strings"
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
	// Inline body images in article content — without these they'd look
	// orphaned and get swept. The rich-text format embeds <img src="URL">; the
	// legacy [image:URL|caption] tag stays covered for any body not yet converted.
	// Attribute values are HTML-escaped, so a URL with "&" appears as "&amp;".
	`SELECT replace(m[1], '&amp;', '&') FROM news, regexp_matches(content, '<img[^>]+src="([^"]+)"', 'g') AS m`,
	`SELECT m[1] FROM news, regexp_matches(content, '\[image:([^|\]]+)', 'g') AS m`,
	`SELECT image FROM players WHERE image IS NOT NULL AND image <> ''`,
	`SELECT logo FROM teams WHERE logo IS NOT NULL AND logo <> ''`,
	`SELECT logo FROM competitions WHERE logo IS NOT NULL AND logo <> ''`,
	`SELECT highlights_url FROM matches WHERE highlights_url IS NOT NULL AND highlights_url <> ''`,
	`SELECT ticket_url FROM matches WHERE ticket_url IS NOT NULL AND ticket_url <> ''`,
	`SELECT image_url FROM store_product_images WHERE image_url IS NOT NULL AND image_url <> ''`,
	`SELECT image_url FROM store_product_variants WHERE image_url IS NOT NULL AND image_url <> ''`,
	`SELECT image_url FROM hero_slides WHERE image_url IS NOT NULL AND image_url <> ''`,
	`SELECT mobile_image_url FROM hero_slides WHERE mobile_image_url IS NOT NULL AND mobile_image_url <> ''`,
	`SELECT image_url FROM season_graphics WHERE image_url IS NOT NULL AND image_url <> ''`,
	`SELECT mobile_image_url FROM season_graphics WHERE mobile_image_url IS NOT NULL AND mobile_image_url <> ''`,
	`SELECT icon FROM badges WHERE icon IS NOT NULL AND icon <> ''`,
	`SELECT image_url FROM badge_icons WHERE image_url IS NOT NULL AND image_url <> ''`,
	`SELECT claimed_photo FROM player_claims WHERE claimed_photo <> ''`,
	`SELECT url FROM media_files`,
}

// protectedPrefixes are never swept, referenced or not:
//   - files/ is the media library. Its keys are fixed and its rows are the
//     reference, but a file mid-replace or mid-create must never be collected.
//   - pdfs/ and badges/ hold files uploaded by hand or by cmd/upload_badges, which
//     the site links to from code (or from seeded rows on an older CDN host that
//     ObjectKeyFromURL can't match), so no query can see them.
//
// uploads-tmp/ is deliberately NOT protected: abandoned media uploads land there
// and are collected once older than the TTL.
var protectedPrefixes = []string{"files/", "pdfs/", "badges/"}

func isProtectedKey(key string) bool {
	for _, p := range protectedPrefixes {
		if strings.HasPrefix(key, p) {
			return true
		}
	}
	return false
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
		if _, isReferenced := referenced[obj.Key]; isReferenced || isProtectedKey(obj.Key) {
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
