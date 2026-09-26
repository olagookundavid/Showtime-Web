-- +goose Up

-- Locking a lineup is supposed to freeze everything scoring depends on, the
-- same way purchase_price already freezes the price. Without this column,
-- ComputeGameweekScores instead reads the player's *current* position/
-- secondary_position every time it (re)runs, so an admin correcting a
-- player's role after a gameweek has already been scored silently rewrites
-- that gameweek's historical points on the next re-finalize.
ALTER TABLE fantasy_lineup_picks
    ADD COLUMN IF NOT EXISTS is_allrounder_at_lock BOOLEAN;

-- +goose Down
ALTER TABLE fantasy_lineup_picks
    DROP COLUMN IF EXISTS is_allrounder_at_lock;
