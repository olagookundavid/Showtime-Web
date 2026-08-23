package services

import "testing"

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
