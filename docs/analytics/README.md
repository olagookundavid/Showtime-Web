# Visitor analytics (first-party)

Our own traffic tracking: every page view and meaningful action is saved to our
Postgres database and shown to admins on **Admin → Traffic** (`/admin/traffic`).
Admins can download CSV reports to share with the rest of the team.

This sits beside two third-party tools. Nothing here replaces them:

| Tool | What it is for | Where it lives |
|---|---|---|
| **This system (site_events)** | Our own record of visits and actions. We own the data, keep it forever, export it. | Postgres + `/admin/traffic` |
| **Vercel Web Analytics** | Quick aggregate dashboard in Vercel. Fully automatic: the `<Analytics />` component in `App.tsx` is all it needs. | Vercel dashboard |
| **Brevo tracker** | Ties page visits to newsletter *contacts* for email automation. Not a traffic counter. | `components/analytics/BrevoTracker.tsx`, Brevo dashboard |

## What it does and does not do

- Counts **page views**, **unique visitors (distinct IP addresses)** and **sessions** (one per browser tab visit).
- Records where a visit came from (referrer site and `utm_*` link tags), country, device, browser and OS.
- Records actions: logins, sign-ups, ticket and store checkouts started, newsletter sign-ups, add to cart.
- Shows **conversions** (new accounts, paid tickets, paid store orders, revenue) straight from the `users`, `tickets` and `online_orders` tables, not from the event stream. They are exact, cannot double count webhook retries, and cover history from before tracking existed.
- **Anonymous by design.** No user id is stored on any event. Admin-panel pages are never tracked.
- Retention: **forever** (owners' decision). See "Known limitations" for growth.

## How it works

```
Browser                                   API (Go)                          Postgres
-------                                   --------                          --------
PageViewTracker (route change) ──┐
trackEvent() (newsletter, cart) ─┴─► POST /api/v1/events  ──► site_events ◄── admin queries
                                          validates, strips query            ▲
Login / sign-up / checkout requests ──► TrackOnSuccess(...) middleware ──────┘   GET /api/v1/admin/site-analytics/*
                                          (only when the response is 2xx)            summary | events | export (CSV)
```

1. **Browser beacon** (`frontend/src/services/siteTracker.ts`). On every React Router navigation `PageViewTracker` calls `trackPageView(pathname)`. It posts JSON to `${VITE_API_URL}/events` with `Content-Type: text/plain` (a CORS "simple request", so there is no preflight before every page view) and `keepalive: true`. Failures are swallowed; analytics never shows an error to a visitor.
2. **Public endpoint** `POST /api/v1/events` (`transport/site_events_handler.go`). Rate limited to 120/min per IP, body capped at 8 KB, event type must be on an allowlist (`domain.BrowserEventTypes`). Browsers can never submit `login`, `signup` or checkout events, so those cannot be forged.
3. **Server-side events.** `SiteEventsHandler.TrackOnSuccess("<name>")` is middleware attached to the `register`, `login`, ticket `purchase` and store `checkout` routes in `routes/routes.go`. It records an event only when the wrapped handler answers 2xx, so failed logins are not counted.
4. **Batched storage** (`site_events`, migration `111_create_site_events.sql`). The request only validates the event and hands it to the shared worker pool (`services.SubmitJob`), then returns. The worker passes it to the same batch writer the audit log uses (`go-batchify`), which writes **one bulk `COPY` per 200 events or every 30 seconds**, whichever comes first (`siteEventsBatchSize` / `siteEventsFlushInterval` in `services/site_events_service.go`).
   - Each event's time is stamped when it happens, not when the batch is written, so the delay never moves a visit into the wrong hour or day.
   - New visits therefore show up on the dashboard within about 30 seconds.
   - On a graceful shutdown (`SIGTERM`), `server.shutdown` closes the batcher before the database pool, so waiting events are written, not lost. A hard kill (`SIGKILL`, crash) loses at most the last 30 seconds.
   - `batcher.Do` holds its worker until the batch is written; the 200-event cap means at most ~200 of the pool's 1,000 workers are ever waiting on analytics.
   - Best effort: if the worker pool is saturated, the event is dropped and logged rather than slowing a request.
5. **Admin API** under `/api/v1/admin/site-analytics`, gated by the `dashboard` feature, which is **admin and app_admin only** (see `middlewares/permissions.go`).

### What the server works out for itself

- **IP**: `CF-Connecting-IP` (Cloudflare overwrites it with the real visitor, and the origin only accepts Cloudflare's ranges so it cannot be spoofed), falling back to the socket address.
- **Country**: `CF-IPCountry`. `XX` (unknown) and `T1` (Tor) are stored as empty.
- **Device, browser, OS, bot flag**: parsed from the `User-Agent` in `services/useragent.go` (plain string matching, covered by tests). Bots are stored with `is_bot = true` and excluded from every statistic by default.
- **Path**: only the path is kept. Query strings and fragments are dropped, because they can carry tokens (password reset, email verification).

## Data model

Table `site_events` (one row per event):

| Column | Meaning |
|---|---|
| `created_at` | When it happened (UTC `timestamptz`). Reports bucket days in **Africa/Lagos**. |
| `event_type` | `page_view`, `login`, `signup`, `ticket_checkout_started`, `store_checkout_started`, `newsletter_signup`, `add_to_cart`, `outbound_click`, `share` |
| `source` | `web` (browser beacon) or `api` (recorded by the server) |
| `path` | Page path, or the API route for server events |
| `is_entry` | True on the first page view of a browser session. Referrer and UTM fields are filled **only** on these rows, so "where visits come from" counts visits, not every page. |
| `referrer_host`, `utm_source`, `utm_medium`, `utm_campaign` | Attribution (entry rows only). `utm_source` wins over `referrer_host` when both exist. |
| `session_id` | Random id kept in `sessionStorage`. Dies with the tab. Not a cookie, not tied to a person. |
| `ip`, `country` | Visitor IP and ISO country |
| `device_type`, `browser`, `os`, `user_agent`, `is_bot` | Parsed from the User-Agent |
| `properties` | Small JSON bag (max 20 keys, 2 KB), e.g. `{ "product_id": "..." }`. **Never put personal data in it.** |

Indexes: `created_at`; `(event_type, created_at)`; `(path, created_at)` for page views; `(ip, created_at)` for page views by humans (powers "returning visitors").

## Admin API

All `GET`, all under `/api/v1/admin/site-analytics`, all take `from` and `to` as inclusive `YYYY-MM-DD` dates in Lagos time. Omit `from` for "since 2020"; omit `to` for "through today".

| Endpoint | Returns |
|---|---|
| `/summary` | Totals, the previous period (when `from` is given), daily series with match days marked (gaps zero-filled up to ~3 years), monthly series, weekday x hour heatmap, match-day stats, site sections, top pages with titles, sources, campaigns, countries, devices, browsers, OS, actions, conversions |
| `/events?page=&limit=&type=&include_bots=` | Raw rows, newest first, paginated (limit max 200) |
| `/export?kind=summary` | The **audience report** CSV: headline figures vs the previous period, match-day uplift, monthly and daily tables, busiest times, top pages with titles, sections, sources, geography, devices. Built to paste into a sponsorship deck or hand to an analyst. |
| `/export?kind=events` | Every raw row in the range as CSV, streamed (safe for very large ranges) |

CSV notes: UTF-8 with a byte-order mark so Excel opens it correctly, and any cell starting with `=`, `+`, `-`, `@` is prefixed with `'` so a malicious page path or campaign name cannot run as a spreadsheet formula.

## Frontend files

| File | Role |
|---|---|
| `src/services/siteTracker.ts` | The beacon: `trackPageView`, `trackEvent`, session id, entry/referrer/UTM capture |
| `src/components/analytics/PageViewTracker.tsx` | Mounted once in `App.tsx`; reports route changes |
| `src/pages/admin/AdminTraffic.tsx` | The dashboard page |
| `src/components/analytics/TrafficChart.tsx` | Line chart (page views solid, visitors dashed so both stay visible when they overlap) |
| `src/components/analytics/RankedBarList.tsx` | The ranked lists (shows a page title with its path underneath) |
| `src/components/analytics/MetricCard.tsx` | Headline number with a "vs previous period" change (percent, or points for rates) |
| `src/components/analytics/TrafficHeatmap.tsx` | Weekday x hour heatmap, single-hue blue ramp, fits a phone screen |
| `src/types/siteAnalytics.ts` | API types |
| `src/services/api.ts` | `getSiteTrafficSummary`, `getSiteEvents`, `downloadSiteTrafficExport` |
| `src/components/admin/adminNav.ts` | "Traffic" sidebar link |

The tracker is **production-only** (`import.meta.env.PROD`) so local development never pollutes the table. It respects the browser's Do Not Track setting. Set `VITE_SITE_ANALYTICS_DISABLED=true` to switch it off in a production build.

Backend files: `domain/site_event.go`, `dto/site_analytics.go`, `ports/site_events_repo.go`, `services/site_events_service.go`, `services/useragent.go`, `transport/site_events_handler.go`, plus wiring in `handlers/handlers.go`, `cmd/main/main_setup.go`, `routes/routes.go`.

## The dashboard (Admin → Traffic)

Admin and app admin only. One period picker (last 7/30/90 days, all time, custom) drives everything; every preset except "All time" is compared with the same-length period just before it.

- **Overview**: audience reach, engagement, visits over time (match days marked), match-day uplift, what visitors did (accounts, tickets, store orders), month by month.
- **Audience**: new vs returning, when people visit (heatmap), countries, devices, browsers, operating systems.
- **Content & sources**: site sections, top pages (news headlines, "Home vs Away" for matches, player/team/product names), where visits come from, campaigns, actions.
- **Every event**: the raw rows, filterable by event type, with or without bots.

## What each number means

Give analysts and sponsors these definitions alongside any figure you quote.

| Metric | Definition |
|---|---|
| Unique visitors | Distinct IP addresses that viewed at least one page in the period. Undercounts people behind shared networks (see limitations). |
| Average daily visitors | Mean of each day's unique visitors, from the first day with data in the period. Higher than "unique visitors / days" because the same person on two days counts on both. |
| Page views | Every page shown, including in-app navigation. |
| Visits (sessions) | One per browser tab visit (random id in `sessionStorage`). |
| Pages per visit | Page views / visits. |
| Bounce rate | Share of visits that saw exactly one page. Lower is better. Changes are shown in percentage points. |
| New / returning visitors | Returning = the IP also viewed a page **before** the period began. In the first weeks after launch almost everyone is "new" because there is no history yet. |
| Match-day uplift | Average daily visitors on days with a fixture (not cancelled/postponed) divided by the average on other days, within the period. |
| Busiest times | Page views per weekday-hour slot, Lagos time. |
| Site sections | Page views grouped by the first part of the path (`/news/...` is News, `/` is Home). |
| Sources | Where a visit started: the `utm_source` tag if the link had one, else the referring site, else "Direct". Counted once per visit. |
| Conversions | New accounts, paid tickets and paid store orders from the platform's own tables, not from tracking. Exact. |
| Change vs previous period | `(this - previous) / previous`. Shows "No data for the previous period" when there is nothing to compare with. |

## How to add a new tracked event

- **A browser-side action** (a click, a share): add the name to `BrowserEventTypes` in `backend/internal/domain/site_event.go` **and** to the `TrackableEvent` union in `siteTracker.ts`, add a label in `EVENT_LABELS` in `AdminTraffic.tsx`, then call `trackEvent('name', { small: 'props' })` where it happens.
- **A server-side action** (something an API request completes): add `app.Handlers.SiteEventsHandler.TrackOnSuccess("name")` before the handler in `routes/routes.go`, and add a label in `EVENT_LABELS`.
- **A payment that completes later** (webhook): do not add an event. Count it from the source table in `Conversions` (`ports/site_events_repo.go`). Webhooks and verify calls can both fire for one payment.

## Deploying

1. **Backend first.** Migration `111` creates the table; it runs automatically on boot (`AUTO_MIGRATE`, default on) or with `make db/up` if you run migrations as a separate step.
2. Then the frontend. (If the frontend ships first the beacon just gets 404s, which are ignored.)
3. In Cloudflare, confirm the `api.` hostname is proxied (orange cloud) and **IP Geolocation** is on, otherwise `CF-IPCountry` is missing and every visitor shows as "Unknown" country. Caddy passes both headers through untouched.
4. Open the live site, click around, and check **Admin → Traffic** after a minute.

## Tests

- `go test ./internal/services/ ./internal/transport/`: sanitising (paths, referrers, countries, properties), UA parsing, date ranges, CSV injection, handler behaviour (accepts valid, rejects forged/oversized, records only on 2xx).
- `tests/integration/site_events_repo_integration_test.go` runs every report query against a real, fully migrated database. It needs `TEST_DB_DSN` (see the header of `fantasy_repo_integration_test.go`). Its fixtures live in January 2001 and are cleaned up before and after, so it is safe on a database that has real analytics.

## Known limitations (read before trusting a number)

- **Visitors are counted by IP, as requested.** Many Nigerian mobile networks put thousands of phones behind one address (carrier NAT), and a household or venue shares one Wi-Fi, so **unique visitors is an underestimate**. Sessions and page views are not affected. A person on mobile data and Wi-Fi counts twice.
- **Ad blockers and "Do Not Track" hide some visitors.** Expect real traffic to be somewhat higher than shown. Because the beacon goes to our own API domain it is blocked far less often than Google Analytics would be.
- **The first-visit source is captured once per browser tab.** Opening the site in a new tab starts a new session.
- **Bots that run JavaScript** and use a normal browser User-Agent will look like visitors. Obvious crawlers and monitors are filtered by User-Agent.
- **Retention is forever, so the table only grows.** At 100,000 page views a month that is roughly 0.5 GB a year including indexes, which is comfortable. If traffic grows 10x or more, add a nightly roll-up table (daily counts per page/source/country) and let the dashboard read from it for old ranges, keeping the raw rows for the export.
- **Today is incomplete** until the day ends, and the current month until it ends; the dashboard says so.
- **Up to ~30 seconds behind.** Events are written in batches.
- **"Returning visitors" needs history.** It only becomes meaningful a few weeks after tracking starts.
- **Paid orders only.** Conversions count `PAID`/`USED` tickets (including free and team-allocated tickets, matching the existing sales analytics) and `paid` store orders.

## Privacy and legal

IP addresses are **personal data** under Nigeria's Data Protection Act (NDPA 2023) and under GDPR for any European visitors. Storing them indefinitely is the owners' decision, but the public privacy policy (`frontend/src/pages/about/PrivacyPolicy.tsx`) currently only mentions "advertising and analytics partners". It should be updated to say that the site records visitors' IP address, approximate country, device type and pages viewed, keeps them, and why. Review that wording with whoever advises on legal matters. If the retention rule is ever relaxed, deleting old rows is a single statement: `DELETE FROM site_events WHERE created_at < NOW() - INTERVAL '2 years';`.

## Ideas not built yet

- Live "visitors right now" panel (needs a short-window query or websocket).
- Funnel view (visit, ticket page, checkout started, paid) once there is enough data to justify it.
- Scheduled email of the weekly summary CSV to the team.
- Daily roll-up table (see retention above).
- Optional hashing or truncating of old IPs if the legal position changes.
