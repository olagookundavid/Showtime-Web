package services

import (
	"context"
	"fmt"
	"html"
	"io"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"showtime-backend/internal/dto"
	"showtime-backend/internal/ports"
)

const (
	// SettingKeyLiveMode decides who controls the homepage hero:
	// "auto" (detect from YouTube), "on" (force live), "off" (force carousel).
	SettingKeyLiveMode = "live_stream_mode"
	// SettingKeyLiveVideoID is the video the "on" override plays.
	SettingKeyLiveVideoID = "live_stream_video_id"
	// SettingKeyLiveTitle is the caption shown beside the LIVE badge for an
	// override. Auto-detected streams take their title from YouTube instead.
	SettingKeyLiveTitle = "live_stream_title"

	LiveModeAuto = "auto"
	LiveModeOn   = "on"
	LiveModeOff  = "off"

	// ChannelHandle is the channel we watch. YouTube serves the current live
	// broadcast at /@handle/live, so no API key or quota is involved — the same
	// no-key approach the Relive playlist feed uses.
	ChannelHandle = "ShowtimeFlagFootball"

	// Detection is cached this long. The frontend polls every 60s, so this
	// caps us at roughly one YouTube request per minute no matter how many
	// visitors are on the site.
	liveCacheTTL = 45 * time.Second
)

// canonicalRe pulls the video id out of the watch page YouTube serves when the
// channel is live. On a non-live channel the /live URL renders the channel page
// instead, whose canonical link is a /channel/... or /@handle URL — no match.
var canonicalRe = regexp.MustCompile(`<link rel="canonical" href="https://www\.youtube\.com/watch\?v=([\w-]{11})"`)

// titleRe reads the broadcast title from the page's meta tag.
var titleRe = regexp.MustCompile(`<meta name="title" content="([^"]*)"`)

type ILiveService interface {
	// GetStatus reports whether the hero should show a live stream right now.
	GetStatus(ctx context.Context) (*dto.LiveStatusResponse, error)
	// GetAdminStatus is GetStatus plus the stored override, for the admin UI.
	GetAdminStatus(ctx context.Context) (*dto.AdminLiveStatusResponse, error)
	// SetOverride stores the admin's manual control of the hero.
	SetOverride(ctx context.Context, mode, videoID, title string) (*dto.AdminLiveStatusResponse, error)
}

type LiveService struct {
	repo   ports.IAppSettingRepository
	client *http.Client

	mu     sync.RWMutex
	cached *dto.LiveStatusResponse
	// fetchedAt is zero until the first successful detection.
	fetchedAt time.Time
}

