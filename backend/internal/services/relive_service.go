package services

import (
	"context"
	"encoding/xml"
	"fmt"
	"net/http"
	"sync"
	"time"
)

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
	GetRelivePlaylist(ctx context.Context, playlistID string) (*RelivePlaylist, error)
}

type ReliveService struct {
	mu       sync.RWMutex
	cache    map[string]*cacheItem
	client   *http.Client
	cacheTTL time.Duration
}

type cacheItem struct {
	data      *RelivePlaylist
	fetchedAt time.Time
}

func NewReliveService() *ReliveService {
	return &ReliveService{
		cache: make(map[string]*cacheItem),
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
		cacheTTL: 15 * time.Minute,
	}
}

func (s *ReliveService) GetRelivePlaylist(ctx context.Context, playlistID string) (*RelivePlaylist, error) {
	if playlistID == "" {
		playlistID = "PLCXiB8nftQ9A"
	}

	s.mu.RLock()
	item, found := s.cache[playlistID]
	s.mu.RUnlock()

	if found && time.Since(item.fetchedAt) < s.cacheTTL {
		return item.data, nil
	}

	url := fmt.Sprintf("https://www.youtube.com/feeds/videos.xml?playlist_id=%s", playlistID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		if found {
			return item.data, nil
		}
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	resp, err := s.client.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		if resp != nil {
			resp.Body.Close()
		}
		if found {
			return item.data, nil
		}
		return nil, fmt.Errorf("failed to fetch youtube feed: %v", err)
	}
	defer resp.Body.Close()

	var feed ytFeed
	if err := xml.NewDecoder(resp.Body).Decode(&feed); err != nil {
		if found {
			return item.data, nil
		}
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

	result := &RelivePlaylist{
		Title:      feed.Title,
		PlaylistID: playlistID,
		Videos:     videos,
	}

	s.mu.Lock()
	s.cache[playlistID] = &cacheItem{
		data:      result,
		fetchedAt: time.Now(),
	}
	s.mu.Unlock()

	return result, nil
}
