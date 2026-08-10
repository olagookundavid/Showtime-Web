-- +goose Up

-- A snap happens before every pass-flow play; tracking who snapped it (and
-- whether it was clean) is a new internal stat input, not a box-score column.
-- Bad Snap is a new pragmatic play_type extension (domain.PlayTypeCodes
-- ["BADSNAP"]) that reuses the existing "DB" (Dead Ball) result code — the
-- play ends at the spot, down advances normally, no turnover, exactly what
-- "DB" already means for other dead-ball plays.
ALTER TABLE game_plays
    ADD COLUMN IF NOT EXISTS center_id UUID REFERENCES players(id) ON DELETE SET NULL;

ALTER TABLE player_stats
    ADD COLUMN IF NOT EXISTS snaps     INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS bad_snaps INTEGER NOT NULL DEFAULT 0;

-- +goose Down
ALTER TABLE game_plays
    DROP COLUMN IF EXISTS center_id;

ALTER TABLE player_stats
    DROP COLUMN IF EXISTS snaps,
    DROP COLUMN IF EXISTS bad_snaps;
