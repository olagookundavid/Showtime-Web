package services

import (
	"encoding/json"
	"fmt"
	"sync"
)

type SSEBroker struct {
	mu        sync.RWMutex
	listeners map[string]map[chan string]bool // matchID -> client channels
}

var GlobalSSEBroker = NewSSEBroker()

func NewSSEBroker() *SSEBroker {
	return &SSEBroker{
		listeners: make(map[string]map[chan string]bool),
	}
}

func (b *SSEBroker) Subscribe(matchID string) chan string {
	b.mu.Lock()
	defer b.mu.Unlock()
	ch := make(chan string, 10)
	if b.listeners[matchID] == nil {
		b.listeners[matchID] = make(map[chan string]bool)
	}
	b.listeners[matchID][ch] = true
	return ch
}

func (b *SSEBroker) Unsubscribe(matchID string, ch chan string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if clients, ok := b.listeners[matchID]; ok {
		if _, exists := clients[ch]; exists {
			delete(clients, ch)
			close(ch)
		}
		if len(clients) == 0 {
			delete(b.listeners, matchID)
		}
	}
}

func (b *SSEBroker) Broadcast(matchID string, eventName string, data interface{}) {
	b.mu.RLock()
	defer b.mu.RUnlock()

	clients, ok := b.listeners[matchID]
	if !ok || len(clients) == 0 {
		return
	}

	payload, err := json.Marshal(data)
	if err != nil {
		return
	}

	msg := fmt.Sprintf("event: %s\ndata: %s\n\n", eventName, string(payload))

	for ch := range clients {
		select {
		case ch <- msg:
		default:
			// Channel buffer full, skip to prevent blocking slow clients
		}
	}
}
