-- +goose Up
CREATE TABLE team_of_the_week (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    event_day_date DATE NOT NULL,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    position_group VARCHAR(10) NOT NULL CHECK (position_group IN ('QB', 'WR', 'DEF')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (competition_id, event_day_date, player_id)
);

CREATE INDEX idx_totw_comp_date ON team_of_the_week (competition_id, event_day_date);

-- +goose Down
DROP TABLE IF EXISTS team_of_the_week;
