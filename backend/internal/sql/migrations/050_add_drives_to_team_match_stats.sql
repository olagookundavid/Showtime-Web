-- +goose Up
ALTER TABLE team_match_stats ADD COLUMN IF NOT EXISTS drives INTEGER NOT NULL DEFAULT 0;

-- +goose Down
ALTER TABLE team_match_stats DROP COLUMN IF EXISTS drives;
