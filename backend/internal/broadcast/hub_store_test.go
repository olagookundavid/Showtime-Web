package broadcast

import (
	"context"
	"sync"
	"testing"
	"time"
)

type memStore struct {
	mu    sync.Mutex
	data  map[string][]byte
	saves int
}

func newMemStore() *memStore { return &memStore{data: make(map[string][]byte)} }

func (s *memStore) Load(_ context.Context, matchID string) ([]byte, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.data[matchID], nil
}

func (s *memStore) Save(_ context.Context, matchID string, state []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data[matchID] = state
	s.saves++
	return nil
}

func closeHub(t *testing.T, h *Hub) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	h.Close(ctx)
}

func TestHub_RestoresStateAfterRestart(t *testing.T) {
	store := newMemStore()
	matchID := "persisted-match"

	first := NewHub(store)
	first.SetState(&BroadcastState{
		MatchID:    matchID,
		Home:       "Delta Braves",
		ManualHome: 21,
		ManualAway: 14,
		Period:     "H2",
		GraphicID:  7,
		Graphic:    &GraphicEvent{Type: "TOUCHDOWN"},
	})
	closeHub(t, first) // flushes pending writes

	second := NewHub(store)
	defer closeHub(t, second)

	restored, ok := second.LoadState(context.Background(), matchID)
	if !ok {
		t.Fatalf("expected state to be restored from the store")
	}
	if restored.ManualHome != 21 || restored.ManualAway != 14 || restored.Period != "H2" {
		t.Errorf("unexpected restored state: %+v", restored)
	}
	if restored.Graphic != nil {
		t.Errorf("expected restored graphic to be cleared, got %+v", restored.Graphic)
	}
	if restored.GraphicID != 7 {
		t.Errorf("expected graphic id to be kept, got %d", restored.GraphicID)
	}
}

func TestHub_CoalescesBurstIntoOneWrite(t *testing.T) {
	store := newMemStore()
	hub := NewHub(store)

	for i := 0; i < 50; i++ {
		hub.SetState(&BroadcastState{MatchID: "burst", ManualHome: i})
	}
	closeHub(t, hub)

	store.mu.Lock()
	saves := store.saves
	store.mu.Unlock()
	if saves < 1 || saves > 2 {
		t.Errorf("expected the burst to coalesce into 1-2 writes, got %d", saves)
	}

	restored, ok := NewHub(store).LoadState(context.Background(), "burst")
	if !ok || restored.ManualHome != 49 {
		t.Errorf("expected the latest state to be stored, got %+v", restored)
	}
}

func TestHub_LoadStateMissing(t *testing.T) {
	hub := NewHub(newMemStore())
	defer closeHub(t, hub)

	if _, ok := hub.LoadState(context.Background(), "unknown"); ok {
		t.Errorf("expected no state for an unknown match")
	}
}
