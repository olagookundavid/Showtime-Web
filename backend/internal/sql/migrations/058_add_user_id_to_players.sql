-- +goose Up
ALTER TABLE players ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_user_id ON players(user_id) WHERE user_id IS NOT NULL;

-- +goose Down
DROP INDEX IF EXISTS idx_players_user_id;
ALTER TABLE players DROP COLUMN IF EXISTS user_id;
