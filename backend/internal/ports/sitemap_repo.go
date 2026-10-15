package ports

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// SitemapEntry is one public detail page: its path on the site and when it last
// changed (zero when unknown).
type SitemapEntry struct {
	Path    string
	LastMod time.Time
}

type SitemapRepository interface {
	// DetailPages lists every public detail page: published news, matches,
	// current players and teams, published Team of the Week editions and opened
	// Player of the Week polls.
	DetailPages(ctx context.Context) ([]SitemapEntry, error)
}

type SitemapPGRepository struct {
	db *pgxpool.Pool
}

func NewSitemapRepository(db *pgxpool.Pool) SitemapRepository {
	return &SitemapPGRepository{db: db}
}

// Each filter mirrors what the public page itself serves, so the sitemap never
// lists a URL that 404s or redirects: hero-only news and future-dated articles
// are not on /news, inactive players and teams are not on /players and /teams,
// and unpublished editions are not on /totw.
const sitemapDetailQuery = `
	SELECT '/news/' || slug, updated_at FROM news
	  WHERE is_hero_only = FALSE AND COALESCE(published_at, created_at) <= NOW()
	UNION ALL
	SELECT '/matches/' || id::text, updated_at FROM matches
	UNION ALL
	SELECT '/teams/' || id::text, updated_at FROM teams
	  WHERE COALESCE(status, 'active') = 'active'
	UNION ALL
	SELECT '/players/' || p.id::text, p.updated_at FROM players p
	  LEFT JOIN teams t ON t.id = p.team_id
	  WHERE COALESCE(p.status, 'active') = 'active'
	    AND (p.team_id IS NULL OR COALESCE(t.status, 'active') = 'active')
	UNION ALL
	SELECT '/totw/' || id::text, updated_at FROM team_of_the_week WHERE is_published = TRUE
	UNION ALL
	SELECT '/potw/' || pp.id::text, pp.updated_at FROM potw_polls pp
	  JOIN team_of_the_week tw ON tw.id = pp.totw_id
	  WHERE tw.is_published = TRUE AND pp.opens_at <= NOW()
`

func (r *SitemapPGRepository) DetailPages(ctx context.Context) ([]SitemapEntry, error) {
	rows, err := r.db.Query(ctx, sitemapDetailQuery)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []SitemapEntry
	for rows.Next() {
		var e SitemapEntry
		var updated *time.Time
		if err := rows.Scan(&e.Path, &updated); err != nil {
			return nil, err
		}
		if updated != nil {
			e.LastMod = *updated
		}
		out = append(out, e)
	}
	return out, rows.Err()
}
