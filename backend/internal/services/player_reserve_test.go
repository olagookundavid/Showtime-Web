package services

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"showtime-backend/internal/domain"
	"showtime-backend/internal/dto"
)

type mockPlayerRepo struct {
	mainCount    int
	reserveCount int
	reserves     map[string]bool
	players      map[string]*domain.Player
}

func (m *mockPlayerRepo) GetPlayers(ctx context.Context, teamID string, search string, page, limit int, rosterStatus string) ([]domain.Player, int64, error) {
	var result []domain.Player
	for _, p := range m.players {
		if teamID != "" && p.TeamID != teamID {
			continue
		}
		isRes := m.reserves[p.ID]
		if rosterStatus == "reserve" && !isRes {
			continue
		}
		if (rosterStatus == "main" || rosterStatus == "") && isRes {
			continue
		}
		cp := *p
		cp.IsReserve = isRes
		result = append(result, cp)
	}
	return result, int64(len(result)), nil
}

func (m *mockPlayerRepo) GetPlayerByID(ctx context.Context, id string) (*domain.Player, error) {
	p, ok := m.players[id]
	if !ok {
		return nil, fmt.Errorf("player not found")
	}
	cp := *p
	cp.IsReserve = m.reserves[id]
	return &cp, nil
}

func (m *mockPlayerRepo) CreatePlayer(ctx context.Context, player *domain.Player) error {
	m.players[player.ID] = player
	m.mainCount++
	return nil
}

func (m *mockPlayerRepo) UpdatePlayer(ctx context.Context, player *domain.Player) error {
	m.players[player.ID] = player
	return nil
}

func (m *mockPlayerRepo) DeletePlayer(ctx context.Context, id string) error {
	delete(m.players, id)
	return nil
}

func (m *mockPlayerRepo) RestorePlayer(ctx context.Context, id string) error {
	return nil
}

func (m *mockPlayerRepo) AssignRandomJerseyNumbers(ctx context.Context, teamID string) (int, error) {
	return 0, nil
}

func (m *mockPlayerRepo) GetPlayerByUserID(ctx context.Context, userID string) (*domain.Player, error) {
	return nil, nil
}

func (m *mockPlayerRepo) UpdatePlayerUserID(ctx context.Context, playerID string, userID *string) error {
	return nil
}

func (m *mockPlayerRepo) HasPlayerWithEmail(ctx context.Context, email string) (bool, error) {
	return false, nil
}

func (m *mockPlayerRepo) MovePlayerToReserve(ctx context.Context, teamID, playerID string) error {
	p, ok := m.players[playerID]
	if !ok || p.TeamID != teamID {
		return fmt.Errorf("player not found on team")
	}
	if !m.reserves[playerID] {
		m.reserves[playerID] = true
		m.reserveCount++
		m.mainCount--
	}
	return nil
}

func (m *mockPlayerRepo) GraduatePlayerFromReserve(ctx context.Context, teamID, playerID string) error {
	if !m.reserves[playerID] {
		return fmt.Errorf("player is not in reserves")
	}
	if m.mainCount >= 25 {
		return fmt.Errorf("cannot graduate player: main squad is at maximum capacity (%d/25 players)", m.mainCount)
	}
	delete(m.reserves, playerID)
	m.reserveCount--
	m.mainCount++
	return nil
}

func (m *mockPlayerRepo) GetMainPlayerCount(ctx context.Context, teamID string) (int, error) {
	return m.mainCount, nil
}

func (m *mockPlayerRepo) GetReservePlayerCount(ctx context.Context, teamID string) (int, error) {
	return m.reserveCount, nil
}

func (m *mockPlayerRepo) GetTeamRosterSummary(ctx context.Context, teamID string) (*dto.RosterSummaryResponse, error) {
	return &dto.RosterSummaryResponse{
		MainCount:       m.mainCount,
		ReserveCount:    m.reserveCount,
		MaxMainLimit:    25,
		CanAddOrPromote: m.mainCount < 25,
	}, nil
}

func (m *mockPlayerRepo) RemovePlayerFromReserves(ctx context.Context, playerID string) error {
	if m.reserves[playerID] {
		delete(m.reserves, playerID)
		m.reserveCount--
	}
	return nil
}

func TestPlayerReserveAnd25Cap(t *testing.T) {
	ctx := context.Background()
	repo := &mockPlayerRepo{
		mainCount:    25,
		reserveCount: 2,
		reserves:     map[string]bool{"res-1": true, "res-2": true},
		players: map[string]*domain.Player{
			"res-1": {ID: "res-1", Name: "Reserve One", TeamID: "team-1"},
			"res-2": {ID: "res-2", Name: "Reserve Two", TeamID: "team-1"},
			"main-1": {ID: "main-1", Name: "Main One", TeamID: "team-1"},
		},
	}
	svc := NewPlayerService(repo, nil)

	t.Run("Adding player blocked when main squad is at 25", func(t *testing.T) {
		newP := &domain.Player{ID: "new-p", Name: "Newbie", TeamID: "team-1"}
		err := svc.CreatePlayer(ctx, newP)
		if err == nil {
			t.Fatalf("expected error adding player when team has 25 main players, got nil")
		}
		if !strings.Contains(err.Error(), "max 25") {
			t.Errorf("expected max 25 error message, got %v", err)
		}
	})

	t.Run("Graduating player blocked when main squad is at 25", func(t *testing.T) {
		err := svc.GraduatePlayerFromReserve(ctx, "team-1", "res-1")
		if err == nil {
			t.Fatalf("expected error graduating reserve when main team is full, got nil")
		}
		if !strings.Contains(err.Error(), "capacity") {
			t.Errorf("expected capacity error, got %v", err)
		}
	})

	t.Run("Moving player to reserve frees a main spot", func(t *testing.T) {
		err := svc.MovePlayerToReserve(ctx, "team-1", "main-1")
		if err != nil {
			t.Fatalf("unexpected error moving player to reserve: %v", err)
		}
		summary, err := svc.GetTeamRosterSummary(ctx, "team-1")
		if err != nil {
			t.Fatalf("failed to get roster summary: %v", err)
		}
		if summary.MainCount != 24 {
			t.Errorf("expected 24 main players, got %d", summary.MainCount)
		}
		if summary.ReserveCount != 3 {
			t.Errorf("expected 3 reserve players, got %d", summary.ReserveCount)
		}
		if !summary.CanAddOrPromote {
			t.Errorf("expected CanAddOrPromote to be true")
		}
	})

	t.Run("Graduating succeeds when main squad is below 25", func(t *testing.T) {
		err := svc.GraduatePlayerFromReserve(ctx, "team-1", "res-1")
		if err != nil {
			t.Fatalf("unexpected error graduating player: %v", err)
		}
		summary, _ := svc.GetTeamRosterSummary(ctx, "team-1")
		if summary.MainCount != 25 {
			t.Errorf("expected main count 25 after graduation, got %d", summary.MainCount)
		}
	})
}
