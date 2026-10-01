package broadcast

import (
	"sync"
	"testing"
	"time"
)

func TestHub_StateManagement(t *testing.T) {
	hub := NewHub()

	matchID := "test-match-1"

	// Initially non-existent
	if _, ok := hub.GetState(matchID); ok {
		t.Fatalf("expected state not to exist initially")
	}

	state := &BroadcastState{
		MatchID:      matchID,
		Home:         "Delta Braves",
		Away:         "Lagos Knights",
		ManualHome:   14,
		ManualAway:   7,
		Period:       "H1",
		ClockSeconds: 380,
		ClockRunning: true,
		ClockStamp:   time.Now().UnixMilli(),
		Down:         "3",
		Possession:   "Delta Braves",
		TimeoutsHome: 2,
		TimeoutsAway: 3,
		ScoreBug:     true,
	}

	hub.SetState(state)

	retrieved, ok := hub.GetState(matchID)
	if !ok {
		t.Fatalf("expected state to exist after SetState")
	}

	if retrieved.Home != "Delta Braves" || retrieved.Away != "Lagos Knights" {
		t.Errorf("unexpected teams: got %s vs %s", retrieved.Home, retrieved.Away)
	}

	if retrieved.ManualHome != 14 || retrieved.ManualAway != 7 {
		t.Errorf("unexpected scores: got %d vs %d", retrieved.ManualHome, retrieved.ManualAway)
	}
}

func TestHub_Concurrency(t *testing.T) {
	hub := NewHub()
	matchID := "concurrent-match"

	initial := &BroadcastState{
		MatchID:      matchID,
		Home:         "Home",
		Away:         "Away",
		ManualHome:   0,
		ManualAway:   0,
		ClockSeconds: 720,
	}
	hub.SetState(initial)

	var wg sync.WaitGroup
	// 20 concurrent updaters
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(score int) {
			defer wg.Done()
			s, ok := hub.GetState(matchID)
			if ok {
				s.ManualHome = score
				hub.SetState(s)
			}
		}(i)
	}

	// 20 concurrent readers
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			hub.GetState(matchID)
		}()
	}

	wg.Wait()

	finalState, ok := hub.GetState(matchID)
	if !ok {
		t.Fatalf("expected final state to exist")
	}
	if finalState.MatchID != matchID {
		t.Errorf("match ID corrupted: %s", finalState.MatchID)
	}
}
