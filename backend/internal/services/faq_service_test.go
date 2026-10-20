package services

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"testing"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	appErrors "showtime-backend/internal/errors"

	"github.com/google/uuid"
)

type mockFAQRepo struct {
	pages map[string]*domain.FAQPage
	cats  map[string]*domain.FAQCategory
	items map[string]*domain.FAQItem
}

func newMockFAQRepo() *mockFAQRepo {
	return &mockFAQRepo{
		pages: map[string]*domain.FAQPage{},
		cats:  map[string]*domain.FAQCategory{},
		items: map[string]*domain.FAQItem{},
	}
}

func (m *mockFAQRepo) ListPages(context.Context) ([]domain.FAQPageSummary, error) {
	var out []domain.FAQPageSummary
	for _, p := range m.pages {
		out = append(out, domain.FAQPageSummary{FAQPage: *p})
	}
	return out, nil
}
func (m *mockFAQRepo) FindPage(_ context.Context, key string) (*domain.FAQPage, error) {
	return m.pages[key], nil
}
func (m *mockFAQRepo) CreatePage(_ context.Context, p *domain.FAQPage) error {
	m.pages[p.Key] = p
	return nil
}
func (m *mockFAQRepo) UpdatePage(_ context.Context, key, name, path, description string) error {
	p := m.pages[key]
	p.Name, p.Path, p.Description = name, path, description
	return nil
}
func (m *mockFAQRepo) DeletePage(_ context.Context, key string) error {
	delete(m.pages, key)
	return nil
}
func (m *mockFAQRepo) ListCategories(_ context.Context, pageKey string) ([]*domain.FAQCategory, error) {
	var out []*domain.FAQCategory
	for _, c := range m.cats {
		if c.PageKey == pageKey {
			out = append(out, c)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].DisplayOrder < out[j].DisplayOrder })
	return out, nil
}
func (m *mockFAQRepo) FindCategory(_ context.Context, id string) (*domain.FAQCategory, error) {
	return m.cats[id], nil
}
func (m *mockFAQRepo) CategorySlugExists(_ context.Context, pageKey, slug string) (bool, error) {
	for _, c := range m.cats {
		if c.PageKey == pageKey && c.Slug == slug {
			return true, nil
		}
	}
	return false, nil
}
func (m *mockFAQRepo) NextCategoryOrder(_ context.Context, pageKey string) (int, error) {
	max := -1
	for _, c := range m.cats {
		if c.PageKey == pageKey && c.DisplayOrder > max {
			max = c.DisplayOrder
		}
	}
	return max + 1, nil
}
func (m *mockFAQRepo) CreateCategory(_ context.Context, c *domain.FAQCategory) error {
	c.ID = uuid.NewString()
	m.cats[c.ID] = c
	return nil
}
func (m *mockFAQRepo) UpdateCategory(_ context.Context, id, title, icon string) error {
	m.cats[id].Title, m.cats[id].Icon = title, icon
	return nil
}
func (m *mockFAQRepo) DeleteCategory(_ context.Context, id string) error {
	delete(m.cats, id)
	return nil
}
func (m *mockFAQRepo) ListItems(_ context.Context, pageKey string, activeOnly bool) ([]*domain.FAQItem, error) {
	var out []*domain.FAQItem
	for _, i := range m.items {
		if i.PageKey == pageKey && (!activeOnly || i.IsActive) {
			out = append(out, i)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].DisplayOrder < out[j].DisplayOrder })
	return out, nil
}
func (m *mockFAQRepo) FindItem(_ context.Context, id string) (*domain.FAQItem, error) {
	return m.items[id], nil
}
func (m *mockFAQRepo) NextItemOrder(_ context.Context, pageKey string, categoryID *string) (int, error) {
	max := -1
	for _, i := range m.items {
		if i.PageKey == pageKey && sameCategory(i.CategoryID, categoryID) && i.DisplayOrder > max {
			max = i.DisplayOrder
		}
	}
	return max + 1, nil
}
func (m *mockFAQRepo) CreateItem(_ context.Context, i *domain.FAQItem) error {
	i.ID = uuid.NewString()
	m.items[i.ID] = i
	return nil
}
func (m *mockFAQRepo) UpdateItem(_ context.Context, i *domain.FAQItem) error {
	m.items[i.ID] = i
	return nil
}
func (m *mockFAQRepo) DeleteItem(_ context.Context, id string) error {
	delete(m.items, id)
	return nil
}
func (m *mockFAQRepo) ReorderCategories(_ context.Context, ids []string) error {
	for n, id := range ids {
		m.cats[id].DisplayOrder = n
	}
	return nil
}
func (m *mockFAQRepo) ReorderItems(_ context.Context, ids []string) error {
	for n, id := range ids {
		m.items[id].DisplayOrder = n
	}
	return nil
}

