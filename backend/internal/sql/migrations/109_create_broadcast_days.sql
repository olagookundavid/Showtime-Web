-- +goose Up
-- Event-day broadcast channels. A live stream covers a whole match day, so vMix
-- loads one overlay link per day and the producer chooses which of that day's
-- matches it shows. A day is its date (event_days are a ticketing record and not
-- every match day has one). Saved so a backend restart keeps the on-air match.
CREATE TABLE IF NOT EXISTS broadcast_days (
    date DATE PRIMARY KEY,
    on_air_match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- +goose Down
DROP TABLE IF EXISTS broadcast_days;
