-- +goose Up

CREATE TABLE IF NOT EXISTS competition_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_competition_team UNIQUE(competition_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_competition_teams_comp ON competition_teams(competition_id);
CREATE INDEX IF NOT EXISTS idx_competition_teams_team ON competition_teams(team_id);

-- Seed competition_teams from existing matches and standings so current comps aren't emptied!
INSERT INTO competition_teams (competition_id, team_id)
SELECT DISTINCT competition_id, home_team_id AS team_id
FROM matches
WHERE competition_id IS NOT NULL AND home_team_id IS NOT NULL
ON CONFLICT (competition_id, team_id) DO NOTHING;

INSERT INTO competition_teams (competition_id, team_id)
SELECT DISTINCT competition_id, away_team_id AS team_id
FROM matches
WHERE competition_id IS NOT NULL AND away_team_id IS NOT NULL
ON CONFLICT (competition_id, team_id) DO NOTHING;

INSERT INTO competition_teams (competition_id, team_id)
SELECT DISTINCT competition_id, team_id
FROM standings
WHERE competition_id IS NOT NULL AND team_id IS NOT NULL
ON CONFLICT (competition_id, team_id) DO NOTHING;

-- +goose Down
DROP TABLE IF EXISTS competition_teams;
