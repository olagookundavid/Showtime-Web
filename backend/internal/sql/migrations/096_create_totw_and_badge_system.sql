-- +goose Up
-- Migration 096: Team of the Week & Player Badge System

-- 1. Badges catalog
CREATE TABLE IF NOT EXISTS badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(100) NOT NULL DEFAULT '🏆',
    category VARCHAR(50) NOT NULL DEFAULT 'Honor',
    color_scheme VARCHAR(50) NOT NULL DEFAULT 'gold',
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed core badges
INSERT INTO badges (code, name, description, icon, category, color_scheme, is_system) VALUES
('MVP', 'Match MVP', 'Awarded to the most valuable player of an official match', '🏆', 'Match Honor', 'gold', true),
('TOTW', 'Team of the Week', 'Selected as one of the top 14 players of the gameday', '⭐', 'Weekly Honor', 'red', true),
('TOTS', 'Team of the Season', 'Selected in the prestigious Showtime Team of the Season', '👑', 'Season Honor', 'gold', true),
('DPOY', 'Defensive Player of the Year', 'Honoring the most outstanding defensive player of the season', '🛡️', 'Season Honor', 'blue', true),
('OPOY', 'Offensive Player of the Year', 'Honoring the most outstanding offensive player of the season', '⚡', 'Season Honor', 'red', true)
ON CONFLICT (code) DO UPDATE SET is_system = EXCLUDED.is_system;

-- 2. Player Badges summary table (tracks counter per player)
CREATE TABLE IF NOT EXISTS player_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    count INT NOT NULL DEFAULT 1 CHECK (count >= 0),
    last_awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (player_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_player_badges_player_id ON player_badges(player_id);
CREATE INDEX IF NOT EXISTS idx_player_badges_badge_id ON player_badges(badge_id);

-- 3. Player Badge Awards history
CREATE TABLE IF NOT EXISTS player_badge_awards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    competition_id UUID REFERENCES competitions(id) ON DELETE SET NULL,
    -- A season is a parent competition (see 091: competitions.season_id).
    season_id UUID REFERENCES competitions(id) ON DELETE SET NULL,
    match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
    totw_id UUID,
    reason TEXT,
    count INT NOT NULL DEFAULT 1 CHECK (count >= 1),
    awarded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_badge_awards_player_badge ON player_badge_awards(player_id, badge_id);
CREATE INDEX IF NOT EXISTS idx_badge_awards_match_id ON player_badge_awards(match_id);
-- One award per badge per player per match. "One MVP per match" is enforced by
-- the MVP sync, not here, so custom match badges can go to several players.
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_badge_match_player ON player_badge_awards(badge_id, match_id, player_id) WHERE match_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_totw_player ON player_badge_awards(totw_id, player_id) WHERE totw_id IS NOT NULL;

-- 4. Team of the Week header
CREATE TABLE IF NOT EXISTS team_of_the_week (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    event_day_id UUID REFERENCES event_days(id) ON DELETE SET NULL,
    week_title VARCHAR(100) NOT NULL,
    headline VARCHAR(255) NOT NULL,
    sub_headline VARCHAR(255) NOT NULL DEFAULT 'Offence & defence lineup',
    is_published BOOLEAN NOT NULL DEFAULT false,
    published_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_totw_comp_pub ON team_of_the_week(competition_id, is_published);
CREATE INDEX IF NOT EXISTS idx_totw_event_day ON team_of_the_week(event_day_id);

-- Add foreign key constraint to player_badge_awards.totw_id now that team_of_the_week exists
ALTER TABLE player_badge_awards 
ADD CONSTRAINT fk_badge_awards_totw FOREIGN KEY (totw_id) REFERENCES team_of_the_week(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_badge_awards_totw_id ON player_badge_awards(totw_id);

-- 5. Team of the Week players (Starting XIV: 7 Offence, 7 Defence)
CREATE TABLE IF NOT EXISTS team_of_the_week_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    totw_id UUID NOT NULL REFERENCES team_of_the_week(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    slot_code VARCHAR(20) NOT NULL,
    position VARCHAR(20) NOT NULL,
    unit VARCHAR(10) NOT NULL CHECK (unit IN ('Offence', 'Defence')),
    coord_x VARCHAR(10) NOT NULL,
    coord_y VARCHAR(10) NOT NULL,
    rating NUMERIC(3,1) NOT NULL DEFAULT 8.5,
    stat1_value VARCHAR(50),
    stat1_label VARCHAR(50),
    stat2_value VARCHAR(50),
    stat2_label VARCHAR(50),
    stat3_value VARCHAR(50),
    stat3_label VARCHAR(50),
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (totw_id, slot_code)
);

CREATE INDEX IF NOT EXISTS idx_totw_players_totw_id ON team_of_the_week_players(totw_id);
CREATE INDEX IF NOT EXISTS idx_totw_players_player_id ON team_of_the_week_players(player_id);

-- 6. Backfill MVP Badges from all historical matches where mvp_player_id IS NOT NULL and match is FINISHED
INSERT INTO player_badge_awards (player_id, badge_id, match_id, competition_id, reason, count, created_at)
SELECT 
    m.mvp_player_id, 
    b.id, 
    m.id, 
    m.competition_id, 
    'Match MVP honor', 
    1,
    COALESCE((m.date + COALESCE(m.time, '00:00'::time))::timestamptz, NOW())
FROM matches m
CROSS JOIN badges b
WHERE b.code = 'MVP' 
  AND m.mvp_player_id IS NOT NULL 
  AND m.status = 'FINISHED'
ON CONFLICT DO NOTHING;

INSERT INTO player_badges (player_id, badge_id, count, last_awarded_at)
SELECT 
    m.mvp_player_id, 
    b.id, 
    COUNT(*), 
    MAX(COALESCE((m.date + COALESCE(m.time, '00:00'::time))::timestamptz, NOW()))
FROM matches m
CROSS JOIN badges b
WHERE b.code = 'MVP' 
  AND m.mvp_player_id IS NOT NULL 
  AND m.status = 'FINISHED'
GROUP BY m.mvp_player_id, b.id
ON CONFLICT (player_id, badge_id) 
DO UPDATE SET 
    count = EXCLUDED.count, 
    last_awarded_at = EXCLUDED.last_awarded_at, 
    updated_at = NOW();

-- +goose Down
DROP TABLE IF EXISTS team_of_the_week_players;
ALTER TABLE player_badge_awards DROP CONSTRAINT IF EXISTS fk_badge_awards_totw;
DROP TABLE IF EXISTS team_of_the_week;
DROP TABLE IF EXISTS player_badge_awards;
DROP TABLE IF EXISTS player_badges;
DROP TABLE IF EXISTS badges;
