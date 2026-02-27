-- +goose Up
-- Creates the team_managers junction table to link team_head users to teams

CREATE TABLE IF NOT EXISTS team_managers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)  -- A user can only manage ONE team
);

CREATE INDEX IF NOT EXISTS idx_team_managers_user ON team_managers(user_id);
CREATE INDEX IF NOT EXISTS idx_team_managers_team ON team_managers(team_id);

-- +goose Down
DROP TABLE IF EXISTS team_managers;
