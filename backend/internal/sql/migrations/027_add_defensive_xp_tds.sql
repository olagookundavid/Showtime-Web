-- +goose Up
-- Defensive extra-point touchdown: an interception on an extra-point attempt
-- returned by the defense for a score. Present in the legacy stat exports as
-- "Defensive TDs XP" but previously had no column, so it was dropped on import.
ALTER TABLE player_stats
ADD COLUMN IF NOT EXISTS defensive_xp_tds INT DEFAULT 0;

-- +goose Down
ALTER TABLE player_stats
DROP COLUMN IF EXISTS defensive_xp_tds;
