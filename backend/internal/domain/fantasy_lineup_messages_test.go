package domain

import (
	"strings"
	"testing"
)

// A rejection has to name the player, or the manager is left guessing which of
// their fourteen to change.
func TestLineupErrorsNameThePlayer(t *testing.T) {
	rules := LineupRules{MaxPerClub: 2}

	t.Run("wrong slot names the player, their position and the slot", func(t *testing.T) {
		_, err := ValidatePartialLineup([]LineupCandidate{
			{Slot: SlotDef1, PlayerID: "p1", Name: "Bakare Oyinlola", Position: "Receiver", Gender: "M"},
		}, rules)
		want := "Bakare Oyinlola (Receiver) can't play Defender 1 — that slot needs a Defender"
		if err == nil || err.Error() != want {
			t.Fatalf("got %v, want %q", err, want)
		}
	})

	t.Run("gender-locked slot says what it needs", func(t *testing.T) {
		_, err := ValidatePartialLineup([]LineupCandidate{
			{Slot: SlotQBMale, PlayerID: "p1", Name: "Ada Obi", Position: "QB", Gender: "F"},
		}, rules)
		if err == nil || !strings.Contains(err.Error(), "Ada Obi (QB) can't play Male Starting QB — that slot needs a Male QB") {
			t.Fatalf("got %v", err)
		}
	})

	t.Run("club limit names everyone from that club", func(t *testing.T) {
		_, err := ValidatePartialLineup([]LineupCandidate{
			{Slot: SlotDef1, PlayerID: "a", Name: "A", Position: "Defender", TeamID: "c1"},
			{Slot: SlotDef2, PlayerID: "b", Name: "B", Position: "Defender", TeamID: "c1"},
			{Slot: SlotDef3, PlayerID: "c", Name: "C", Position: "Defender", TeamID: "c1"},
			{Slot: SlotDef4, PlayerID: "d", Name: "D", Position: "Defender", TeamID: "c2"},
		}, rules)
		if err == nil || !strings.Contains(err.Error(), "A, B and C are all from one club") {
			t.Fatalf("got %v", err)
		}
	})

	t.Run("defensive All-Rounder limit names both", func(t *testing.T) {
		_, err := ValidatePartialLineup([]LineupCandidate{
			{Slot: SlotDef1, PlayerID: "a", Name: "Tolu", Position: "All-Rounder"},
			{Slot: SlotDef2, PlayerID: "b", Name: "Kemi", Position: "All-Rounder"},
		}, LineupRules{})
		if err == nil || !strings.Contains(err.Error(), "Tolu and Kemi are all All-Rounders") {
			t.Fatalf("got %v", err)
		}
	})
}
