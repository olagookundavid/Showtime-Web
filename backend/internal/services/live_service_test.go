package services

import (
	"context"
	"testing"

	"showtime-backend/internal/ports"
)

func TestExtractYouTubeVideoID(t *testing.T) {
	const id = "dQw4w9WgXcQ"

	valid := []string{
		id,
		"  " + id + "  ",
		"https://www.youtube.com/watch?v=" + id,
		"https://www.youtube.com/watch?v=" + id + "&t=30s",
		"https://youtu.be/" + id,
		"https://youtu.be/" + id + "?si=abc",
		"https://www.youtube.com/live/" + id,
		"https://www.youtube-nocookie.com/embed/" + id,
		"https://www.youtube.com/shorts/" + id,
		"https://youtube.com/?v=" + id,
	}
	for _, in := range valid {
		got, ok := ExtractYouTubeVideoID(in)
		if !ok || got != id {
			t.Errorf("ExtractYouTubeVideoID(%q) = (%q, %v), want (%q, true)", in, got, ok, id)
		}
	}

	invalid := []string{
		"",
		"   ",
		"not a link",
		"https://www.youtube.com/@ShowtimeFlagFootball",
		"https://www.youtube.com/watch?v=tooshort",
	}
	for _, in := range invalid {
		if got, ok := ExtractYouTubeVideoID(in); ok {
			t.Errorf("ExtractYouTubeVideoID(%q) = (%q, true), want ok=false", in, got)
		}
	}
}

type fakeLiveSettings struct {
	ports.IAppSettingRepository
	values map[string]string
}

func (f *fakeLiveSettings) Get(_ context.Context, key string) (string, error) {
	return f.values[key], nil
}

func (f *fakeLiveSettings) Set(_ context.Context, key, value string) error {
	f.values[key] = value
	return nil
}

func TestLiveService_VideoMode(t *testing.T) {
	repo := &fakeLiveSettings{values: make(map[string]string)}
	svc := NewLiveService(repo)
	ctx := context.Background()

	// Setting video mode with a youtu.be URL
	res, err := svc.SetOverride(ctx, LiveModeVideo, "https://youtu.be/KicnwqQAjTs?si=B_JZCHfohGFwvEA4", "Season Highlights")
	if err != nil {
		t.Fatalf("SetOverride failed: %v", err)
	}

	if res.Mode != LiveModeVideo {
		t.Errorf("got mode %q, want %q", res.Mode, LiveModeVideo)
	}
	if res.OverrideVideoID != "KicnwqQAjTs" {
		t.Errorf("got video ID %q, want %q", res.OverrideVideoID, "KicnwqQAjTs")
	}

	// Status response
	status, err := svc.GetStatus(ctx)
	if err != nil {
		t.Fatalf("GetStatus failed: %v", err)
	}
	if status.IsLive {
		t.Errorf("expected IsLive to be false, got true")
	}
	if !status.IsVideo {
		t.Errorf("expected IsVideo to be true, got false")
	}
	if status.VideoID != "KicnwqQAjTs" {
		t.Errorf("got VideoID %q, want %q", status.VideoID, "KicnwqQAjTs")
	}
	if status.Title != "Season Highlights" {
		t.Errorf("got Title %q, want %q", status.Title, "Season Highlights")
	}
	if status.Mode != LiveModeVideo {
		t.Errorf("got Mode %q, want %q", status.Mode, LiveModeVideo)
	}
}