func newFAQTestService(t *testing.T) (IFAQService, *mockFAQRepo) {
	t.Helper()
	repo := newMockFAQRepo()
	svc := NewFAQService(repo)
	for _, key := range []string{"faq", "game-pass"} {
		if _, err := svc.CreatePage(context.Background(), dto.CreateFAQPageRequest{Key: key, Name: key}); err != nil {
			t.Fatal(err)
		}
	}
	return svc, repo
}

func isValidation(err error) bool {
	var v appErrors.FAQValidationError
	return errors.As(err, &v)
}

func TestFAQCreatePage_RejectsBadAndDuplicateKeys(t *testing.T) {
	svc, _ := newFAQTestService(t)
	ctx := context.Background()

	for _, key := range []string{"", "Has Space", "-lead", "trail-", "a--b", strings.Repeat("a", 61)} {
		if _, err := svc.CreatePage(ctx, dto.CreateFAQPageRequest{Key: key, Name: "x"}); !isValidation(err) {
			t.Errorf("key %q: want validation error, got %v", key, err)
		}
	}
	if _, err := svc.CreatePage(ctx, dto.CreateFAQPageRequest{Key: "faq", Name: "again"}); !errors.Is(err, appErrors.ErrFAQPageExists) {
		t.Errorf("duplicate key: want ErrFAQPageExists, got %v", err)
	}
	if _, err := svc.CreatePage(ctx, dto.CreateFAQPageRequest{Key: "  Store-FAQ ", Name: "Store"}); err != nil {
		t.Errorf("key should be trimmed and lowercased: %v", err)
	}
}

func TestFAQCreateItem_SanitizesAnswerAndValidates(t *testing.T) {
	svc, repo := newFAQTestService(t)
	ctx := context.Background()

	item, err := svc.CreateItem(ctx, "faq", dto.CreateFAQItemRequest{
		Question: "  Is it safe?  ",
		Answer:   `<p>Yes <strong>very</strong></p><script>alert(1)</script>`,
	})
	if err != nil {
		t.Fatal(err)
	}
	if item.Question != "Is it safe?" {
		t.Errorf("question not trimmed: %q", item.Question)
	}
	if strings.Contains(item.Answer, "script") || !strings.Contains(item.Answer, "<strong>very</strong>") {
		t.Errorf("answer not sanitized: %q", item.Answer)
	}
	if !repo.items[item.ID].IsActive {
		t.Error("new questions should default to active")
	}

	if _, err := svc.CreateItem(ctx, "faq", dto.CreateFAQItemRequest{Question: "q", Answer: "<p></p>"}); !isValidation(err) {
		t.Errorf("empty rich answer: want validation error, got %v", err)
	}
	if _, err := svc.CreateItem(ctx, "faq", dto.CreateFAQItemRequest{Question: "  ", Answer: "a"}); !isValidation(err) {
		t.Errorf("blank question: want validation error, got %v", err)
	}
	if _, err := svc.CreateItem(ctx, "faq", dto.CreateFAQItemRequest{Question: strings.Repeat("q", 301), Answer: "a"}); !isValidation(err) {
		t.Errorf("long question: want validation error, got %v", err)
	}
	if _, err := svc.CreateItem(ctx, "nope", dto.CreateFAQItemRequest{Question: "q", Answer: "a"}); !errors.Is(err, appErrors.ErrFAQPageNotFound) {
		t.Errorf("unknown page: want ErrFAQPageNotFound, got %v", err)
	}
}

