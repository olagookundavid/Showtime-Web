-- +goose Up
-- Team of the Week is being removed: it was never used, its admin and public
-- pages are gone, and the table does not exist in every environment (production
-- never had it), which made scripts that assumed it was there fail outright.
--
-- Migrations 016 and 021 are left untouched — they are applied history. This
-- drops the table forward instead of rewriting the past.
DROP INDEX IF EXISTS idx_totw_event_day;
DROP INDEX IF EXISTS idx_totw_comp_date;
DROP TABLE IF EXISTS team_of_the_week;

-- +goose Down
-- Recreates the table as migrations 016 and 021 left it, so a rollback lands
-- on the same shape it had before this migration ran.
CREATE TABLE IF NOT EXISTS team_of_the_week (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    event_day_date DATE NOT NULL,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    position_group VARCHAR(10) NOT NULL CHECK (position_group IN ('QB', 'WR', 'DEF')),
    event_day_id UUID REFERENCES event_days(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (competition_id, event_day_date, player_id)
);

CREATE INDEX IF NOT EXISTS idx_totw_comp_date ON team_of_the_week (competition_id, event_day_date);
CREATE INDEX IF NOT EXISTS idx_totw_event_day ON team_of_the_week (event_day_id);
