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
	// MatchDayName is the event day's title, or the fixtures when the day has
	// no event day. Empty on other days.
	MatchDayName string `json:"match_day_name,omitempty"`
}

// SiteMatchDay is one match day in the period: its event-day title (when there
// is an event day), its fixtures, and the traffic it drew.
type SiteMatchDay struct {
	Date      string `json:"date"`
	Title     string `json:"title"`
	Fixtures  int    `json:"fixtures"`
	Games     string `json:"games"`
	PageViews int    `json:"page_views"`
	Visitors  int    `json:"visitors"`
}

// Name is what the dashboard calls the day: the event-day title, else the
// fixtures, else just "Match day".
func (d SiteMatchDay) Name() string {
	switch {
	case d.Title != "":
		return d.Title
	case d.Games != "":
		return d.Games
	}
	return "Match day"
}

// Day filters for a report: every day, match days only, or the other days.
const (
	SiteDaysAll   = "all"
	SiteDaysMatch = "match"
	SiteDaysOther = "other"
)

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

// SiteMatchReach is one match page's audience in the period, split by when
// the views happened relative to the fixture's date (Lagos calendar).
type SiteMatchReach struct {
	MatchID  string `json:"match_id"`
	Label    string `json:"label"`
	Date     string `json:"date"`
	Views    int    `json:"views"`
	Visitors int    `json:"visitors"`
	BuildUp  int    `json:"build_up"`
	MatchDay int    `json:"match_day"`
	After    int    `json:"after"`
}

// SiteTicketFunnel follows visitors toward a ticket purchase. The first three
// steps count distinct visitors (IPs); PaidOrders comes from the ticket records
// (online purchases only: no gifts or team allocations).
type SiteTicketFunnel struct {
	Visitors           int `json:"visitors"`
	TicketPageVisitors int `json:"ticket_page_visitors"`
	CheckoutStarters   int `json:"checkout_starters"`
	PaidOrders         int `json:"paid_orders"`
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
	From string `json:"from"`
	To   string `json:"to"`
	// Days is the day filter the report was run with (all, match or other).
	Days string `json:"days"`
	// MatchDayList is every match day in the range with its traffic, whatever
	// the day filter, so the dashboard can always point to them.
	MatchDayList []SiteMatchDay     `json:"match_day_list"`
	Totals       SiteTotals         `json:"totals"`
	Previous     *SitePeriod        `json:"previous"`
	Daily        []SiteDailyPoint   `json:"daily"`
	Monthly      []SiteMonthlyPoint `json:"monthly"`
	Heatmap      []SiteHeatCell     `json:"heatmap"`
	MatchDays    SiteMatchDayStats  `json:"match_days"`
	Sections     []SiteBreakdownRow `json:"sections"`
	TopPages     []SiteBreakdownRow `json:"top_pages"`
	TopMatches   []SiteMatchReach   `json:"top_matches"`
	TopNews      []SiteBreakdownRow `json:"top_news"`
	TopPlayers   []SiteBreakdownRow `json:"top_players"`
	TopTeams     []SiteBreakdownRow `json:"top_teams"`
	TicketFunnel SiteTicketFunnel   `json:"ticket_funnel"`
	Sources      []SiteBreakdownRow `json:"sources"`
	Campaigns    []SiteBreakdownRow `json:"campaigns"`
	Countries    []SiteBreakdownRow `json:"countries"`
	Devices      []SiteBreakdownRow `json:"devices"`
	Browsers     []SiteBreakdownRow `json:"browsers"`
	OSes         []SiteBreakdownRow `json:"oses"`
	Actions      []SiteBreakdownRow `json:"actions"`
	Conversions  SiteConversions    `json:"conversions"`
}

type SiteEventsPage struct {
	Events []domain.SiteEvent `json:"events"`
	Total  int                `json:"total"`
	Page   int                `json:"page"`
	Limit  int                `json:"limit"`
}
