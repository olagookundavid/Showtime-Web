package services

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

type fakeEventDayRepo struct {
	ports.EventDayRepository
	updatedID       string
	updatedTitle    *string
	updatedDate     *time.Time
	updatedVenue    *string
	updatedIsActive *bool
}

func (f *fakeEventDayRepo) Update(ctx context.Context, id string, title *string, date *time.Time, venue *string, isActive *bool) error {
	f.updatedID = id
	f.updatedTitle = title
	f.updatedDate = date
	f.updatedVenue = venue
	f.updatedIsActive = isActive
	return nil
}

type fakeTierRepo struct {
	ports.TicketTierRepository
	tiers map[string]*domain.TicketTier
}

func (f *fakeTierRepo) GetByID(ctx context.Context, id string) (*domain.TicketTier, error) {
	t, ok := f.tiers[id]
	if !ok {
		return nil, fmt.Errorf("tier not found")
	}
	// return copy
	tierCopy := *t
	return &tierCopy, nil
}

func (f *fakeTierRepo) Update(ctx context.Context, tier *domain.TicketTier) error {
	f.tiers[tier.ID] = tier
	return nil
}

func TestUpdateEventDay(t *testing.T) {
	edRepo := &fakeEventDayRepo{}
	svc := &TicketService{eventDayRepo: edRepo}

	title := "Updated Game Day"
	dateStr := "2026-10-15"
	venue := "Teslim Balogun Stadium"
	isActive := true

	req := dto.UpdateEventDayRequest{
		Title:    &title,
		Date:     &dateStr,
		Venue:    &venue,
		IsActive: &isActive,
	}

	ctx := context.Background()
	err := svc.UpdateEventDay(ctx, "ed-123", req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if edRepo.updatedID != "ed-123" {
		t.Errorf("expected updatedID ed-123, got %s", edRepo.updatedID)
	}
	if edRepo.updatedTitle == nil || *edRepo.updatedTitle != title {
		t.Errorf("expected title %s, got %v", title, edRepo.updatedTitle)
	}
	if edRepo.updatedDate == nil || edRepo.updatedDate.Format("2006-01-02") != dateStr {
		t.Errorf("expected date %s, got %v", dateStr, edRepo.updatedDate)
	}
	if edRepo.updatedVenue == nil || *edRepo.updatedVenue != venue {
		t.Errorf("expected venue %s, got %v", venue, edRepo.updatedVenue)
	}
}

func TestUpdateTier(t *testing.T) {
	existingTier := &domain.TicketTier{
		ID:          "tier-1",
		EventDayID:  "ed-1",
		Name:        "Regular",
		Price:       5000,
		Capacity:    100,
		SoldCount:   15,
		Description: "General admission",
		IsHidden:    false,
		AccessCode:  nil,
	}

	tRepo := &fakeTierRepo{
		tiers: map[string]*domain.TicketTier{
			"tier-1": existingTier,
		},
	}

	svc := &TicketService{tierRepo: tRepo}
	ctx := context.Background()

	// Test 1: Capacity lower than sold count should fail
	newCap := 10 // sold is 15
	_, err := svc.UpdateTier(ctx, "ed-1", "tier-1", dto.UpdateTicketTierRequest{
		Capacity: &newCap,
	})
	if err == nil || !strings.Contains(err.Error(), "cannot be less than tickets already sold") {
		t.Fatalf("expected error about capacity, got %v", err)
	}

	// Test 2: Mismatched eventDayID should fail
	_, err = svc.UpdateTier(ctx, "ed-other", "tier-1", dto.UpdateTicketTierRequest{})
	if err == nil || !strings.Contains(err.Error(), "does not belong to the specified event day") {
		t.Fatalf("expected error about event day mismatch, got %v", err)
	}

	// Test 3: Successful update with hidden tier and uppercase access code
	newName := "VIP Access"
	newPrice := 12000
	newValidCap := 200
	newDesc := "VIP Lounge"
	isHidden := true
	code := "vip2026"

	resp, err := svc.UpdateTier(ctx, "ed-1", "tier-1", dto.UpdateTicketTierRequest{
		Name:        &newName,
		Price:       &newPrice,
		Capacity:    &newValidCap,
		Description: &newDesc,
		IsHidden:    &isHidden,
		AccessCode:  &code,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if resp.Name != newName {
		t.Errorf("expected name %s, got %s", newName, resp.Name)
	}
	if resp.Price != newPrice {
		t.Errorf("expected price %d, got %d", newPrice, resp.Price)
	}
	if resp.Capacity != newValidCap {
		t.Errorf("expected capacity %d, got %d", newValidCap, resp.Capacity)
	}
	if resp.Available != 185 { // 200 - 15 = 185
		t.Errorf("expected available 185, got %d", resp.Available)
	}
	if !resp.IsHidden {
		t.Errorf("expected is_hidden true, got false")
	}
	if resp.AccessCode == nil || *resp.AccessCode != "VIP2026" {
		t.Errorf("expected normalized access code VIP2026, got %v", resp.AccessCode)
	}
}
