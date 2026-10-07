package broadcast

import (
	"context"
	"encoding/json"
	"testing"
	"time"
)

const testDay = "2026-10-11"

// nextMessage waits for the next message queued for a client.
func nextMessage(t *testing.T, c *Client) []byte {
	t.Helper()
	select {
	case msg := <-c.Send:
		return msg
	case <-time.After(time.Second):
		t.Fatalf("expected a message for the client")
		return nil
	}
}

func expectNoMessage(t *testing.T, c *Client) {
	t.Helper()
	select {
	case msg := <-c.Send:
		t.Fatalf("expected no message, got %s", msg)
	case <-time.After(50 * time.Millisecond):
	}
}

func decodeState(t *testing.T, msg []byte) *BroadcastState {
	t.Helper()
	var s *BroadcastState
	if err := json.Unmarshal(msg, &s); err != nil {
		t.Fatalf("bad message %s: %v", msg, err)
	}
	return s
}

func TestHub_DayOverlayFollowsOnAirMatch(t *testing.T) {
	ctx := context.Background()
	hub := NewHub(newMemStore())
	defer closeHub(t, hub)

	hub.SetState(&BroadcastState{MatchID: "match-a", Home: "Lagos Knights", ManualHome: 7, GraphicID: 3, Graphic: &GraphicEvent{Type: "TOUCHDOWN"}})
	hub.SetState(&BroadcastState{MatchID: "match-b", Home: "Delta Braves"})

	day := &Client{Hub: hub, Send: make(chan []byte, 16), Day: testDay}
	hub.Register(day)
	if msg := nextMessage(t, day); string(msg) != "null" {
		t.Fatalf("a day with nothing on air should get null, got %s", msg)
	}

	// Putting match A on air sends its state, with the old lower-third cleared.
	if err := hub.SetDayOnAir(ctx, testDay, "match-a"); err != nil {
		t.Fatal(err)
	}
	onAir := decodeState(t, nextMessage(t, day))
	if onAir.MatchID != "match-a" || onAir.ManualHome != 7 {
		t.Fatalf("expected match A on air, got %+v", onAir)
	}
	if onAir.Graphic != nil {
		t.Errorf("expected the graphic to be cleared on switching, got %+v", onAir.Graphic)
	}

	// Updates to the on-air match reach the day overlay; other matches' don't.
	hub.SetState(&BroadcastState{MatchID: "match-a", ManualHome: 14})
	if s := decodeState(t, nextMessage(t, day)); s.ManualHome != 14 {
		t.Errorf("expected the on-air update, got %+v", s)
	}
	hub.SetState(&BroadcastState{MatchID: "match-b", ManualHome: 3})
	expectNoMessage(t, day)

	// Switching follows the new match, and match A's updates stop.
	if err := hub.SetDayOnAir(ctx, testDay, "match-b"); err != nil {
		t.Fatal(err)
	}
	if s := decodeState(t, nextMessage(t, day)); s.MatchID != "match-b" || s.ManualHome != 3 {
		t.Fatalf("expected match B on air, got %+v", s)
	}
	hub.SetState(&BroadcastState{MatchID: "match-a", ManualHome: 21})
	expectNoMessage(t, day)

	// Taking the day off air blanks the overlay.
	if err := hub.SetDayOnAir(ctx, testDay, ""); err != nil {
		t.Fatal(err)
	}
	if msg := nextMessage(t, day); string(msg) != "null" {
		t.Errorf("expected null when off air, got %s", msg)
	}
}

func TestHub_DayOnAirSurvivesRestart(t *testing.T) {
	ctx := context.Background()
	store := newMemStore()

	first := NewHub(store)
	first.SetState(&BroadcastState{MatchID: "match-a"})
	if err := first.SetDayOnAir(ctx, testDay, "match-a"); err != nil {
		t.Fatal(err)
	}
	closeHub(t, first)

	second := NewHub(store)
	defer closeHub(t, second)
	got, err := second.DayOnAir(ctx, testDay)
	if err != nil || got != "match-a" {
		t.Fatalf("expected match-a restored as on air, got %q (%v)", got, err)
	}
}

func TestHub_SetDayOnAirNeedsLoadedState(t *testing.T) {
	hub := NewHub(nil)
	defer closeHub(t, hub)
	if err := hub.SetDayOnAir(context.Background(), testDay, "missing"); err == nil {
		t.Errorf("expected an error for a match whose state isn't loaded")
	}
	if got, _ := hub.DayOnAir(context.Background(), testDay); got != "" {
		t.Errorf("a failed switch must leave the day as it was, got %q", got)
	}
}
