package services

import (
	"context"
	"net/http"
	"os"
	"testing"
	"time"
)

// Detection reads YouTube's HTML, so it can break silently if YouTube changes
// the page. This check confirms the parsing still works against real channels —
// two that are permanently live, plus our own.
//
// It hits the network, so it only runs on request:
//
//	LIVE_NETWORK_TEST=1 go test ./internal/services -run TestFetchLiveNetwork -v
func TestFetchLiveNetwork(t *testing.T) {
	if os.Getenv("LIVE_NETWORK_TEST") == "" {
		t.Skip("set LIVE_NETWORK_TEST=1 to run this network check")
	}

	s := &LiveService{client: &http.Client{Timeout: 15 * time.Second}}

	// Both of these run 24/7 news streams, so a false here means our parsing
	// has drifted from YouTube's markup, not that the channel went quiet.
	for _, handle := range []string{"SkyNews", "aljazeeraenglish"} {
		got := s.fetchLive(context.Background(), handle)
		if got == nil {
			t.Errorf("%s: fetch failed", handle)
			continue
		}
		if !got.IsLive || got.VideoID == "" {
			t.Errorf("%s: expected a live broadcast, got is_live=%v video=%q — detection markers may have changed",
				handle, got.IsLive, got.VideoID)
			continue
		}
		t.Logf("%-20s live=%v video=%s title=%q", handle, got.IsLive, got.VideoID, got.Title)
	}

	// Informational: whatever our own channel is doing right now.
	if got := s.fetchLive(context.Background(), ChannelHandle); got != nil {
		t.Logf("%-20s live=%v video=%s title=%q", ChannelHandle, got.IsLive, got.VideoID, got.Title)
	}
}
