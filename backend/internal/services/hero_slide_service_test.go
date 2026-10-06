package services

import (
	"context"
	"testing"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
)

type mockHeroSlideRepo struct {
	slides map[string]*domain.HeroSlide
}

func newMockHeroSlideRepo() *mockHeroSlideRepo {
	return &mockHeroSlideRepo{slides: map[string]*domain.HeroSlide{}}
}

func (m *mockHeroSlideRepo) Create(ctx context.Context, slide *domain.HeroSlide) error {
	slide.ID = "slide-" + string(rune('a'+len(m.slides)))
	m.slides[slide.ID] = slide
	return nil
}

func (m *mockHeroSlideRepo) Update(ctx context.Context, id string, imageURL, mobileImageURL, destinationURL *string, displayOrder *int, isActive *bool) error {
	s, ok := m.slides[id]
	if !ok {
		return nil
	}
	if displayOrder != nil {
		s.DisplayOrder = *displayOrder
	}
	if isActive != nil {
		s.IsActive = *isActive
	}
	return nil
}

func (m *mockHeroSlideRepo) FindAll(ctx context.Context, activeOnly bool) ([]*domain.HeroSlide, error) {
	var out []*domain.HeroSlide
	for _, s := range m.slides {
		out = append(out, s)
	}
	return out, nil
}

func (m *mockHeroSlideRepo) FindByID(ctx context.Context, id string) (*domain.HeroSlide, error) {
	return m.slides[id], nil
}

func (m *mockHeroSlideRepo) Count(ctx context.Context) (int, error) {
	return len(m.slides), nil
}

func (m *mockHeroSlideRepo) NextDisplayOrder(ctx context.Context) (int, error) {
	max := -1
	for _, s := range m.slides {
		if s.DisplayOrder > max {
			max = s.DisplayOrder
		}
	}
	return max + 1, nil
}

func (m *mockHeroSlideRepo) Delete(ctx context.Context, id string) error {
	delete(m.slides, id)
	return nil
}

// A slide created after an earlier one has been deleted must not reuse a
// display_order still held by a surviving slide — that collision makes a
// later "move up/down" between the two a no-op swap of equal values.
func TestCreateHeroSlide_AfterDelete_DoesNotCollideWithSurvivingOrder(t *testing.T) {
	repo := newMockHeroSlideRepo()
	svc := NewHeroSlideService(repo, nil)
	ctx := context.Background()

	first, err := svc.Create(ctx, dto.CreateHeroSlideRequest{ImageURL: "a.png"})
	if err != nil {
		t.Fatalf("create first: %v", err)
	}
	second, err := svc.Create(ctx, dto.CreateHeroSlideRequest{ImageURL: "b.png"})
	if err != nil {
		t.Fatalf("create second: %v", err)
	}
	if first.DisplayOrder != 0 || second.DisplayOrder != 1 {
		t.Fatalf("expected orders 0,1 got %d,%d", first.DisplayOrder, second.DisplayOrder)
	}

	if err := svc.Delete(ctx, first.ID); err != nil {
		t.Fatalf("delete first: %v", err)
	}

	third, err := svc.Create(ctx, dto.CreateHeroSlideRequest{ImageURL: "c.png"})
	if err != nil {
		t.Fatalf("create third: %v", err)
	}

	if third.DisplayOrder == second.DisplayOrder {
		t.Fatalf("new slide's display_order %d collides with surviving slide's %d", third.DisplayOrder, second.DisplayOrder)
	}
}
