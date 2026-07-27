-- +goose Up
CREATE TABLE IF NOT EXISTS player_team_history (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id  UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    team_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    joined_at  DATE,
    left_at    DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_team_history_player ON player_team_history(player_id);
CREATE INDEX IF NOT EXISTS idx_player_team_history_team   ON player_team_history(team_id);

-- +goose Down
DROP INDEX IF EXISTS idx_player_team_history_team;
DROP INDEX IF EXISTS idx_player_team_history_player;
DROP TABLE IF EXISTS player_team_history;
