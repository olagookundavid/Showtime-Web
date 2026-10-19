package services

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

const reliveTestFeed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
 <title>Best Of Season XV</title>
 <entry>
  <yt:videoId>YA4PS1xM9eI</yt:videoId>
  <title>GW3: Lagos Knights vs Lagos Rebels</title>
  <link rel="alternate" href="https://www.youtube.com/watch?v=YA4PS1xM9eI"/>
  <published>2026-10-05T05:50:17+00:00</published>
 </entry>
</feed>`

// newTestReliveService points the service at a local feed that counts hits.
func newTestReliveService(t *testing.T, handler http.HandlerFunc) (*ReliveService, *atomic.Int32) {
	t.Helper()
	var hits atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		handler(w, r)
	}))
	t.Cleanup(srv.Close)

	svc := NewReliveService(&fakeLiveSettings{values: make(map[string]string)})
	svc.feedURL = func(string) string { return srv.URL }
	return svc, &hits
}

func TestReliveService_ConcurrentVisitorsShareOneFetch(t *testing.T) {
	svc, hits := newTestReliveService(t, func(w http.ResponseWriter, _ *http.Request) {
		time.Sleep(100 * time.Millisecond)
		w.Write([]byte(reliveTestFeed))
	})

	var wg sync.WaitGroup
	for range 200 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			got, err := svc.GetRelivePlaylist(context.Background())
			if err != nil || len(got.Videos) != 1 {
				t.Errorf("GetRelivePlaylist = (%v, %v), want 1 video", got, err)
			}
		}()
	}
	wg.Wait()

	if n := hits.Load(); n != 1 {
		t.Errorf("YouTube was called %d times for 200 visitors, want 1", n)
	}
}

func TestReliveService_StaleCacheAnswersAtOnce(t *testing.T) {
	svc, hits := newTestReliveService(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Write([]byte(reliveTestFeed))
	})
	ctx := context.Background()
	if _, err := svc.GetRelivePlaylist(ctx); err != nil {
		t.Fatal(err)
	}

	// Age the cache past its TTL, then make YouTube slow.
	svc.mu.Lock()
	svc.cached.fetchedAt = time.Now().Add(-reliveCacheTTL - time.Second)
	svc.mu.Unlock()
	svc.feedURL = func(string) string { return "http://10.255.255.1/slow" }

	start := time.Now()
	got, err := svc.GetRelivePlaylist(ctx)
	if err != nil || len(got.Videos) != 1 {
		t.Fatalf("GetRelivePlaylist = (%v, %v), want the cached video", got, err)
	}
	if waited := time.Since(start); waited > 500*time.Millisecond {
		t.Errorf("stale cache took %s to answer, want it immediately", waited)
	}
	if n := hits.Load(); n != 1 {
		t.Errorf("hits = %d, want 1", n)
	}
}

func TestReliveService_FailureBacksOff(t *testing.T) {
	svc, hits := newTestReliveService(t, func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})
	ctx := context.Background()

	for range 50 {
		got, err := svc.GetRelivePlaylist(ctx)
		if err != nil {
			t.Fatalf("GetRelivePlaylist error = %v, want an empty playlist", err)
		}
		if len(got.Videos) != 0 || got.PlaylistID != DefaultRelivePlaylistID {
			t.Fatalf("GetRelivePlaylist = %+v, want the default playlist with no videos", got)
		}
	}
	if n := hits.Load(); n != 1 {
		t.Errorf("YouTube was called %d times while failing, want 1", n)
	}

	status, err := svc.GetAdminStatus(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if status.LastError == "" {
		t.Error("admin status has no LastError after a failed fetch")
	}
}

func TestReliveService_SetPlaylist(t *testing.T) {
	svc, _ := newTestReliveService(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Write([]byte(reliveTestFeed))
	})
	ctx := context.Background()

	const id = "PLaBcDeFgHiJkLmNoPqRsTuVwXyZ012345"
	status, err := svc.SetPlaylist(ctx, "https://www.youtube.com/playlist?list="+id)
	if err != nil {
		t.Fatal(err)
	}
	if status.PlaylistID != id || status.VideoCount != 1 || status.Title != "Best Of Season XV" {
		t.Errorf("SetPlaylist status = %+v", status)
	}

	got, err := svc.GetRelivePlaylist(ctx)
	if err != nil || got.PlaylistID != id {
		t.Errorf("GetRelivePlaylist = (%+v, %v), want playlist %s", got, err, id)
	}

	if _, err := svc.SetPlaylist(ctx, "https://example.com/?list="+id); err == nil {
		t.Error("SetPlaylist accepted a non-YouTube link")
	}
}

func TestExtractYouTubePlaylistID(t *testing.T) {
	const id = "PLCXiB8nftQ9A"
	valid := []string{
		id,
		"  " + id + " ",
		"https://www.youtube.com/playlist?list=" + id,
		"https://youtube.com/playlist?list=" + id + "&si=abc",
		"https://www.youtube.com/watch?v=YA4PS1xM9eI&list=" + id + "&index=2",
		"https://m.youtube.com/playlist?list=" + id,
	}
	for _, in := range valid {
		if got, ok := ExtractYouTubePlaylistID(in); !ok || got != id {
			t.Errorf("ExtractYouTubePlaylistID(%q) = (%q, %v), want (%q, true)", in, got, ok, id)
		}
	}

	invalid := []string{
		"",
		"short",
		"not a playlist id",
		"https://www.youtube.com/@ShowtimeFlagFootball",
		"https://www.youtube.com/watch?v=YA4PS1xM9eI",
		"https://evil.example.com/playlist?list=" + id,
	}
	for _, in := range invalid {
		if got, ok := ExtractYouTubePlaylistID(in); ok {
			t.Errorf("ExtractYouTubePlaylistID(%q) = (%q, true), want false", in, got)
		}
	}
}
