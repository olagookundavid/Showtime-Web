package services

import (
	"context"
	"fmt"
	"pkg-common/logger"
	"showtime-backend/internal/richtext"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// BackfillNewsRichText brings stored articles up to the rich-text format: bodies
// still in the legacy tag grammar are converted to editor HTML, and every body
// gets its content_text search projection. Idempotent — converted rows start
// with "<" and already have content_text, so later boots find nothing to do.
// Failures are logged, never fatal: an unconverted body still renders.
func BackfillNewsRichText(ctx context.Context, pool *pgxpool.Pool, log *logger.Logger) {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()

	rows, err := pool.Query(ctx, `
		SELECT id::text, content FROM news
		WHERE content_text = '' OR ltrim(content) NOT LIKE '<%'`)
	if err != nil {
		log.Error(fmt.Sprintf("news rich-text backfill: query failed: %v", err), nil)
		return
	}
	type pending struct{ id, content string }
	var todo []pending
	for rows.Next() {
		var p pending
		if err := rows.Scan(&p.id, &p.content); err != nil {
			rows.Close()
			log.Error(fmt.Sprintf("news rich-text backfill: scan failed: %v", err), nil)
			return
		}
		todo = append(todo, p)
	}
	rows.Close()

	converted := 0
	for _, p := range todo {
		content := richtext.SanitizeArticle(richtext.LegacyToHTML(p.content))
		// updated_at is left alone: this is a format change, not an edit.
		if _, err := pool.Exec(ctx, `UPDATE news SET content = $2, content_text = $3 WHERE id = $1`,
			p.id, content, richtext.PlainText(content)); err != nil {
			log.Error(fmt.Sprintf("news rich-text backfill: update %s failed: %v", p.id, err), nil)
			continue
		}
		converted++
	}
	if converted > 0 {
		log.Info(fmt.Sprintf("news rich-text backfill: updated %d article(s)", converted), nil)
	}
}