func NewLiveService(repo ports.IAppSettingRepository) ILiveService {
	return &LiveService{
		repo: repo,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (s *LiveService) GetStatus(ctx context.Context) (*dto.LiveStatusResponse, error) {
	mode, err := s.repo.Get(ctx, SettingKeyLiveMode)
	if err != nil {
		return nil, err
	}

	switch mode {
	case LiveModeOn:
		videoID, err := s.repo.Get(ctx, SettingKeyLiveVideoID)
		if err != nil {
			return nil, err
		}
		// "on" with no video id is a half-finished setting, not a live stream —
		// fall through to the carousel rather than embedding a broken player.
		if videoID == "" {
			return &dto.LiveStatusResponse{IsLive: false, Source: LiveSourceManual}, nil
		}
		title, err := s.repo.Get(ctx, SettingKeyLiveTitle)
		if err != nil {
			return nil, err
		}
		return &dto.LiveStatusResponse{
			IsLive:  true,
			VideoID: videoID,
			Title:   title,
			Source:  LiveSourceManual,
		}, nil

	case LiveModeOff:
		return &dto.LiveStatusResponse{IsLive: false, Source: LiveSourceManual}, nil
	}

	// Unset or "auto".
	return s.detect(ctx), nil
}

func (s *LiveService) GetAdminStatus(ctx context.Context) (*dto.AdminLiveStatusResponse, error) {
	status, err := s.GetStatus(ctx)
	if err != nil {
		return nil, err
	}
	return s.withOverride(ctx, status)
}

func (s *LiveService) SetOverride(ctx context.Context, mode, videoID, title string) (*dto.AdminLiveStatusResponse, error) {
	switch mode {
	case LiveModeAuto, LiveModeOn, LiveModeOff:
	default:
		return nil, fmt.Errorf("invalid mode %q: expected auto, on or off", mode)
	}

	if mode == LiveModeOn {
		// Admins paste whatever YouTube gave them — a watch URL, a youtu.be
		// link, a /live/ link, or the bare id. Normalise here so the frontend
		// only ever deals in ids.
		id, ok := ExtractYouTubeVideoID(videoID)
		if !ok {
			return nil, fmt.Errorf("could not read a YouTube video id from %q", videoID)
		}
		videoID = id
	}

	if err := s.repo.Set(ctx, SettingKeyLiveMode, mode); err != nil {
		return nil, err
	}
	if err := s.repo.Set(ctx, SettingKeyLiveVideoID, videoID); err != nil {
		return nil, err
	}
	if err := s.repo.Set(ctx, SettingKeyLiveTitle, strings.TrimSpace(title)); err != nil {
		return nil, err
	}

	// Switching back to auto should take effect now, not up to 45s later.
	if mode == LiveModeAuto {
		s.mu.Lock()
		s.fetchedAt = time.Time{}
		s.mu.Unlock()
	}

	status, err := s.GetStatus(ctx)
	if err != nil {
		return nil, err
	}
	return s.withOverride(ctx, status)
}

func (s *LiveService) withOverride(ctx context.Context, status *dto.LiveStatusResponse) (*dto.AdminLiveStatusResponse, error) {
	mode, err := s.repo.Get(ctx, SettingKeyLiveMode)
	if err != nil {
		return nil, err
	}
	if mode == "" {
		mode = LiveModeAuto
	}
	videoID, err := s.repo.Get(ctx, SettingKeyLiveVideoID)
	if err != nil {
		return nil, err
	}
	title, err := s.repo.Get(ctx, SettingKeyLiveTitle)
	if err != nil {
		return nil, err
	}

	// What auto-detection sees right now, regardless of the active mode, so an
	// admin can tell whether it is safe to hand control back to auto.
	detected := s.detect(ctx)

	return &dto.AdminLiveStatusResponse{
		LiveStatusResponse: *status,
		Mode:               mode,
		OverrideVideoID:    videoID,
		OverrideTitle:      title,
		DetectedLive:       detected.IsLive,
		DetectedVideoID:    detected.VideoID,
		DetectedTitle:      detected.Title,
		ChannelHandle:      ChannelHandle,
	}, nil
}

// detect asks YouTube whether the channel is live, behind a short TTL cache.
// It never returns an error: a YouTube hiccup should show the carousel (the
// normal state of the site), not a 500 on the homepage.
func (s *LiveService) detect(ctx context.Context) *dto.LiveStatusResponse {
	s.mu.RLock()
	cached, fetchedAt := s.cached, s.fetchedAt
	s.mu.RUnlock()

	if cached != nil && time.Since(fetchedAt) < liveCacheTTL {
		return cached
	}

	result := s.fetchLive(ctx, ChannelHandle)
	if result == nil {
		// Network/parse failure. Serve the last known answer if we have one so
		// a single failed poll doesn't yank a running stream off the homepage;
		// otherwise report not-live.
		if cached != nil {
			return cached
		}
		return &dto.LiveStatusResponse{IsLive: false, Source: LiveSourceAuto}
	}

	s.mu.Lock()
	s.cached = result
	s.fetchedAt = time.Now()
	s.mu.Unlock()

	return result
}

// fetchLive returns nil on any failure to reach or read YouTube, which the
// caller treats as "keep the previous answer" rather than "not live".
func (s *LiveService) fetchLive(ctx context.Context, handle string) *dto.LiveStatusResponse {
	url := fmt.Sprintf("https://www.youtube.com/@%s/live", handle)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil
	}
	// Same browser UA the Relive feed uses — YouTube serves a stripped page to
	// unrecognised clients.
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil
	}

	// Bounded read rather than the whole document. The canonical link is in the
	// head, but the live markers sit in the player config around 750KB into a
	// ~1.3MB page, so 2MB leaves real headroom without ever being unbounded.
	body, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return nil
	}
	page := string(body)

	match := canonicalRe.FindStringSubmatch(page)
	if match == nil {
		// Not a watch page: the channel has no live broadcast.
		return &dto.LiveStatusResponse{IsLive: false, Source: LiveSourceAuto}
	}

	// A canonical watch URL alone isn't enough — YouTube also lands /live on the
	// most recent *finished* stream once the broadcast ends. Only a page still
	// carrying live playback markers counts.
	if !strings.Contains(page, `"isLiveNow":true`) &&
		!strings.Contains(page, `"isLive":true`) &&
		!strings.Contains(page, "hlsManifestUrl") {
		return &dto.LiveStatusResponse{IsLive: false, Source: LiveSourceAuto}
	}

	// The meta tag is HTML-escaped — a title like "Rebels vs Knights" with an
	// apostrophe arrives as &#39;, which React would render literally.
	title := ""
	if t := titleRe.FindStringSubmatch(page); t != nil {
		title = html.UnescapeString(t[1])
	}

	return &dto.LiveStatusResponse{
		IsLive:  true,
		VideoID: match[1],
		Title:   title,
		Source:  LiveSourceAuto,
	}
}

const (
	LiveSourceAuto   = "auto"
	LiveSourceManual = "manual"
)

var videoIDRe = regexp.MustCompile(`^[\w-]{11}$`)

// ExtractYouTubeVideoID accepts any shape of YouTube link an admin might paste
// (watch, youtu.be, /live/, /embed/) or a bare id, and returns the 11-character
// video id.
func ExtractYouTubeVideoID(input string) (string, bool) {
	input = strings.TrimSpace(input)
	if input == "" {
		return "", false
	}
	if videoIDRe.MatchString(input) {
		return input, true
	}

	// Everything after these markers starts with the id.
	for _, marker := range []string{"watch?v=", "youtu.be/", "/live/", "/embed/", "/shorts/", "&v="} {
		if i := strings.Index(input, marker); i >= 0 {
			rest := input[i+len(marker):]
			if len(rest) >= 11 && videoIDRe.MatchString(rest[:11]) {
				return rest[:11], true
			}
		}
	}
	return "", false
}
