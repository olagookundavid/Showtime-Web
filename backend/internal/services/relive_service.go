package services

import (
	"context"
	"encoding/xml"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"

	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"

	"golang.org/x/sync/singleflight"
)

const (
	// SettingKeyRelivePlaylistID is the YouTube playlist the homepage Relive
	// section shows. Set from the admin Live Stream page.
	SettingKeyRelivePlaylistID = "relive_playlist_id"
	// DefaultRelivePlaylistID is used until an admin picks a playlist.
	DefaultRelivePlaylistID = "PLCXiB8nftQ9A"

	// The feed is cached this long. Once it is older, visitors still get the
	// cached videos straight away while a single background refresh runs.
	reliveCacheTTL = 15 * time.Minute
	// After a failed fetch, nobody calls YouTube again for this long.
	reliveFailureBackoff = 2 * time.Minute
	// One fetch never waits longer than this for YouTube.
	reliveFetchTimeout = 5 * time.Second
	// The configured playlist id is re-read from the database this often, so
	// a homepage visit doesn't cost a settings query.
	relivePlaylistIDTTL = time.Minute
)

// playlistIDRe matches a bare playlist id (PL…, UU…, OLAK5uy_…).
var playlistIDRe = regexp.MustCompile(`^[A-Za-z0-9_-]{10,64}$`)

type ReliveVideo struct {
	ID           string    `json:"id"`
	VideoID      string    `json:"video_id"`
	Title        string    `json:"title"`
	Thumbnail    string    `json:"thumbnail"`
	MaxThumbnail string    `json:"max_thumbnail"`
	PublishedAt  time.Time `json:"published_at"`
	Link         string    `json:"link"`
}

type RelivePlaylist struct {
	Title      string        `json:"title"`
	PlaylistID string        `json:"playlist_id"`
	Videos     []ReliveVideo `json:"videos"`
}

type ytFeed struct {
	XMLName    xml.Name  `xml:"feed"`
	Title      string    `xml:"title"`
	PlaylistID string    `xml:"playlistId"`
	Entries    []ytEntry `xml:"entry"`
}

type ytEntry struct {
	VideoID   string    `xml:"videoId"`
	Title     string    `xml:"title"`
	Published time.Time `xml:"published"`
	Link      struct {
		Href string `xml:"href,attr"`
	} `xml:"link"`
	MediaGroup struct {
		Thumbnail struct {
			URL string `xml:"url,attr"`
		} `xml:"thumbnail"`
	} `xml:"group"`
}

type IReliveService interface {
	// GetRelivePlaylist returns the configured playlist for the homepage. When
	// YouTube can't be reached and nothing is cached it returns the playlist
	// with no videos rather than an error, so the section shows its empty state.
	GetRelivePlaylist(ctx context.Context) (*RelivePlaylist, error)
	// GetAdminStatus reports the configured playlist and how fetching it is going.
	GetAdminStatus(ctx context.Context) (*dto.AdminReliveStatusResponse, error)
	// SetPlaylist stores a new playlist (a YouTube link or a bare id) and
	// fetches it straight away so the admin sees whether it works.
	SetPlaylist(ctx context.Context, input string) (*dto.AdminReliveStatusResponse, error)
}

type relivePlaylistCache struct {
	playlistID string
	data       *RelivePlaylist
	fetchedAt  time.Time
}

type reliveFailure struct {
	playlistID string
	at         time.Time
	err        error
}

// ReliveService serves the Relive playlist from memory. However many visitors
// arrive at once, at most one request to YouTube is in flight per playlist
// (singleflight), and a failure pauses fetching for reliveFailureBackoff.
type ReliveService struct {
	repo   ports.IAppSettingRepository
	client *http.Client
	// feedURL builds the feed address; tests point it at a local server.
	feedURL func(playlistID string) string
	group   singleflight.Group

	mu           sync.RWMutex
	playlistID   string
	playlistIDAt time.Time
	cached       *relivePlaylistCache
	failure      *reliveFailure
}

