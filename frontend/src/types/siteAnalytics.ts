export interface SiteTotals {
  page_views: number;
  unique_visitors: number;
  new_visitors: number;
  returning_visitors: number;
  avg_daily_visitors: number;
  sessions: number;
  pages_per_session: number;
  /** Share (0-1) of sessions that viewed a single page. */
  bounce_rate: number;
  action_events: number;
  bot_events_excluded: number;
}

export interface SiteDailyPoint {
  date: string;
  page_views: number;
  visitors: number;
  match_day: boolean;
}

export interface SiteMonthlyPoint {
  month: string;
  page_views: number;
  visitors: number;
  sessions: number;
}

/** Page views in one weekday-hour slot, Lagos time. weekday: 1 = Monday ... 7 = Sunday. */
export interface SiteHeatCell {
  weekday: number;
  hour: number;
  page_views: number;
}

export interface SiteMatchDayStats {
  match_days: number;
  avg_visitors_match_day: number;
  other_days: number;
  avg_visitors_other_day: number;
}

export interface SiteBreakdownRow {
  name: string;
  /** Readable title when the row is a detail page (news headline, "Home vs Away"). */
  label?: string;
  count: number;
  visitors: number;
}

export interface SiteConversions {
  new_users: number;
  ticket_orders: number;
  tickets_sold: number;
  ticket_revenue: number;
  store_orders: number;
  store_revenue: number;
}

/** One match page's audience, split by when the views happened relative to match day (Lagos dates). */
export interface SiteMatchReach {
  match_id: string;
  label: string;
  date: string;
  views: number;
  visitors: number;
  build_up: number;
  match_day: number;
  after: number;
}

/** Visitors moving toward a ticket. The last step is paid online orders from the ticket records. */
export interface SiteTicketFunnel {
  visitors: number;
  ticket_page_visitors: number;
  checkout_starters: number;
  paid_orders: number;
}

/** The same-length period just before the selected one. */
export interface SitePeriod {
  from: string;
  to: string;
  totals: SiteTotals;
  conversions: SiteConversions;
}

export interface SiteTrafficSummary {
  from: string;
  to: string;
  totals: SiteTotals;
  /** null for "All time", which has no earlier period. */
  previous: SitePeriod | null;
  daily: SiteDailyPoint[];
  monthly: SiteMonthlyPoint[];
  heatmap: SiteHeatCell[];
  match_days: SiteMatchDayStats;
  sections: SiteBreakdownRow[];
  top_pages: SiteBreakdownRow[];
  top_matches: SiteMatchReach[];
  top_news: SiteBreakdownRow[];
  top_players: SiteBreakdownRow[];
  top_teams: SiteBreakdownRow[];
  ticket_funnel: SiteTicketFunnel;
  sources: SiteBreakdownRow[];
  campaigns: SiteBreakdownRow[];
  countries: SiteBreakdownRow[];
  devices: SiteBreakdownRow[];
  browsers: SiteBreakdownRow[];
  oses: SiteBreakdownRow[];
  actions: SiteBreakdownRow[];
  conversions: SiteConversions;
}

export interface SiteEvent {
  id: number;
  created_at: string;
  event_type: string;
  source: "web" | "api";
  path: string;
  is_entry: boolean;
  referrer_host: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  session_id: string;
  ip: string;
  country: string;
  device_type: string;
  browser: string;
  os: string;
  is_bot: boolean;
  user_agent: string;
  properties: Record<string, unknown> | null;
}

export interface SiteEventsPage {
  events: SiteEvent[];
  total: number;
  page: number;
  limit: number;
}

export interface SiteRange {
  from?: string;
  to?: string;
}
