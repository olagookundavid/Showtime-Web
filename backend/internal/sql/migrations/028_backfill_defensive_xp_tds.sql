-- +goose Up
-- Belt-and-suspenders: ensure no existing player_stats row has a NULL
-- defensive_xp_tds. Migration 027 added the column with DEFAULT 0 (which
-- backfills existing rows), but this guarantees 0 everywhere even if the
-- column was added some other way, so the stat reads as 0 rather than blank.
UPDATE player_stats SET defensive_xp_tds = 0 WHERE defensive_xp_tds IS NULL;
ALTER TABLE player_stats ALTER COLUMN defensive_xp_tds SET DEFAULT 0;

-- +goose Down
-- No-op: leaving the values in place is harmless.
SELECT 1;