func NewReliveService(repo ports.IAppSettingRepository) *ReliveService {
	return &ReliveService{
		repo:   repo,
		client: &http.Client{Timeout: reliveFetchTimeout},
		feedURL: func(playlistID string) string {
			return "https://www.youtube.com/feeds/videos.xml?playlist_id=" + url.QueryEscape(playlistID)
		},
	}
}

func (s *ReliveService) GetRelivePlaylist(ctx context.Context) (*RelivePlaylist, error) {
	playlistID, err := s.currentPlaylistID(ctx)
	if err != nil {
		return nil, err
	}

	cached, failure := s.snapshot(playlistID)
	if cached != nil {
		if time.Since(cached.fetchedAt) >= reliveCacheTTL && failure == nil {
			// Stale: answer now, refresh in the background. DoChan's channel is
			// buffered, so nobody has to read the result.
			s.group.DoChan(playlistID, s.fetchFn(playlistID))
		}
		return cached.data, nil
	}
	if failure != nil {
		return emptyRelivePlaylist(playlistID), nil
	}

	// Nothing cached yet: wait on the shared fetch.
	select {
	case res := <-s.group.DoChan(playlistID, s.fetchFn(playlistID)):
		if res.Err != nil {
			return emptyRelivePlaylist(playlistID), nil
		}
		return res.Val.(*RelivePlaylist), nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

func (s *ReliveService) GetAdminStatus(ctx context.Context) (*dto.AdminReliveStatusResponse, error) {
	playlistID, err := s.currentPlaylistID(ctx)
	if err != nil {
		return nil, err
	}
	// Warm the cache if it is empty, so the admin sees real numbers.
	if cached, failure := s.snapshot(playlistID); cached == nil && failure == nil {
		<-s.group.DoChan(playlistID, s.fetchFn(playlistID))
	}
	return s.adminStatus(playlistID), nil
}

func (s *ReliveService) SetPlaylist(ctx context.Context, input string) (*dto.AdminReliveStatusResponse, error) {
	playlistID, ok := ExtractYouTubePlaylistID(input)
	if !ok {
		return nil, fmt.Errorf("could not read a YouTube playlist id from %q", input)
	}
	if err := s.repo.Set(ctx, SettingKeyRelivePlaylistID, playlistID); err != nil {
		return nil, err
	}

	s.mu.Lock()
	s.playlistID = playlistID
	s.playlistIDAt = time.Now()
	// A fresh choice deserves a fresh try, even if this id failed recently.
	s.failure = nil
	s.mu.Unlock()

	// The setting is saved either way; the status tells the admin whether
	// YouTube answered.
	<-s.group.DoChan(playlistID, s.fetchFn(playlistID))
	return s.adminStatus(playlistID), nil
}

// currentPlaylistID returns the admin-chosen playlist, re-reading the setting
// at most once every relivePlaylistIDTTL.
func (s *ReliveService) currentPlaylistID(ctx context.Context) (string, error) {
	s.mu.RLock()
	id, at := s.playlistID, s.playlistIDAt
	s.mu.RUnlock()
	if id != "" && time.Since(at) < relivePlaylistIDTTL {
		return id, nil
	}

	stored, err := s.repo.Get(ctx, SettingKeyRelivePlaylistID)
	if err != nil {
		if id != "" {
			return id, nil
		}
		return "", err
	}
	if stored == "" {
		stored = DefaultRelivePlaylistID
	}

	s.mu.Lock()
	s.playlistID = stored
	s.playlistIDAt = time.Now()
	s.mu.Unlock()
	return stored, nil
}

// snapshot returns the cache for playlistID, and the failure only while its
// backoff is still running.
func (s *ReliveService) snapshot(playlistID string) (*relivePlaylistCache, *reliveFailure) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var cached *relivePlaylistCache
	if s.cached != nil && s.cached.playlistID == playlistID {
		cached = s.cached
	}
	var failure *reliveFailure
	if s.failure != nil && s.failure.playlistID == playlistID && time.Since(s.failure.at) < reliveFailureBackoff {
		failure = s.failure
	}
	return cached, failure
}

// fetchFn is the shared fetch run by singleflight. It uses its own context:
// the visitor whose request started it may leave, but the others still wait.
func (s *ReliveService) fetchFn(playlistID string) func() (any, error) {
	return func() (any, error) {
		ctx, cancel := context.WithTimeout(context.Background(), reliveFetchTimeout)
		defer cancel()

		data, err := s.fetch(ctx, playlistID)

		s.mu.Lock()
		defer s.mu.Unlock()
		if err != nil {
			log.Printf("[WARN] relive playlist %s: %v (next try in %s)", playlistID, err, reliveFailureBackoff)
			s.failure = &reliveFailure{playlistID: playlistID, at: time.Now(), err: err}
			return nil, err
		}
		s.cached = &relivePlaylistCache{playlistID: playlistID, data: data, fetchedAt: time.Now()}
		s.failure = nil
		return data, nil
	}
}

func (s *ReliveService) fetch(ctx context.Context, playlistID string) (*RelivePlaylist, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.feedURL(playlistID), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch youtube feed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("youtube feed returned %s", resp.Status)
	}

	var feed ytFeed
	if err := xml.NewDecoder(resp.Body).Decode(&feed); err != nil {
		return nil, fmt.Errorf("failed to decode youtube rss feed: %w", err)
	}

	videos := make([]ReliveVideo, 0, len(feed.Entries))
	for _, entry := range feed.Entries {
		vID := entry.VideoID
		if vID == "" {
			continue
		}
		thumb := entry.MediaGroup.Thumbnail.URL
		if thumb == "" {
			thumb = fmt.Sprintf("https://i2.ytimg.com/vi/%s/hqdefault.jpg", vID)
		}
		maxThumb := fmt.Sprintf("https://i2.ytimg.com/vi/%s/hqdefault.jpg", vID)

		link := entry.Link.Href
		if link == "" {
			link = fmt.Sprintf("https://www.youtube.com/watch?v=%s", vID)
		}

		videos = append(videos, ReliveVideo{
			ID:           vID,
			VideoID:      vID,
			Title:        entry.Title,
			Thumbnail:    thumb,
			MaxThumbnail: maxThumb,
			PublishedAt:  entry.Published,
			Link:         link,
		})
	}

	return &RelivePlaylist{
		Title:      feed.Title,
		PlaylistID: playlistID,
		Videos:     videos,
	}, nil
}

