-- +goose Up

-- Leaving a league marks the membership rather than deleting it.
--
-- A manager who paid an entry fee and then leaves forfeits that fee: the money
-- has already been collected and belongs to the prize pool. Deleting the row
-- would shrink the pool and quietly reduce everyone else's winnings, so the row
-- stays and is stamped instead. Every member-facing query excludes stamped
-- rows; the pool calculation deliberately still counts them.
--
-- Keeping the row also preserves the (league_id, user_id) uniqueness, so
-- rejoining a free league is simply clearing the stamp.
ALTER TABLE fantasy_league_members
    ADD COLUMN IF NOT EXISTS left_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_fantasy_league_members_active
    ON fantasy_league_members (league_id)
    WHERE left_at IS NULL;

-- +goose Down
DROP INDEX IF EXISTS idx_fantasy_league_members_active;
ALTER TABLE fantasy_league_members DROP COLUMN IF EXISTS left_at;
