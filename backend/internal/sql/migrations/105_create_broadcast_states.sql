-- +goose Up
-- Persisted on-air broadcast state per match, so the studio survives a backend
-- restart. The in-memory hub stays the source for live fan-out; this table is
-- written behind it.
CREATE TABLE IF NOT EXISTS broadcast_states (
    match_id UUID PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
    state JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- +goose Down
DROP TABLE IF EXISTS broadcast_states;
