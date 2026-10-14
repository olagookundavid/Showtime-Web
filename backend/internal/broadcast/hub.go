package broadcast

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 65536

	// persistDebounce coalesces bursts of updates (e.g. rapid score taps) into
	// one write per match. Live fan-out never waits on it.
	persistDebounce = 250 * time.Millisecond
	persistTimeout  = 5 * time.Second
)

// Store persists broadcast state so it survives a restart. Load returns nil
// when nothing is stored for the match; LoadDayOnAir returns "" when a day has
// no match on air.
type Store interface {
	Load(ctx context.Context, matchID string) ([]byte, error)
	Save(ctx context.Context, matchID string, state []byte) error
	LoadDayOnAir(ctx context.Context, day string) (string, error)
	SaveDayOnAir(ctx context.Context, day, matchID string) error
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  2048,
	WriteBufferSize: 2048,
	CheckOrigin: func(r *http.Request) bool {
		// Allow connections from vMix Web Browser input, local networks, and production web app.
		return true
	},
}

// Client represents a connected WebSocket (either producer controller or viewer overlay).
type Client struct {
	Hub        *Hub
	Conn       *websocket.Conn
	Send       chan []byte
	MatchID    string
	IsProducer bool
	// Day is set for an event-day overlay, which follows whichever match is on
	// air that day instead of a fixed MatchID.
	Day string
}

// Hub maintains the set of active clients and handles broadcasting state updates.
// State lives in memory for fan-out; when a Store is set it is written behind
// asynchronously and read back on a cache miss.
type Hub struct {
	mu        sync.RWMutex
	states    map[string]*BroadcastState
	producers map[string]map[*Client]bool
	viewers   map[string]map[*Client]bool

	// Event-day channels: one overlay link per match day showing whichever
	// match is on air. dayLoaded marks days whose saved choice has been read.
	dayOnAir   map[string]string
	dayLoaded  map[string]bool
	dayViewers map[string]map[*Client]bool

	store     Store
	pendMu    sync.Mutex
	pending   map[string][]byte // latest unsaved state per match
	wake      chan struct{}
	stop      chan struct{}
	stopped   chan struct{}
	closeOnce sync.Once

	// OnScoreChange, when set, is called after a producer-originated update
	// (see ApplyProducerUpdate) whose manual score differs from what was there
	// before. It is not invoked for bootstrap or event-day on-air switches.
	OnScoreChange func(matchID string, home, away int)
}

// NewHub initializes a broadcast hub. store may be nil for a memory-only hub.
func NewHub(store Store) *Hub {
	h := &Hub{
		states:     make(map[string]*BroadcastState),
		producers:  make(map[string]map[*Client]bool),
		viewers:    make(map[string]map[*Client]bool),
		dayOnAir:   make(map[string]string),
		dayLoaded:  make(map[string]bool),
		dayViewers: make(map[string]map[*Client]bool),
		store:      store,
		pending:    make(map[string][]byte),
		wake:       make(chan struct{}, 1),
		stop:       make(chan struct{}),
		stopped:    make(chan struct{}),
	}
	if store != nil {
		go h.persistLoop()
	} else {
		close(h.stopped)
	}
	return h
}

// LoadState returns the in-memory state, falling back to the store. A restored
// state has its graphic cleared so a stale lower-third doesn't replay on air.
func (h *Hub) LoadState(ctx context.Context, matchID string) (*BroadcastState, bool) {
	if state, ok := h.GetState(matchID); ok {
		return state, true
	}
	if h.store == nil {
		return nil, false
	}

	data, err := h.store.Load(ctx, matchID)
	if err != nil {
		log.Printf("[BroadcastHub] load error for match %s: %v", matchID, err)
		return nil, false
	}
	if data == nil {
		return nil, false
	}
	var state BroadcastState
	if err := json.Unmarshal(data, &state); err != nil {
		log.Printf("[BroadcastHub] corrupt stored state for match %s: %v", matchID, err)
		return nil, false
	}
	state.MatchID = matchID
	state.Graphic = nil

	h.mu.Lock()
	defer h.mu.Unlock()
	// Another request may have loaded or set it while we were reading.
	if existing, ok := h.states[matchID]; ok {
		cp := *existing
		return &cp, true
	}
	h.states[matchID] = &state
	cp := state
	return &cp, true
}

