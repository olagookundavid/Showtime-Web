-- +goose Up

-- Explicit "batted down" flag for an incomplete pass. Previously a Pass
-- Deflection was credited just because a defender's name was filled in on an
-- incomplete pass, even if they were only in coverage and never touched the
-- ball. This makes "the ball was actually batted/tipped" its own fact, and
-- lets the public timeline call it out (e.g. "Incomplete — batted down by
-- #55") instead of a plain "Incomplete".
ALTER TABLE game_plays
    ADD COLUMN IF NOT EXISTS batted_down BOOLEAN NOT NULL DEFAULT FALSE;

-- +goose Down

ALTER TABLE game_plays
    DROP COLUMN IF EXISTS batted_down;
