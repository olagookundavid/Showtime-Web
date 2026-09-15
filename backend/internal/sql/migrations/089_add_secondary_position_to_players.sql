-- +goose Up
ALTER TABLE players
    ADD COLUMN IF NOT EXISTS secondary_position VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_players_secondary_pos ON players(secondary_position) WHERE secondary_position IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_position ON players(position);

-- +goose Down
DROP INDEX IF EXISTS idx_players_position;
DROP INDEX IF EXISTS idx_players_secondary_pos;
ALTER TABLE players
    DROP COLUMN IF EXISTS secondary_position;
