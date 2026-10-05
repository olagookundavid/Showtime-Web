package broadcast

import (
	"context"
	"encoding/json"
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
// when nothing is stored for the match.
type Store interface {
	Load(ctx context.Context, matchID string) ([]byte, error)
	Save(ctx context.Context, matchID string, state []byte) error
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
}

// Hub maintains the set of active clients and handles broadcasting state updates.
// State lives in memory for fan-out; when a Store is set it is written behind
// asynchronously and read back on a cache miss.
type Hub struct {
	mu        sync.RWMutex
	states    map[string]*BroadcastState
	producers map[string]map[*Client]bool
	viewers   map[string]map[*Client]bool

	store     Store
	pendMu    sync.Mutex
	pending   map[string][]byte // latest unsaved state per match
	wake      chan struct{}
	stop      chan struct{}
	stopped   chan struct{}
	closeOnce sync.Once
}

// NewHub initializes a broadcast hub. store may be nil for a memory-only hub.
func NewHub(store Store) *Hub {
	h := &Hub{
		states:    make(map[string]*BroadcastState),
		producers: make(map[string]map[*Client]bool),
		viewers:   make(map[string]map[*Client]bool),
		store:     store,
		pending:   make(map[string][]byte),
		wake:      make(chan struct{}, 1),
		stop:      make(chan struct{}),
		stopped:   make(chan struct{}),
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

// Register registers a client with the hub.
func (h *Hub) Register(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if c.IsProducer {
		if _, ok := h.producers[c.MatchID]; !ok {
			h.producers[c.MatchID] = make(map[*Client]bool)
		}
		h.producers[c.MatchID][c] = true
	} else {
		if _, ok := h.viewers[c.MatchID]; !ok {
			h.viewers[c.MatchID] = make(map[*Client]bool)
		}
		h.viewers[c.MatchID][c] = true
	}

	// Send current state to newly connected client immediately if present
	if state, ok := h.states[c.MatchID]; ok {
		if data, err := json.Marshal(state); err == nil {
			select {
			case c.Send <- data:
			default:
			}
		}
	}
}

// Unregister removes a client from the hub.
func (h *Hub) Unregister(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if c.IsProducer {
		if clients, ok := h.producers[c.MatchID]; ok {
			if _, exists := clients[c]; exists {
				delete(clients, c)
				close(c.Send)
				if len(clients) == 0 {
					delete(h.producers, c.MatchID)
				}
			}
		}
	} else {
		if clients, ok := h.viewers[c.MatchID]; ok {
			if _, exists := clients[c]; exists {
				delete(clients, c)
				close(c.Send)
				if len(clients) == 0 {
					delete(h.viewers, c.MatchID)
				}
			}
		}
	}
}

// broadcastData sends the serialized state to all producers and viewers for the given match.
func (h *Hub) broadcastData(matchID string, data []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	// Send to producers
	if clients, ok := h.producers[matchID]; ok {
		for c := range clients {
			select {
			case c.Send <- data:
			default:
				go h.Unregister(c)
			}
		}
	}

	// Send to viewers (vMix overlays)
	if clients, ok := h.viewers[matchID]; ok {
		for c := range clients {
			select {
			case c.Send <- data:
			default:
				go h.Unregister(c)
			}
		}
	}
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
				c.Hub.SetState(&state)
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
