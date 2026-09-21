package services

import (
	"context"
	"testing"
	"time"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

func TestTeamLineupPrivacyAndInspection(t *testing.T) {
	now := time.Now()
	schedGW := &domain.FantasyGameweek{
		ID:       "gw-sched",
		SeasonID: "season-1",
		Number:   1,
		Status:   domain.GameweekScheduled,
		Deadline: now.Add(24 * time.Hour),
	}
	lockedGW := &domain.FantasyGameweek{
		ID:       "gw-locked",
		SeasonID: "season-1",
		Number:   2,
		Status:   domain.GameweekLocked,
		Deadline: now.Add(-1 * time.Hour),
	}

	team := &domain.FantasyTeam{
		ID:          "team-1",
		UserID:      "user-owner",
		SeasonID:    "season-1",
		Name:        "Owner Squad",
		ManagerName: "Owner Name",
	}

	lineup := &domain.FantasyLineup{
		ID:         "lineup-1",
		TeamID:     "team-1",
		GameweekID: "gw-locked",
		TotalSpent: 90.0,
		Points:     75.5,
		Status:     domain.LineupLocked,
		Picks: []domain.FantasyLineupPick{
			{
				Slot:          domain.FantasySlot("QB_M"),
				PlayerID:      "p-1",
				PurchasePrice: 10.0,
				Points:        20.0,
				Player: &domain.Player{
					ID:       "p-1",
					Name:     "Top QB",
					Position: "QB",
					Gender:   "M",
					Team:     &domain.Team{Name: "Lagos Thunder", ShortName: "THU"},
				},
			},
		},
	}

	repo := newFakeRepo()
	repo.gameweeks["gw-sched"] = schedGW
	repo.gameweeks["gw-locked"] = lockedGW
	repo.enteredTeam = team
	repo.lineups[lineupKey("team-1", "gw-sched")] = lineup
	repo.lineups[lineupKey("team-1", "gw-locked")] = lineup

	svc := NewFantasyService(repo, nil, nil, nil, nil)
	ctx := context.Background()

	t.Run("scheduled gameweek reveals picks for rival managers anytime", func(t *testing.T) {
		res, err := svc.GetTeamLineup(ctx, "rival-user", "team-1", "gw-sched")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if res.IsPrivate {
			t.Errorf("expected IsPrivate to be false for rival in scheduled GW")
		}
		if len(res.Picks) != 1 {
			t.Errorf("expected 1 pick returned for rival, got %d", len(res.Picks))
		}
		if res.ManagerName != "Owner Name" {
			t.Errorf("expected ManagerName 'Owner Name', got '%s'", res.ManagerName)
		}
	})

	t.Run("scheduled gameweek permits owner to view their own picks", func(t *testing.T) {
		res, err := svc.GetTeamLineup(ctx, "user-owner", "team-1", "gw-sched")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if res.IsPrivate {
			t.Errorf("expected IsPrivate to be false for owner")
		}
	})

	t.Run("locked gameweek reveals picks to everyone", func(t *testing.T) {
		res, err := svc.GetTeamLineup(ctx, "rival-user", "team-1", "gw-locked")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if res.IsPrivate {
			t.Errorf("expected IsPrivate to be false for locked gameweek")
		}
		if len(res.Picks) != 1 {
			t.Fatalf("expected 1 pick returned, got %d", len(res.Picks))
		}
		if res.Picks[0].PlayerName != "Top QB" {
			t.Errorf("expected pick name 'Top QB', got '%s'", res.Picks[0].PlayerName)
		}
		if res.Points != 75.5 {
			t.Errorf("expected Points 75.5, got %v", res.Points)
		}
	})
}

func TestGameweekReportService(t *testing.T) {
	repo := &fakeFantasyRepo{}
	svc := NewFantasyService(repo, nil, nil, nil, nil)
	ctx := context.Background()

	report, err := svc.GetGameweekReport(ctx, "season-1", "gw-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if report.GameweekNumber != 1 {
		t.Errorf("expected GW number 1, got %d", report.GameweekNumber)
	}
	if report.Summary.AveragePoints != 50.0 {
		t.Errorf("expected avg points 50.0, got %v", report.Summary.AveragePoints)
	}
}

func TestDreamTeamBuilder(t *testing.T) {
	scorers := []dto.TopScoringPlayerItem{
		{PlayerID: "p-qbm", Position: "QB", Gender: "M", TeamID: "c1", Points: 30},
		{PlayerID: "p-qbf", Position: "QB", Gender: "F", TeamID: "c2", Points: 28},
		{PlayerID: "p-rec1", Position: "Receiver", Gender: "F", TeamID: "c1", Points: 25},
		{PlayerID: "p-rec2", Position: "Receiver", Gender: "F", TeamID: "c2", Points: 24},
		{PlayerID: "p-rec3", Position: "Receiver", Gender: "M", TeamID: "c3", Points: 22},
		{PlayerID: "p-rec4", Position: "Receiver", Gender: "M", TeamID: "c4", Points: 20},
		{PlayerID: "p-rec5", Position: "Center", Gender: "M", TeamID: "c5", Points: 18},
		{PlayerID: "p-rush", Position: "Rusher", Gender: "M", TeamID: "c1", Points: 26},
		{PlayerID: "p-def1", Position: "Defender", Gender: "F", TeamID: "c2", Points: 21},
		{PlayerID: "p-def2", Position: "Defender", Gender: "F", TeamID: "c3", Points: 19},
		{PlayerID: "p-def3", Position: "Defender", Gender: "F", TeamID: "c4", Points: 17},
		{PlayerID: "p-def4", Position: "Defender", Gender: "M", TeamID: "c5", Points: 16},
		{PlayerID: "p-def5", Position: "Defender", Gender: "M", TeamID: "c6", Points: 15},
		{PlayerID: "p-def6", Position: "Defender", Gender: "M", TeamID: "c6", Points: 14},
	}

	picks, total := ports.BuildDreamTeamForTest(scorers)
	if len(picks) != 14 {
		t.Fatalf("expected 14 dream team picks, got %d", len(picks))
	}
	if total <= 0 {
		t.Errorf("expected positive total points, got %v", total)
	}
}

func TestDreamTeamBuilder_WithSynonymsAndFallback(t *testing.T) {
	// Simulates real-world scenario where:
	// - No female QB exists; QB_F is filled by a female Receiver/Center
	// - Position synonyms like 'DEF', 'WR', 'RUSH' are used
	// - Many defenders have low scores (1.0 - 3.0 pts)
	scorers := []dto.TopScoringPlayerItem{
		{PlayerID: "p-qbm", Position: "Quarterback", Gender: "M", TeamID: "c1", Points: 30},
		// No female QB: female WRs will fill QB_F + REC slots
		{PlayerID: "p-wrf1", Position: "WR", Gender: "F", TeamID: "c2", Points: 28},
		{PlayerID: "p-wrf2", Position: "Receiver", Gender: "F", TeamID: "c3", Points: 25},
		{PlayerID: "p-wrf3", Position: "Center", Gender: "F", TeamID: "c4", Points: 24},
		{PlayerID: "p-wrm1", Position: "WR", Gender: "M", TeamID: "c1", Points: 22},
		{PlayerID: "p-wrm2", Position: "Receiver", Gender: "M", TeamID: "c2", Points: 20},
		{PlayerID: "p-wrm3", Position: "WR", Gender: "M", TeamID: "c3", Points: 18},
		{PlayerID: "p-rush", Position: "RUSH", Gender: "M", TeamID: "c5", Points: 15},
		// Low-scoring defenders:
		{PlayerID: "p-deff1", Position: "DEF", Gender: "F", TeamID: "c4", Points: 3.5},
		{PlayerID: "p-deff2", Position: "DB", Gender: "F", TeamID: "c5", Points: 3.0},
		{PlayerID: "p-deff3", Position: "Safety", Gender: "F", TeamID: "c6", Points: 2.5},
		{PlayerID: "p-defm1", Position: "CB", Gender: "M", TeamID: "c7", Points: 2.0},
		{PlayerID: "p-defm2", Position: "DEF", Gender: "M", TeamID: "c8", Points: 1.5},
		{PlayerID: "p-defm3", Position: "Defender", Gender: "M", TeamID: "c9", Points: 1.0},
	}

	picks, total := ports.BuildDreamTeamForTest(scorers)
	if len(picks) != 14 {
		t.Fatalf("expected 14 dream team picks, got %d", len(picks))
	}
	if total <= 0 {
		t.Errorf("expected positive total points, got %v", total)
	}

	// Verify all 14 required slots are present
	slotsFound := make(map[string]bool)
	for _, pk := range picks {
		slotsFound[pk.Slot] = true
	}
	requiredSlots := []string{
		"QB_M", "QB_F", "REC_1", "REC_2", "REC_3", "REC_4", "REC_5",
		"RUSHER", "DEF_1", "DEF_2", "DEF_3", "DEF_4", "DEF_5", "DEF_6",
	}
	for _, req := range requiredSlots {
		if !slotsFound[req] {
			t.Errorf("missing expected slot: %s", req)
		}
	}
}