func TestFAQItem_CannotUseAnotherPagesCategory(t *testing.T) {
	svc, _ := newFAQTestService(t)
	ctx := context.Background()

	cat, err := svc.CreateCategory(ctx, "faq", dto.CreateFAQCategoryRequest{Title: "General"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.CreateItem(ctx, "game-pass", dto.CreateFAQItemRequest{CategoryID: &cat.ID, Question: "q", Answer: "a"}); !errors.Is(err, appErrors.ErrFAQCategoryNotFound) {
		t.Errorf("want ErrFAQCategoryNotFound, got %v", err)
	}
	bad := "not-a-uuid"
	if _, err := svc.CreateItem(ctx, "faq", dto.CreateFAQItemRequest{CategoryID: &bad, Question: "q", Answer: "a"}); !isValidation(err) {
		t.Errorf("bad uuid: want validation error, got %v", err)
	}
}

func TestFAQCreateCategory_SlugsAreUniquePerPage(t *testing.T) {
	svc, _ := newFAQTestService(t)
	ctx := context.Background()

	a, _ := svc.CreateCategory(ctx, "faq", dto.CreateFAQCategoryRequest{Title: "Games & Attendance"})
	b, _ := svc.CreateCategory(ctx, "faq", dto.CreateFAQCategoryRequest{Title: "Games & Attendance!"})
	c, _ := svc.CreateCategory(ctx, "game-pass", dto.CreateFAQCategoryRequest{Title: "Games & Attendance"})

	if a.Slug != "games-attendance" || b.Slug != "games-attendance-2" || c.Slug != "games-attendance" {
		t.Errorf("slugs: %q %q %q", a.Slug, b.Slug, c.Slug)
	}
	if a.DisplayOrder != 0 || b.DisplayOrder != 1 {
		t.Errorf("categories should append: %d %d", a.DisplayOrder, b.DisplayOrder)
	}
	if _, err := svc.CreateCategory(ctx, "faq", dto.CreateFAQCategoryRequest{Title: "x", Icon: "Bad Icon!"}); !isValidation(err) {
		t.Errorf("bad icon: want validation error, got %v", err)
	}
}

func TestFAQPublicPage_HidesInactiveAndEmptyCategories(t *testing.T) {
	svc, _ := newFAQTestService(t)
	ctx := context.Background()

	full, _ := svc.CreateCategory(ctx, "faq", dto.CreateFAQCategoryRequest{Title: "Full"})
	empty, _ := svc.CreateCategory(ctx, "faq", dto.CreateFAQCategoryRequest{Title: "Only hidden"})
	hidden := false

	mustItem := func(cat *string, q string, active *bool) {
		if _, err := svc.CreateItem(ctx, "faq", dto.CreateFAQItemRequest{CategoryID: cat, Question: q, Answer: "a", IsActive: active}); err != nil {
			t.Fatal(err)
		}
	}
	mustItem(&full.ID, "shown", nil)
	mustItem(&full.ID, "hidden", &hidden)
	mustItem(&empty.ID, "also hidden", &hidden)
	mustItem(nil, "loose", nil)

	pub, err := svc.GetPublicPage(ctx, "faq")
	if err != nil {
		t.Fatal(err)
	}
	if len(pub.Categories) != 1 || pub.Categories[0].ID != full.ID {
		t.Fatalf("public categories: %+v", pub.Categories)
	}
	if got := pub.Categories[0].FAQs; len(got) != 1 || got[0].Question != "shown" {
		t.Errorf("public category items: %+v", got)
	}
	if len(pub.FAQs) != 1 || pub.FAQs[0].Question != "loose" {
		t.Errorf("public ungrouped items: %+v", pub.FAQs)
	}

	adm, _ := svc.GetAdminPage(ctx, "faq")
	if len(adm.Categories) != 2 || len(adm.Categories[0].FAQs)+len(adm.Categories[1].FAQs) != 3 {
		t.Errorf("admin should see everything: %+v", adm)
	}

	if _, err := svc.GetPublicPage(ctx, "missing"); !errors.Is(err, appErrors.ErrFAQPageNotFound) {
		t.Errorf("unknown page: want ErrFAQPageNotFound, got %v", err)
	}
}

func TestFAQUpdateItem_MovingCategoryAppendsToTheNewOne(t *testing.T) {
	svc, repo := newFAQTestService(t)
	ctx := context.Background()

	a, _ := svc.CreateCategory(ctx, "faq", dto.CreateFAQCategoryRequest{Title: "A"})
	b, _ := svc.CreateCategory(ctx, "faq", dto.CreateFAQCategoryRequest{Title: "B"})
	svc.CreateItem(ctx, "faq", dto.CreateFAQItemRequest{CategoryID: &b.ID, Question: "b0", Answer: "a"})
	svc.CreateItem(ctx, "faq", dto.CreateFAQItemRequest{CategoryID: &b.ID, Question: "b1", Answer: "a"})
	moving, _ := svc.CreateItem(ctx, "faq", dto.CreateFAQItemRequest{CategoryID: &a.ID, Question: "a0", Answer: "a"})

	active := true
	if err := svc.UpdateItem(ctx, moving.ID, dto.UpdateFAQItemRequest{CategoryID: &b.ID, Question: "a0", Answer: "a", IsActive: &active}); err != nil {
		t.Fatal(err)
	}
	if got := repo.items[moving.ID].DisplayOrder; got != 2 {
		t.Errorf("moved question should be last in B (2), got %d", got)
	}

	// Editing without changing the category must keep the order.
	if err := svc.UpdateItem(ctx, moving.ID, dto.UpdateFAQItemRequest{CategoryID: &b.ID, Question: "renamed", Answer: "a", IsActive: &active}); err != nil {
		t.Fatal(err)
	}
	if got := repo.items[moving.ID].DisplayOrder; got != 2 {
		t.Errorf("order changed on plain edit: %d", got)
	}
}

func TestFAQReorder(t *testing.T) {
	svc, repo := newFAQTestService(t)
	ctx := context.Background()

	i0, _ := svc.CreateItem(ctx, "faq", dto.CreateFAQItemRequest{Question: "0", Answer: "a"})
	i1, _ := svc.CreateItem(ctx, "faq", dto.CreateFAQItemRequest{Question: "1", Answer: "a"})

	if err := svc.Reorder(ctx, dto.ReorderFAQRequest{Kind: "item", IDs: []string{i1.ID, i0.ID}}); err != nil {
		t.Fatal(err)
	}
	if repo.items[i1.ID].DisplayOrder != 0 || repo.items[i0.ID].DisplayOrder != 1 {
		t.Error("items not reordered")
	}

	for name, req := range map[string]dto.ReorderFAQRequest{
		"empty":     {Kind: "item", IDs: nil},
		"bad kind":  {Kind: "page", IDs: []string{i0.ID}},
		"bad id":    {Kind: "item", IDs: []string{"nope"}},
		"duplicate": {Kind: "item", IDs: []string{i0.ID, i0.ID}},
	} {
		if err := svc.Reorder(ctx, req); !isValidation(err) {
			t.Errorf("%s: want validation error, got %v", name, fmt.Sprint(err))
		}
	}
}
