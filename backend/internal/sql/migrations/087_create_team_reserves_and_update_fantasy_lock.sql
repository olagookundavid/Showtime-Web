-- +goose Up
-- Team Reserves table: stores players currently relegated to the reserve squad.
-- Capped at 25 for main team; reserves can have unlimited players.
CREATE TABLE IF NOT EXISTS team_reserves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    player_id UUID NOT NULL UNIQUE REFERENCES players(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_team_reserves_team ON team_reserves(team_id);
CREATE INDEX IF NOT EXISTS idx_team_reserves_player ON team_reserves(player_id);

-- Update Fantasy Season Lock Window default from 15 minutes to 12 hours (720 minutes)
ALTER TABLE fantasy_seasons ALTER COLUMN lock_mins_before SET DEFAULT 720;
UPDATE fantasy_seasons SET lock_mins_before = 720 WHERE lock_mins_before = 15;

-- +goose Down
DROP INDEX IF EXISTS idx_team_reserves_player;
DROP INDEX IF EXISTS idx_team_reserves_team;
DROP TABLE IF EXISTS team_reserves;
ALTER TABLE fantasy_seasons ALTER COLUMN lock_mins_before SET DEFAULT 15;