func (s *ReliveService) adminStatus(playlistID string) *dto.AdminReliveStatusResponse {
	status := &dto.AdminReliveStatusResponse{
		PlaylistID:  playlistID,
		PlaylistURL: "https://www.youtube.com/playlist?list=" + url.QueryEscape(playlistID),
		IsDefault:   playlistID == DefaultRelivePlaylistID,
	}

	s.mu.RLock()
	defer s.mu.RUnlock()
	if c := s.cached; c != nil && c.playlistID == playlistID {
		fetchedAt := c.fetchedAt
		status.Title = c.data.Title
		status.VideoCount = len(c.data.Videos)
		status.FetchedAt = &fetchedAt
	}
	if f := s.failure; f != nil && f.playlistID == playlistID {
		failedAt := f.at
		status.LastError = f.err.Error()
		status.FailedAt = &failedAt
	}
	return status
}

func emptyRelivePlaylist(playlistID string) *RelivePlaylist {
	return &RelivePlaylist{PlaylistID: playlistID, Videos: []ReliveVideo{}}
}

// ExtractYouTubePlaylistID reads a playlist id from a bare id or any YouTube
// link carrying a list= parameter (playlist pages, watch?v=…&list=…).
func ExtractYouTubePlaylistID(input string) (string, bool) {
	input = strings.TrimSpace(input)
	if playlistIDRe.MatchString(input) {
		return input, true
	}
	u, err := url.Parse(input)
	if err != nil || u.Host == "" {
		return "", false
	}
	host := strings.TrimPrefix(strings.ToLower(u.Hostname()), "www.")
	if host != "youtube.com" && host != "m.youtube.com" && host != "music.youtube.com" && host != "youtu.be" {
		return "", false
	}
	if id := u.Query().Get("list"); playlistIDRe.MatchString(id) {
		return id, true
	}
	return "", false
}
