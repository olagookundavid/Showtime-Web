-- +goose Up
-- First-party visitor analytics. One row per page view or tracked action.
-- Anonymous by design: no user id is stored, only the request's IP address
-- (as requested by the product owners) and a random per-tab session id.
-- Retained indefinitely; see docs/analytics/README.md.
CREATE TABLE IF NOT EXISTS site_events (
    id            BIGSERIAL PRIMARY KEY,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    event_type    VARCHAR(64)  NOT NULL,
    -- 'web' = reported by the browser beacon, 'api' = recorded by the server
    -- when a meaningful request succeeded (login, sign-up, checkout started).
    source        VARCHAR(16)  NOT NULL DEFAULT 'web',
    path          VARCHAR(512),
    -- True on the first page view of a browser session; referrer and UTM
    -- fields are only populated there, so "top sources" counts visits.
    is_entry      BOOLEAN      NOT NULL DEFAULT FALSE,
    referrer_host VARCHAR(255),
    utm_source    VARCHAR(128),
    utm_medium    VARCHAR(128),
    utm_campaign  VARCHAR(128),
    session_id    VARCHAR(64),
    ip            VARCHAR(45),
    country       VARCHAR(2),
    device_type   VARCHAR(16),
    browser       VARCHAR(32),
    os            VARCHAR(32),
    is_bot        BOOLEAN      NOT NULL DEFAULT FALSE,
    user_agent    VARCHAR(512),
    properties    JSONB        NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_site_events_created_at ON site_events (created_at);
CREATE INDEX IF NOT EXISTS idx_site_events_type_created ON site_events (event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_site_events_path_created ON site_events (path, created_at) WHERE event_type = 'page_view';
-- "Returning visitors" asks whether an IP was seen before the period starts.
CREATE INDEX IF NOT EXISTS idx_site_events_ip_created ON site_events (ip, created_at) WHERE event_type = 'page_view' AND NOT is_bot;

-- +goose Down
DROP TABLE IF EXISTS site_events;
