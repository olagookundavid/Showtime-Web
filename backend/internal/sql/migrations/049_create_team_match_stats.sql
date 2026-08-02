-- +goose Up

-- Team-only stats: tracked at team level, not derived from any single player's
-- line. Populated per match from the play log when stats are committed, and
-- merged into the team stats view alongside the player-stat rollups.
--   punts        — punts by the team
--   first_downs  — first downs (incl. first-and-goal) achieved on offense
--   turnovers    — interceptions + turnovers on downs, charged to the team that lost the ball
--   penalties    — penalties committed
--   penalty_yards— total penalty yards
--   total_plays  — offensive plays from scrimmage (pass + run)
CREATE TABLE IF NOT EXISTS team_match_stats (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id        UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    match_id       UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    competition_id UUID REFERENCES competitions(id) ON DELETE CASCADE,
    match_date     DATE,
    punts          INTEGER NOT NULL DEFAULT 0,
    first_downs    INTEGER NOT NULL DEFAULT 0,
    turnovers      INTEGER NOT NULL DEFAULT 0,
    penalties      INTEGER NOT NULL DEFAULT 0,
    penalty_yards  INTEGER NOT NULL DEFAULT 0,
    total_plays    INTEGER NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (team_id, match_id)
);

CREATE INDEX IF NOT EXISTS idx_team_match_stats_comp ON team_match_stats (competition_id, match_date);

-- +goose Down
DROP INDEX IF EXISTS idx_team_match_stats_comp;
DROP TABLE IF EXISTS team_match_stats;