// Close flushes unsaved state to the store and stops the persister.
func (h *Hub) Close(ctx context.Context) {
	h.closeOnce.Do(func() {
		if h.store != nil {
			close(h.stop)
		}
	})
	select {
	case <-h.stopped:
	case <-ctx.Done():
		log.Printf("[BroadcastHub] close timed out before flushing state")
	}
}

func (h *Hub) persistLoop() {
	defer close(h.stopped)
	for {
		select {
		case <-h.wake:
		case <-h.stop:
			h.flush()
			return
		}
		select {
		case <-time.After(persistDebounce):
		case <-h.stop:
			h.flush()
			return
		}
		h.flush()
	}
}

func (h *Hub) flush() {
	h.pendMu.Lock()
	batch := h.pending
	h.pending = make(map[string][]byte)
	h.pendMu.Unlock()

	for matchID, data := range batch {
		ctx, cancel := context.WithTimeout(context.Background(), persistTimeout)
		if err := h.store.Save(ctx, matchID, data); err != nil {
			log.Printf("[BroadcastHub] save error for match %s: %v", matchID, err)
		}
		cancel()
	}
}

// GetState retrieves the in-memory state for a match.
func (h *Hub) GetState(matchID string) (*BroadcastState, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	state, exists := h.states[matchID]
	if !exists {
		return nil, false
	}
	// Return a copy
	cp := *state
	return &cp, true
}

// SetState updates the state and broadcasts to all clients.
func (h *Hub) SetState(state *BroadcastState) {
	h.mu.Lock()
	state.UpdatedAt = time.Now().UnixMilli()
	cp := *state
	h.states[state.MatchID] = &cp
	data, err := json.Marshal(&cp)
	if err == nil && h.store != nil {
		// Queued under h.mu so the stored order matches the in-memory order.
		h.pendMu.Lock()
		h.pending[cp.MatchID] = data
		h.pendMu.Unlock()
		select {
		case h.wake <- struct{}{}:
		default:
		}
	}
	h.mu.Unlock()

	if err != nil {
		log.Printf("[BroadcastHub] marshal error: %v", err)
		return
	}
	h.broadcastData(cp.MatchID, data)
}

// ApplyProducerUpdate applies a producer-originated state update (from the
// producer WebSocket or the REST fallback) and, when the manual score
// differs from what was there before, notifies OnScoreChange so it can be
// synced to the match record elsewhere. Internal callers (bootstrap,
// event-day on-air switches) should keep calling SetState directly so they
// don't re-trigger that sync.
func (h *Hub) ApplyProducerUpdate(state *BroadcastState) {
	h.mu.RLock()
	prev, hadPrev := h.states[state.MatchID]
	h.mu.RUnlock()

	h.SetState(state)

	if h.OnScoreChange != nil && (!hadPrev || prev.ManualHome != state.ManualHome || prev.ManualAway != state.ManualAway) {
		h.OnScoreChange(state.MatchID, state.ManualHome, state.ManualAway)
	}
}

// clientGroups returns the set a client belongs in: producers or viewers keyed
// by match, or event-day viewers keyed by date. Caller holds h.mu.
func (h *Hub) clientGroups(c *Client) (map[string]map[*Client]bool, string) {
	switch {
	case c.Day != "":
		return h.dayViewers, c.Day
	case c.IsProducer:
		return h.producers, c.MatchID
	default:
		return h.viewers, c.MatchID
	}
}

// Register registers a client with the hub and sends it the current state.
func (h *Hub) Register(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	groups, key := h.clientGroups(c)
	if _, ok := groups[key]; !ok {
		groups[key] = make(map[*Client]bool)
	}
	groups[key][c] = true

	matchID := c.MatchID
	if c.Day != "" {
		matchID = h.dayOnAir[c.Day]
		if matchID == "" {
			trySend(c, offAirMessage)
			return
		}
	}
	if state, ok := h.states[matchID]; ok {
		if data, err := json.Marshal(state); err == nil {
			trySend(c, data)
		}
	}
}

