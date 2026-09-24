-- +goose Up
-- Migration 098: Add Player of the Week (POTW) role to Team of the Week and badge system

-- 1. Add player_of_the_week_id to team_of_the_week
ALTER TABLE team_of_the_week 
ADD COLUMN IF NOT EXISTS player_of_the_week_id UUID REFERENCES players(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_totw_player_of_the_week ON team_of_the_week(player_of_the_week_id);

-- 2. Add is_player_of_the_week flag to team_of_the_week_players
ALTER TABLE team_of_the_week_players 
ADD COLUMN IF NOT EXISTS is_player_of_the_week BOOLEAN NOT NULL DEFAULT false;

-- 3. Update unique constraint on player_badge_awards for TOTW awards:
-- Previously: idx_unique_totw_player ON (totw_id, player_id)
-- Allow distinct badges (e.g. TOTW and POTW) for the same player on the same TOTW edition
DROP INDEX IF EXISTS idx_unique_totw_player;
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_badge_totw_player 
ON player_badge_awards(badge_id, totw_id, player_id) 
WHERE totw_id IS NOT NULL;

-- 4. Seed system badge for Player of the Week
INSERT INTO badges (code, name, description, icon, category, color_scheme, is_system) VALUES
('POTW', 'Player of the Week', 'Selected as the standout Player of the Week in the Showtime Team of the Week', '⭐', 'Weekly Honor', 'gold', true)
ON CONFLICT (code) DO UPDATE SET is_system = EXCLUDED.is_system;

-- +goose Down
DELETE FROM badges WHERE code = 'POTW';
DROP INDEX IF EXISTS idx_unique_badge_totw_player;
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_totw_player ON player_badge_awards(totw_id, player_id) WHERE totw_id IS NOT NULL;
ALTER TABLE team_of_the_week_players DROP COLUMN IF EXISTS is_player_of_the_week;
DROP INDEX IF EXISTS idx_totw_player_of_the_week;
ALTER TABLE team_of_the_week DROP COLUMN IF EXISTS player_of_the_week_id;
