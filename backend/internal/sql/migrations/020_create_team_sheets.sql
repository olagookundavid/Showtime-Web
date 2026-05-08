-- +goose Up

-- 1. Link event_days -> matches
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS event_day_id UUID NULL REFERENCES event_days(id) ON DELETE SET NULL;

-- 2. Team Sheet table
CREATE TABLE IF NOT EXISTS match_team_sheets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id    UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(match_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_team_sheets_match ON match_team_sheets(match_id);
CREATE INDEX IF NOT EXISTS idx_team_sheets_player ON match_team_sheets(player_id);

-- 3. Tighten player_stats: use match_id as the unique key
ALTER TABLE player_stats
DROP CONSTRAINT IF EXISTS player_stats_player_id_competition_id_match_date_key;

ALTER TABLE player_stats
ADD COLUMN IF NOT EXISTS match_id UUID NULL REFERENCES matches(id) ON DELETE CASCADE;

-- One stat entry per player per match (guarded to be idempotent)
-- +goose StatementBegin
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_player_stats_player_match'
    ) THEN
        ALTER TABLE player_stats
        ADD CONSTRAINT uq_player_stats_player_match UNIQUE(player_id, match_id);
    END IF;
END$$;
-- +goose StatementEnd

CREATE INDEX IF NOT EXISTS idx_player_stats_match ON player_stats(match_id);

-- +goose Down
DROP INDEX IF EXISTS idx_player_stats_match;

ALTER TABLE player_stats
DROP CONSTRAINT IF EXISTS uq_player_stats_player_match;

ALTER TABLE player_stats
DROP COLUMN IF EXISTS match_id;

ALTER TABLE player_stats
ADD CONSTRAINT player_stats_player_id_competition_id_match_date_key UNIQUE(player_id, competition_id, match_date);

DROP INDEX IF EXISTS idx_team_sheets_player;
DROP INDEX IF EXISTS idx_team_sheets_match;

DROP TABLE IF EXISTS match_team_sheets;

ALTER TABLE matches
DROP COLUMN IF EXISTS event_day_id;
