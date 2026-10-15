package transport

import (
	"bytes"
	"encoding/xml"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"showtime-backend/internal/ports"

	"github.com/gin-gonic/gin"
)

type ISitemapHandler interface {
	GetSitemap(c *gin.Context)
}

// sitemapStaticPaths are the public pages that don't come from the database.
// Keep it in step with the public routes in frontend/src/App.tsx: add a path
// when a public page is added and remove it when one is removed. Dashboards,
// login, cart and anything else robots.txt disallows stay out.
var sitemapStaticPaths = []string{
	"/",
	"/news",
	"/matches",
	"/standings",
	"/stats",
	"/teams",
	"/players",
	"/totw",
	"/potw",
	"/tickets",
	"/store",
	"/fantasy",
	"/about/showtime-flag",
	"/about/our-team",
	"/about/rules",
	"/about/byelaws",
	"/about/arena",
	"/about/education",
	"/about/media-guidelines",
	"/about/sponsorships",
	"/about/faq",
	"/about/whistleblower",
	"/about/privacy",
}

const (
	defaultSiteURL     = "https://www.showtimeflag.football"
	sitemapCacheTTL    = time.Hour
	sitemapMaxURLs     = 50000 // the protocol's limit for one sitemap file
	sitemapNamespace   = "http://www.sitemaps.org/schemas/sitemap/0.9"
	sitemapLastModDate = "2006-01-02"
)

type SitemapHandler struct {
	repo    ports.SitemapRepository
	siteURL string

	mu      sync.Mutex
	cached  []byte
	builtAt time.Time
}

func NewSitemapHandler(repo ports.SitemapRepository) ISitemapHandler {
	site := strings.TrimRight(os.Getenv("FRONTEND_URL"), "/")
	if site == "" {
		site = defaultSiteURL
	}
	return &SitemapHandler{repo: repo, siteURL: site}
}

type sitemapURL struct {
	Loc     string `xml:"loc"`
	LastMod string `xml:"lastmod,omitempty"`
}

type sitemapURLSet struct {
	XMLName xml.Name     `xml:"urlset"`
	Xmlns   string       `xml:"xmlns,attr"`
	URLs    []sitemapURL `xml:"url"`
}

// GetSitemap serves /sitemap.xml (the frontend proxies it here). The XML is
// rebuilt at most once an hour; if the database is down, the last good copy is
// served instead of an error so crawlers never see a broken sitemap.
func (h *SitemapHandler) GetSitemap(c *gin.Context) {
	body, err := h.build(c)
	if err != nil {
		c.AbortWithStatus(http.StatusServiceUnavailable)
		return
	}
	c.Header("Cache-Control", "public, max-age=3600")
	c.Data(http.StatusOK, "application/xml; charset=utf-8", body)
}

func (h *SitemapHandler) build(c *gin.Context) ([]byte, error) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.cached != nil && time.Since(h.builtAt) < sitemapCacheTTL {
		return h.cached, nil
	}

	pages, err := h.repo.DetailPages(c.Request.Context())
	if err != nil {
		if h.cached != nil {
			return h.cached, nil
		}
		return nil, err
	}

	set := sitemapURLSet{Xmlns: sitemapNamespace}
	for _, p := range sitemapStaticPaths {
		set.URLs = append(set.URLs, sitemapURL{Loc: h.siteURL + p})
	}
	for _, p := range pages {
		if len(set.URLs) >= sitemapMaxURLs {
			break
		}
		u := sitemapURL{Loc: h.siteURL + p.Path}
		if !p.LastMod.IsZero() {
			u.LastMod = p.LastMod.UTC().Format(sitemapLastModDate)
		}
		set.URLs = append(set.URLs, u)
	}

	var buf bytes.Buffer
	buf.WriteString(xml.Header)
	enc := xml.NewEncoder(&buf)
	enc.Indent("", "  ")
	if err := enc.Encode(set); err != nil {
		return nil, err
	}

	h.cached, h.builtAt = buf.Bytes(), time.Now()
	return h.cached, nil
}
