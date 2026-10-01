package broadcast

import (
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
)

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
type Hub struct {
	mu        sync.RWMutex
	states    map[string]*BroadcastState
	producers map[string]map[*Client]bool
	viewers   map[string]map[*Client]bool
}

// NewHub initializes an in-memory broadcast hub.
func NewHub() *Hub {
	return &Hub{
		states:    make(map[string]*BroadcastState),
		producers: make(map[string]map[*Client]bool),
		viewers:   make(map[string]map[*Client]bool),
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
	h.mu.Unlock()

	h.Broadcast(state.MatchID, state)
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

// Broadcast sends the serialized state to all producers and viewers for the given match.
func (h *Hub) Broadcast(matchID string, state *BroadcastState) {
	data, err := json.Marshal(state)
	if err != nil {
		log.Printf("[BroadcastHub] marshal error: %v", err)
		return
	}

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
