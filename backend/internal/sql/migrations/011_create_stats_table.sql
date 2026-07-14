-- +goose Up
CREATE TABLE player_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    match_date DATE NOT NULL,

    passing_attempts INT DEFAULT 0,
    rushing_attempts INT DEFAULT 0,
    completed_passes INT DEFAULT 0,
    passing_tds INT DEFAULT 0,
    rushing_tds INT DEFAULT 0,
    interceptions_thrown INT DEFAULT 0,
    receptions INT DEFAULT 0,
    receiving_tds INT DEFAULT 0,
    extra_points_tds INT DEFAULT 0,
    drops INT DEFAULT 0,
    flag_pulls INT DEFAULT 0,
    pass_deflections INT DEFAULT 0,
    interceptions INT DEFAULT 0,
    defensive_tds INT DEFAULT 0,
    safety INT DEFAULT 0,
    qb_sacks INT DEFAULT 0,
    def_sacks INT DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(player_id, competition_id, match_date)
);

CREATE INDEX idx_player_stats_comp_date ON player_stats(competition_id, match_date);
CREATE INDEX idx_player_stats_team ON player_stats(team_id);
CREATE INDEX idx_player_stats_date ON player_stats(match_date);

-- +goose Down
DROP TABLE IF EXISTS player_stats;
