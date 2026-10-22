package tests_integration

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
	"showtime-backend/internal/services"

	"github.com/jackc/pgx/v5/pgxpool"
)

// TestFantasyCarouselAgainstTheSchema drives the Fantasy page carousel — the
// repository and the service on top of it — against the real schema.
func TestFantasyCarouselAgainstTheSchema(t *testing.T) {
	dsn := os.Getenv("TEST_DB_DSN")
	if dsn == "" {
		t.Skip("TEST_DB_DSN not set")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(pool.Close)

	tag := fmt.Sprintf("zzcarousel%d", time.Now().UnixNano())
	// Every article this test writes carries the tag in its slug or title, so
	// cleanup can find them; deleting an article cascades to its slide.
	t.Cleanup(func() {
		if _, err := pool.Exec(ctx, `DELETE FROM news WHERE slug LIKE $1 OR title LIKE $1`, "%"+tag+"%"); err != nil {
			t.Logf("cleanup: %v", err)
		}
	})

	article := func(title, excerpt, content string, heroOnly bool) string {
		t.Helper()
		var id string
		if err := pool.QueryRow(ctx, `
			INSERT INTO news (title, slug, excerpt, content, featured_image, author, category, published_at, is_hero_only)
			VALUES ($1, $2, $3, $4, '', '', 'Fantasy', NOW(), $5) RETURNING id`,
			title+" "+tag, strings.ToLower(strings.ReplaceAll(title, " ", "-"))+"-"+tag, excerpt, content, heroOnly).Scan(&id); err != nil {
			t.Fatalf("insert article: %v", err)
		}
		return id
	}

	repo := ports.NewFantasyCarouselRepository(pool)
	newsRepo := ports.NewNewsRepository(pool)
	svc := services.NewFantasyCarouselService(repo, services.NewNewsService(newsRepo, nil), newsRepo)

	existing, err := repo.Count(ctx)
	if err != nil {
		t.Fatalf("Count: %v", err)
	}
	if existing > domain.FantasyCarouselMax-3 {
		t.Skipf("the local carousel already holds %d slides; this test needs room for three", existing)
	}

	first := article("First story", "A short excerpt", "<p>Body</p>", false)
	second := article("Second story", "", "<p>No excerpt here, so the <strong>body</strong> is used.</p>", false)

	t.Run("adds articles in order and fills a missing excerpt from the body", func(t *testing.T) {
		a, err := svc.Add(ctx, dto.AddFantasyCarouselSlideRequest{NewsID: first})
		if err != nil {
			t.Fatalf("Add first: %v", err)
		}
		hidden := false
		b, err := svc.Add(ctx, dto.AddFantasyCarouselSlideRequest{NewsID: second, IsActive: &hidden})
		if err != nil {
			t.Fatalf("Add second: %v", err)
		}
		if b.DisplayOrder <= a.DisplayOrder {
			t.Errorf("second slide order %d should come after first %d", b.DisplayOrder, a.DisplayOrder)
		}
		if a.Article.Summary != "A short excerpt" {
			t.Errorf("summary = %q, want the excerpt", a.Article.Summary)
		}
		if b.Article.Summary != "No excerpt here, so the body is used." {
			t.Errorf("summary = %q, want the article text with tags removed", b.Article.Summary)
		}
		if !strings.HasPrefix(a.Article.Slug, "first-story-") {
			t.Errorf("slide links to %q", a.Article.Slug)
		}
	})

	t.Run("the public list skips hidden slides; the admin list keeps them", func(t *testing.T) {
		public, err := svc.List(ctx, true)
		if err != nil {
			t.Fatal(err)
		}
		admin, err := svc.List(ctx, false)
		if err != nil {
			t.Fatal(err)
		}
		has := func(list []dto.FantasyCarouselSlideResponse, newsID string) bool {
			for _, s := range list {
				if s.Article.ID == newsID {
					return true
				}
			}
			return false
		}
		if !has(public, first) || has(public, second) {
			t.Error("public list should show the active slide and not the hidden one")
		}
		if !has(admin, first) || !has(admin, second) {
			t.Error("admin list should show both slides")
		}
	})

	t.Run("refuses an article twice, a hidden hero article and one that does not exist", func(t *testing.T) {
		if _, err := svc.Add(ctx, dto.AddFantasyCarouselSlideRequest{NewsID: first}); !errors.Is(err, domain.ErrAlreadyOnFantasyCarousel) {
			t.Errorf("duplicate = %v, want ErrAlreadyOnFantasyCarousel", err)
		}
		heroOnly := article("Hero only", "", "<p>x</p>", true)
		if _, err := svc.Add(ctx, dto.AddFantasyCarouselSlideRequest{NewsID: heroOnly}); !errors.Is(err, domain.ErrFantasyCarouselArticleNotFound) {
			t.Errorf("hero-only = %v, want ErrFantasyCarouselArticleNotFound", err)
		}
		if _, err := svc.Add(ctx, dto.AddFantasyCarouselSlideRequest{NewsID: "00000000-0000-0000-0000-000000000000"}); !errors.Is(err, domain.ErrFantasyCarouselArticleNotFound) {
			t.Errorf("missing article = %v, want ErrFantasyCarouselArticleNotFound", err)
		}
	})

	t.Run("quick add publishes a public article and features it", func(t *testing.T) {
		slide, err := svc.QuickAdd(ctx, dto.CreateNewsRequest{
			Title:    "Quick story " + tag,
			Content:  "<p>Written straight from the carousel page.</p>",
			Excerpt:  "Quick excerpt",
			Category: "fantasy news", // normalised to the canonical spelling
		})
		if err != nil {
			t.Fatalf("QuickAdd: %v", err)
		}
		if !slide.IsActive || slide.Article.Category != "Fantasy News" {
			t.Errorf("slide = active %v, category %q; want active, Fantasy News", slide.IsActive, slide.Article.Category)
		}
		// It is a normal article on the news site, not a hidden one.
		feed, _, err := newsRepo.FindAll(ctx, dto.PaginationQuery{Page: 1, Limit: 20, Search: "Quick story " + tag})
		if err != nil {
			t.Fatalf("FindAll: %v", err)
		}
		if len(feed) != 1 || feed[0].ID != slide.Article.ID {
			t.Errorf("the quick-added article should be in the public news feed, got %d results", len(feed))
		}

		if _, err := svc.QuickAdd(ctx, dto.CreateNewsRequest{Title: "Wrong category " + tag, Content: "<p>x</p>", Category: "Match Report"}); err == nil {
			t.Error("a quick add outside the Fantasy categories must be refused")
		}
		var n int
		_ = pool.QueryRow(ctx, `SELECT COUNT(*) FROM news WHERE title = $1`, "Wrong category "+tag).Scan(&n)
		if n != 0 {
			t.Error("a refused quick add must not publish anything")
		}
	})

	t.Run("caps the carousel at ten, and a full quick add publishes nothing", func(t *testing.T) {
		count, err := repo.Count(ctx)
		if err != nil {
			t.Fatal(err)
		}
		for i := count; i < domain.FantasyCarouselMax; i++ {
			if _, err := repo.Add(ctx, article(fmt.Sprintf("Filler %d", i), "", "<p>x</p>", false), true); err != nil {
				t.Fatalf("filling slide %d: %v", i, err)
			}
		}
		if _, err := repo.Add(ctx, article("One too many", "", "<p>x</p>", false), true); !errors.Is(err, domain.ErrFantasyCarouselFull) {
			t.Errorf("11th slide = %v, want ErrFantasyCarouselFull", err)
		}
		if _, err := svc.QuickAdd(ctx, dto.CreateNewsRequest{Title: "Overflow " + tag, Content: "<p>x</p>"}); !errors.Is(err, domain.ErrFantasyCarouselFull) {
			t.Errorf("quick add when full = %v, want ErrFantasyCarouselFull", err)
		}
		var n int
		_ = pool.QueryRow(ctx, `SELECT COUNT(*) FROM news WHERE title = $1`, "Overflow "+tag).Scan(&n)
		if n != 0 {
			t.Error("a quick add refused for a full carousel must not publish an article")
		}
	})

	t.Run("reorder, hide and remove; removing keeps the article; deleting the article removes the slide", func(t *testing.T) {
		list, _ := svc.List(ctx, false)
		var slideID string
		for _, s := range list {
			if s.Article.ID == first {
				slideID = s.ID
			}
		}
		order, active := 99, false
		if err := svc.Update(ctx, slideID, dto.UpdateFantasyCarouselSlideRequest{DisplayOrder: &order, IsActive: &active}); err != nil {
			t.Fatalf("Update: %v", err)
		}
		list, _ = svc.List(ctx, false)
		last := list[len(list)-1]
		if last.ID != slideID || last.IsActive {
			t.Errorf("after moving to 99 and hiding, the slide should be last and hidden")
		}

		if err := svc.Remove(ctx, slideID); err != nil {
			t.Fatalf("Remove: %v", err)
		}
		var stillThere bool
		_ = pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM news WHERE id = $1)`, first).Scan(&stillThere)
		if !stillThere {
			t.Error("removing a slide must not delete its article")
		}
		if err := svc.Remove(ctx, slideID); err == nil {
			t.Error("removing a slide twice should report it is gone")
		}

		if _, err := pool.Exec(ctx, `DELETE FROM news WHERE id = $1`, second); err != nil {
			t.Fatal(err)
		}
		list, _ = svc.List(ctx, false)
		for _, s := range list {
			if s.Article.ID == second {
				t.Error("deleting an article must take its slide with it")
			}
		}
	})

	t.Run("concurrent adds cannot push the carousel past ten", func(t *testing.T) {
		// Make exactly two places free, then race eight adds for them.
		count, _ := repo.Count(ctx)
		if count < domain.FantasyCarouselMax {
			for i := count; i < domain.FantasyCarouselMax; i++ {
				_, _ = repo.Add(ctx, article(fmt.Sprintf("Top up %d", i), "", "<p>x</p>", false), true)
			}
		}
		list, _ := svc.List(ctx, false)
		for _, s := range list[:2] {
			if err := svc.Remove(ctx, s.ID); err != nil {
				t.Fatal(err)
			}
		}
		ids := make([]string, 8)
		for i := range ids {
			ids[i] = article(fmt.Sprintf("Racer %d", i), "", "<p>x</p>", false)
		}
		var wg sync.WaitGroup
		var mu sync.Mutex
		ok, full := 0, 0
		for _, id := range ids {
			wg.Add(1)
			go func(id string) {
				defer wg.Done()
				_, err := repo.Add(ctx, id, true)
				mu.Lock()
				defer mu.Unlock()
				switch {
				case err == nil:
					ok++
				case errors.Is(err, domain.ErrFantasyCarouselFull):
					full++
				default:
					t.Errorf("unexpected error: %v", err)
				}
			}(id)
		}
		wg.Wait()
		final, _ := repo.Count(ctx)
		if ok != 2 || full != 6 || final != domain.FantasyCarouselMax {
			t.Errorf("racing 8 adds for 2 places: %d succeeded, %d refused, %d slides; want 2, 6, 10", ok, full, final)
		}
	})
}
