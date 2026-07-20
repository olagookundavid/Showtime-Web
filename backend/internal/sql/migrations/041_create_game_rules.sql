-- +goose Up

-- Per-competition scoring/format rules for the play-by-play engine. Values are
-- placeholders from the design doc until the commissioner confirms the real
-- rules — editable in the admin UI, one row per competition. The scoring engine
-- reads these to turn the play log into a running score.
CREATE TABLE IF NOT EXISTS game_rules (
    competition_id      UUID PRIMARY KEY REFERENCES competitions(id) ON DELETE CASCADE,
    td_points           INT NOT NULL DEFAULT 6,
    xp_run_points       INT NOT NULL DEFAULT 1,
    xp_pass_points      INT NOT NULL DEFAULT 2,
    safety_points       INT NOT NULL DEFAULT 2,
    def_return_points   INT NOT NULL DEFAULT 6,   -- points for a returned INT/blocked XP
    downs_per_series    INT NOT NULL DEFAULT 4,
    yards_to_first_down INT NOT NULL DEFAULT 10,
    first_down_model    TEXT NOT NULL DEFAULT 'yardage',  -- 'yardage' | 'zone'
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- +goose Down
DROP TABLE IF EXISTS game_rules;
