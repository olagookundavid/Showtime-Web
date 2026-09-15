package services

import (
	"context"
	"strings"
	"testing"

	"showtime-backend/internal/domain"
)

func TestPlayerAllrounderAndSecondaryRole(t *testing.T) {
	ctx := context.Background()

	repo := &mockPlayerRepo{
		mainCount: 5,
		players: map[string]*domain.Player{
			"ar-1": {ID: "ar-1", Name: "AR One", TeamID: "team-all", Position: "Allrounder"},
			"ar-2": {ID: "ar-2", Name: "AR Two", TeamID: "team-all", Position: "QB", SecondaryPosition: strPtr("Allrounder")},
			"ar-3": {ID: "ar-3", Name: "AR Three", TeamID: "team-all", Position: "Allrounder"},
			"ar-4": {ID: "ar-4", Name: "AR Four", TeamID: "team-all", Position: "Rusher", SecondaryPosition: strPtr("All-Rounder")},
			"ar-5": {ID: "ar-5", Name: "AR Five", TeamID: "team-all", Position: "Allrounder"},
		},
		reserves: make(map[string]bool),
	}
	svc := NewPlayerService(repo, nil)

	t.Run("Secondary role cannot be identical to main role on creation", func(t *testing.T) {
		p := &domain.Player{
			ID:                "p-dup",
			Name:              "Duplicate Role",
			TeamID:            "team-all",
			Position:          "QB",
			SecondaryPosition: strPtr("QB"),
		}
		err := svc.CreatePlayer(ctx, p)
		if err == nil {
			t.Fatalf("expected error when secondary role equals main role, got nil")
		}
		if !strings.Contains(err.Error(), "identical") {
			t.Errorf("expected 'identical' error, got %v", err)
		}
	})

	t.Run("Creating 6th Allrounder succeeds", func(t *testing.T) {
		p := &domain.Player{
			ID:                "ar-6",
			Name:              "AR Six",
			TeamID:            "team-all",
			Position:          "Allrounder",
			SecondaryPosition: strPtr("Defender"),
		}
		err := svc.CreatePlayer(ctx, p)
		if err != nil {
			t.Fatalf("expected success creating 6th Allrounder, got %v", err)
		}
	})

	t.Run("Creating 7th Allrounder is rejected by 6-cap", func(t *testing.T) {
		p := &domain.Player{
			ID:                "ar-7",
			Name:              "AR Seven",
			TeamID:            "team-all",
			Position:          "Allrounder",
		}
		err := svc.CreatePlayer(ctx, p)
		if err == nil {
			t.Fatalf("expected error creating 7th Allrounder, got nil")
		}
		if !strings.Contains(err.Error(), "max 6") {
			t.Errorf("expected 'max 6' error, got %v", err)
		}
	})

	// This case used to assert the 6-cap caught an All-Rounder arriving as a
	// secondary role. All-Rounder is now a main role only, so the request is
	// refused before the cap is ever consulted — a narrower rule rejecting it
	// sooner, not a weaker one.
	t.Run("Allrounder is refused as a secondary role", func(t *testing.T) {
		p := &domain.Player{
			ID:                "ar-7-sec",
			Name:              "AR Seven Sec",
			TeamID:            "team-all",
			Position:          "Receiver",
			SecondaryPosition: strPtr("Allrounder"),
		}
		err := svc.CreatePlayer(ctx, p)
		if err == nil {
			t.Fatalf("expected error setting Allrounder as a secondary role, got nil")
		}
		if !strings.Contains(err.Error(), "main role only") {
			t.Errorf("expected 'main role only' error, got %v", err)
		}
	})

	t.Run("Allrounder is refused as a secondary role on update too", func(t *testing.T) {
		p := &domain.Player{
			ID:                "ar-1",
			Name:              "AR One",
			TeamID:            "team-all",
			Position:          "Receiver",
			SecondaryPosition: strPtr("All-Rounder"),
		}
		err := svc.UpdatePlayer(ctx, p)
		if err == nil {
			t.Fatalf("expected error setting Allrounder as a secondary role on update, got nil")
		}
		if !strings.Contains(err.Error(), "main role only") {
			t.Errorf("expected 'main role only' error, got %v", err)
		}
	})

	t.Run("Updating an existing Allrounder without changing role succeeds", func(t *testing.T) {
		p := &domain.Player{
			ID:       "ar-1",
			Name:     "AR One Renamed",
			TeamID:   "team-all",
			Position: "Allrounder",
		}
		err := svc.UpdatePlayer(ctx, p)
		if err != nil {
			t.Fatalf("expected updating existing Allrounder to succeed, got %v", err)
		}
	})
}

func strPtr(s string) *string {
	return &s
}