// Unregister removes a client from the hub.
func (h *Hub) Unregister(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	groups, key := h.clientGroups(c)
	if clients, ok := groups[key]; ok {
		if _, exists := clients[c]; exists {
			delete(clients, c)
			close(c.Send)
			if len(clients) == 0 {
				delete(groups, key)
			}
		}
	}
}

func trySend(c *Client, data []byte) {
	select {
	case c.Send <- data:
	default:
	}
}

// sendAll queues data for every client in the set, dropping any whose buffer
// is full (a stalled connection). Caller holds h.mu for reading.
func (h *Hub) sendAll(clients map[*Client]bool, data []byte) {
	for c := range clients {
		select {
		case c.Send <- data:
		default:
			go h.Unregister(c)
		}
	}
}

// broadcastData sends a match's serialized state to its producers and viewers,
// and to every event day that has the match on air.
func (h *Hub) broadcastData(matchID string, data []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	h.sendAll(h.producers[matchID], data)
	h.sendAll(h.viewers[matchID], data)
	for day, onAir := range h.dayOnAir {
		if onAir == matchID {
			h.sendAll(h.dayViewers[day], data)
		}
	}
}

// offAirMessage tells an event-day overlay that no match is on air, so it
// shows nothing.
var offAirMessage = []byte("null")

// DayOnAir returns the match an event day's overlay shows ("" for none),
// loading the saved choice the first time the day is asked about.
func (h *Hub) DayOnAir(ctx context.Context, day string) (string, error) {
	h.mu.RLock()
	loaded := h.dayLoaded[day]
	matchID := h.dayOnAir[day]
	h.mu.RUnlock()
	if loaded || h.store == nil {
		return matchID, nil
	}

	stored, err := h.store.LoadDayOnAir(ctx, day)
	if err != nil {
		return "", err
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	if !h.dayLoaded[day] {
		h.dayLoaded[day] = true
		h.dayOnAir[day] = stored
	}
	return h.dayOnAir[day], nil
}

// SetDayOnAir switches an event day's overlay to matchID ("" takes it off air).
// The match's state must already be loaded. Its lower-third is cleared so a
// graphic fired earlier doesn't replay as the match comes on air.
func (h *Hub) SetDayOnAir(ctx context.Context, day, matchID string) error {
	if matchID != "" {
		if _, ok := h.GetState(matchID); !ok {
			return fmt.Errorf("broadcast state for match %s is not loaded", matchID)
		}
	}
	if h.store != nil {
		if err := h.store.SaveDayOnAir(ctx, day, matchID); err != nil {
			return err
		}
	}

	h.mu.Lock()
	h.dayLoaded[day] = true
	h.dayOnAir[day] = matchID
	h.mu.Unlock()

	if matchID == "" {
		h.mu.RLock()
		h.sendAll(h.dayViewers[day], offAirMessage)
		h.mu.RUnlock()
		return nil
	}

	state, ok := h.GetState(matchID)
	if !ok {
		return fmt.Errorf("broadcast state for match %s is not loaded", matchID)
	}
	state.Graphic = nil
	h.SetState(state) // fans out to the day's overlays too
	return nil
}

// ReadPump listens for incoming messages from the client.
func (c *Client) ReadPump() {
	defer func() {
		c.Hub.Unregister(c)
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("[BroadcastClient] read error: %v", err)
			}
			break
		}

		// Only producers can update state
		if c.IsProducer {
			var state BroadcastState
			if err := json.Unmarshal(message, &state); err == nil {
				state.MatchID = c.MatchID
				c.Hub.ApplyProducerUpdate(&state)
			} else {
				log.Printf("[BroadcastClient] unmarshal error: %v", err)
			}
		}
	}
}

// WritePump pumps messages from the hub to the websocket connection.
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// The hub closed the channel.
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Add queued messages to the current websocket message to avoid write lock overhead.
			n := len(c.Send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.Send)
			}

			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
