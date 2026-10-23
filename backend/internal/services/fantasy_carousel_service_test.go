package services

import (
	"context"
	"errors"
	"testing"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

type fakeCarouselRepo struct {
	ports.FantasyCarouselRepository
	count  int
	addErr error
	added  []string
}

func (f *fakeCarouselRepo) Count(context.Context) (int, error) { return f.count, nil }
func (f *fakeCarouselRepo) Add(_ context.Context, newsID string, _ bool) (*domain.FantasyCarouselSlide, error) {
	if f.addErr != nil {
		return nil, f.addErr
	}
	f.added = append(f.added, newsID)
	return &domain.FantasyCarouselSlide{ID: "slide-" + newsID, NewsID: newsID}, nil
}
func (f *fakeCarouselRepo) List(context.Context, bool) ([]*domain.FantasyCarouselSlide, error) {
	out := []*domain.FantasyCarouselSlide{}
	for _, id := range f.added {
		out = append(out, &domain.FantasyCarouselSlide{ID: "slide-" + id, NewsID: id, IsActive: true, News: &domain.News{Title: "t"}})
	}
	return out, nil
}

type fakeArticles struct {
	created []dto.CreateNewsRequest
}

func (f *fakeArticles) CreateArticle(_ context.Context, req dto.CreateNewsRequest) (*domain.News, error) {
	f.created = append(f.created, req)
	return &domain.News{ID: "news-1", Title: req.Title, Category: req.Category}, nil
}

type fakeNewsRepo struct {
	ports.NewsRepository
	deleted []string
}

func (f *fakeNewsRepo) Delete(_ context.Context, id string) error {
	f.deleted = append(f.deleted, id)
	return nil
}

func TestQuickAddTakesTheArticleBackDownWhenTheCarouselFillsInBetween(t *testing.T) {
	// The capacity check passes (9 slides) but the slide insert loses the race
	// for the last place.
	repo := &fakeCarouselRepo{count: 9, addErr: domain.ErrFantasyCarouselFull}
	articles := &fakeArticles{}
	news := &fakeNewsRepo{}
	svc := NewFantasyCarouselService(repo, articles, news)

	_, err := svc.QuickAdd(context.Background(), dto.CreateNewsRequest{Title: "x", Content: "<p>x</p>"})
	if !errors.Is(err, domain.ErrFantasyCarouselFull) {
		t.Fatalf("err = %v, want ErrFantasyCarouselFull", err)
	}
	if len(articles.created) != 1 || len(news.deleted) != 1 || news.deleted[0] != "news-1" {
		t.Errorf("the article published for the slide must be deleted again: created %d, deleted %v", len(articles.created), news.deleted)
	}
}

func TestQuickAddRefusesAFullCarouselBeforePublishing(t *testing.T) {
	repo := &fakeCarouselRepo{count: domain.FantasyCarouselMax}
	articles := &fakeArticles{}
	svc := NewFantasyCarouselService(repo, articles, &fakeNewsRepo{})

	if _, err := svc.QuickAdd(context.Background(), dto.CreateNewsRequest{Title: "x", Content: "<p>x</p>"}); !errors.Is(err, domain.ErrFantasyCarouselFull) {
		t.Fatalf("err = %v, want ErrFantasyCarouselFull", err)
	}
	if len(articles.created) != 0 {
		t.Error("nothing should be published when the carousel is already full")
	}
}

func TestQuickAddCategory(t *testing.T) {
	for _, tc := range []struct{ in, want string }{
		{"", "Fantasy"},
		{"fantasy", "Fantasy"},
		{"  FANTASY NEWS ", "Fantasy News"},
	} {
		articles := &fakeArticles{}
		svc := NewFantasyCarouselService(&fakeCarouselRepo{}, articles, &fakeNewsRepo{})
		if _, err := svc.QuickAdd(context.Background(), dto.CreateNewsRequest{Title: "x", Content: "<p>x</p>", Category: tc.in}); err != nil {
			t.Fatalf("category %q: %v", tc.in, err)
		}
		if got := articles.created[0].Category; got != tc.want {
			t.Errorf("category %q filed as %q, want %q", tc.in, got, tc.want)
		}
	}

	articles := &fakeArticles{}
	svc := NewFantasyCarouselService(&fakeCarouselRepo{}, articles, &fakeNewsRepo{})
	if _, err := svc.QuickAdd(context.Background(), dto.CreateNewsRequest{Title: "x", Content: "<p>x</p>", Category: "General"}); err == nil {
		t.Error("a category outside Fantasy / Fantasy News must be refused")
	}
	if len(articles.created) != 0 {
		t.Error("a refused category must not publish anything")
	}
}
