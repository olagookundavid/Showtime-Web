package dto

import "showtime-backend/internal/domain"

// TrackEventRequest is what the browser beacon posts to the public endpoint.
type TrackEventRequest struct {
	Type        string         `json:"type"`
	Path        string         `json:"path"`
	SessionID   string         `json:"session_id"`
	IsEntry     bool           `json:"is_entry"`
	Referrer    string         `json:"referrer"`
	UTMSource   string         `json:"utm_source"`
	UTMMedium   string         `json:"utm_medium"`
	UTMCampaign string         `json:"utm_campaign"`
	Properties  map[string]any `json:"properties"`
}

type SiteTotals struct {
	PageViews         int     `json:"page_views"`
	UniqueVisitors    int     `json:"unique_visitors"`
	NewVisitors       int     `json:"new_visitors"`
	ReturningVisitors int     `json:"returning_visitors"`
	AvgDailyVisitors  float64 `json:"avg_daily_visitors"`
	Sessions          int     `json:"sessions"`
	PagesPerSession   float64 `json:"pages_per_session"`
	// BounceRate is the share (0-1) of sessions that viewed a single page.
	BounceRate        float64 `json:"bounce_rate"`
	ActionEvents      int     `json:"action_events"`
	BotEventsExcluded int     `json:"bot_events_excluded"`
}

type SiteDailyPoint struct {
	Date      string `json:"date"`
	PageViews int    `json:"page_views"`
	Visitors  int    `json:"visitors"`
	MatchDay  bool   `json:"match_day"`
}

type SiteMonthlyPoint struct {
	Month     string `json:"month"`
	PageViews int    `json:"page_views"`
	Visitors  int    `json:"visitors"`
	Sessions  int    `json:"sessions"`
}

// SiteHeatCell is page views for one weekday-hour slot in Lagos time.
// Weekday is ISO: 1 = Monday ... 7 = Sunday.
type SiteHeatCell struct {
	Weekday   int `json:"weekday"`
	Hour      int `json:"hour"`
	PageViews int `json:"page_views"`
}

// SiteBreakdownRow is one line of a ranked list (top pages, countries, ...).
// Label is a human name for the row when one exists (a news headline, "Home vs
// Away" for a match page); Name stays the raw stored value.
type SiteBreakdownRow struct {
	Name     string `json:"name"`
	Label    string `json:"label,omitempty"`
	Count    int    `json:"count"`
	Visitors int    `json:"visitors"`
}

// SiteConversions comes from the source-of-truth tables (users, tickets,
// online_orders), not the event stream, so it can't double count webhook
// retries and also covers history from before tracking existed.
type SiteConversions struct {
	NewUsers      int     `json:"new_users"`
	TicketOrders  int     `json:"ticket_orders"`
	TicketsSold   int     `json:"tickets_sold"`
	TicketRevenue int     `json:"ticket_revenue"`
	StoreOrders   int     `json:"store_orders"`
	StoreRevenue  float64 `json:"store_revenue"`
}

// SiteMatchDayStats compares average daily visitors on days with a fixture
// against days without one.
type SiteMatchDayStats struct {
	MatchDays           int     `json:"match_days"`
	AvgVisitorsMatchDay float64 `json:"avg_visitors_match_day"`
	OtherDays           int     `json:"other_days"`
	AvgVisitorsOtherDay float64 `json:"avg_visitors_other_day"`
}

// SitePeriod is the same-length period immediately before the one requested,
// for "vs previous period" comparisons.
type SitePeriod struct {
	From        string          `json:"from"`
	To          string          `json:"to"`
	Totals      SiteTotals      `json:"totals"`
	Conversions SiteConversions `json:"conversions"`
}

type SiteTrafficSummary struct {
	From        string             `json:"from"`
	To          string             `json:"to"`
	Totals      SiteTotals         `json:"totals"`
	Previous    *SitePeriod        `json:"previous"`
	Daily       []SiteDailyPoint   `json:"daily"`
	Monthly     []SiteMonthlyPoint `json:"monthly"`
	Heatmap     []SiteHeatCell     `json:"heatmap"`
	MatchDays   SiteMatchDayStats  `json:"match_days"`
	Sections    []SiteBreakdownRow `json:"sections"`
	TopPages    []SiteBreakdownRow `json:"top_pages"`
	Sources     []SiteBreakdownRow `json:"sources"`
	Campaigns   []SiteBreakdownRow `json:"campaigns"`
	Countries   []SiteBreakdownRow `json:"countries"`
	Devices     []SiteBreakdownRow `json:"devices"`
	Browsers    []SiteBreakdownRow `json:"browsers"`
	OSes        []SiteBreakdownRow `json:"oses"`
	Actions     []SiteBreakdownRow `json:"actions"`
	Conversions SiteConversions    `json:"conversions"`
}

type SiteEventsPage struct {
	Events []domain.SiteEvent `json:"events"`
	Total  int                `json:"total"`
	Page   int                `json:"page"`
	Limit  int                `json:"limit"`
}
