-- +goose Up

-- "Uncatchable" is a new incomplete-pass reason (a bad throw, charged to the QB,
-- with no catchable target) — alongside the existing dropped / batted_down flags.
ALTER TABLE game_plays
    ADD COLUMN IF NOT EXISTS uncatchable BOOLEAN NOT NULL DEFAULT FALSE;

-- +goose Down
ALTER TABLE game_plays
    DROP COLUMN IF EXISTS uncatchable;
