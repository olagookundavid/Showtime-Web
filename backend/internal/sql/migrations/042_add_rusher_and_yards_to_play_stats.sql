-- +goose Up

-- Migration 042: Add rusher_id to game_plays and yardage fields to player_stats

ALTER TABLE game_plays
    ADD COLUMN IF NOT EXISTS rusher_id UUID REFERENCES players(id) ON DELETE SET NULL;

ALTER TABLE player_stats
    ADD COLUMN IF NOT EXISTS passing_yards INTEGER DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS rushing_yards INTEGER DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS receiving_yards INTEGER DEFAULT 0 NOT NULL;

-- +goose Down

ALTER TABLE player_stats
    DROP COLUMN IF EXISTS passing_yards,
    DROP COLUMN IF EXISTS rushing_yards,
    DROP COLUMN IF EXISTS receiving_yards;

ALTER TABLE game_plays
    DROP COLUMN IF EXISTS rusher_id;
