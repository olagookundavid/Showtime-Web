-- +goose Up
ALTER TABLE matches ADD COLUMN IF NOT EXISTS mvp_player_id UUID REFERENCES players(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_matches_mvp_player_id ON matches(mvp_player_id);

-- +goose Down
DROP INDEX IF EXISTS idx_matches_mvp_player_id;
ALTER TABLE matches DROP COLUMN IF EXISTS mvp_player_id;
