-- +goose Up

-- Expanded player stats from the league's stat-assignment sheet (2026-08). Adds
-- the incomplete-pass breakdown (incomplete / uncatchable / thrown-away / batted-
-- down passes), targets, the extra-point attempt/good/fail split, and safety
-- conceded. "Complete Pass" reuses the existing completed_passes column; "XP TD"
-- reuses extra_points_tds; Punt is a TEAM stat (see team_match_stats), not here.
ALTER TABLE player_stats
    ADD COLUMN IF NOT EXISTS incomplete_passes   INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS uncatchable_passes  INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS thrown_away_passes  INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS batted_down_passes  INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS targets             INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS xp_attempts         INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS xp_good             INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS xp_fail             INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS safety_conceded     INTEGER NOT NULL DEFAULT 0;

-- +goose Down
ALTER TABLE player_stats
    DROP COLUMN IF EXISTS incomplete_passes,
    DROP COLUMN IF EXISTS uncatchable_passes,
    DROP COLUMN IF EXISTS thrown_away_passes,
    DROP COLUMN IF EXISTS batted_down_passes,
    DROP COLUMN IF EXISTS targets,
    DROP COLUMN IF EXISTS xp_attempts,
    DROP COLUMN IF EXISTS xp_good,
    DROP COLUMN IF EXISTS xp_fail,
    DROP COLUMN IF EXISTS safety_conceded;
