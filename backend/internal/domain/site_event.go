package domain

import "time"

const (
	SiteEventPageView = "page_view"

	SiteEventSourceWeb = "web"
	SiteEventSourceAPI = "api"
)

// BrowserEventTypes is the allowlist of event names the public beacon endpoint
// accepts. Server-recorded events (login, signup, ...) are never accepted from
// the browser, so they can't be forged.
var BrowserEventTypes = map[string]bool{
	SiteEventPageView:   true,
	"newsletter_signup": true,
	"add_to_cart":       true,
	"outbound_click":    true,
	"share":             true,
}

// SiteEvent is one stored analytics row.
type SiteEvent struct {
	ID           int64          `json:"id"`
	CreatedAt    time.Time      `json:"created_at"`
	EventType    string         `json:"event_type"`
	Source       string         `json:"source"`
	Path         string         `json:"path"`
	IsEntry      bool           `json:"is_entry"`
	ReferrerHost string         `json:"referrer_host"`
	UTMSource    string         `json:"utm_source"`
	UTMMedium    string         `json:"utm_medium"`
	UTMCampaign  string         `json:"utm_campaign"`
	SessionID    string         `json:"session_id"`
	IP           string         `json:"ip"`
	Country      string         `json:"country"`
	DeviceType   string         `json:"device_type"`
	Browser      string         `json:"browser"`
	OS           string         `json:"os"`
	IsBot        bool           `json:"is_bot"`
	UserAgent    string         `json:"user_agent"`
	Properties   map[string]any `json:"properties"`
}
