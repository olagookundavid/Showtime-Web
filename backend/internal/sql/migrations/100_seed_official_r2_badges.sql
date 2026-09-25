-- +goose Up
-- Migration 100: Seed official R2 badge graphics and synchronize matching badge names

-- 1. Upsert official badges with their dedicated Cloudflare R2 image assets
INSERT INTO badges (code, name, description, icon, category, color_scheme, is_system) VALUES
('MVP', 'Game MVP', 'Awarded to the most valuable player of an official match', 'https://cdn.sffl.football/badges/game-mvp.png', 'Match Honor', 'gold', true),
('POTW', 'Player of the Week', 'Selected as the standout Player of the Week in the Showtime Team of the Week', 'https://cdn.sffl.football/badges/player-of-the-week.png', 'Weekly Honor', 'gold', true),
('TOTW', 'Team of the Week', 'Selected as one of the top 14 players of the gameday Starting XIV', 'https://cdn.sffl.football/badges/team-of-the-week.png', 'Weekly Honor', 'red', true),
('TOTS', 'Team of the Season', 'Selected in the prestigious Showtime Team of the Season roster', 'https://cdn.sffl.football/badges/team-of-the-season.png', 'Season Honor', 'gold', true),
('DPOY', 'Best Defender', 'Honoring the premier defensive playmaker of the season', 'https://cdn.sffl.football/badges/best-defender.png', 'Season Honor', 'blue', true),
('OPOY', 'Best Receiver', 'Honoring the most outstanding pass-catcher and scoring receiver of the season', 'https://cdn.sffl.football/badges/best-receiver.png', 'Season Honor', 'red', true),
('BEST_CENTER', 'Best Center', 'Awarded to the premier offensive lineman / center of the season', 'https://cdn.sffl.football/badges/best-center.png', 'Season Honor', 'blue', true),
('BEST_RUSHER', 'Best Rusher', 'Awarded to the fiercest defensive pass rusher of the season', 'https://cdn.sffl.football/badges/best-rusher.png', 'Season Honor', 'red', true),
('ROOKIE_OF_THE_SEASON', 'Rookie of the Season', 'Awarded to the most outstanding newcomer across the league', 'https://cdn.sffl.football/badges/rookie-of-the-season.png', 'Season Honor', 'gold', true),
('TOURNAMENT_MVP', 'Tournament MVP', 'Awarded to the most valuable player across tournament knockout championship play', 'https://cdn.sffl.football/badges/tournament-mvp.png', 'Tournament Honor', 'gold', true)
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name,
    icon = EXCLUDED.icon,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    color_scheme = EXCLUDED.color_scheme,
    is_system = EXCLUDED.is_system,
    updated_at = NOW();

-- 2. Consolidate any badges previously created under legacy codes (e.g. via the
-- admin "official preset" UI before it was aligned to these canonical codes) into
-- their canonical counterpart above. A plain UPDATE of name/icon here would leave
-- the legacy row in place under its own code, coexisting with the canonical row
-- just upserted and producing a duplicate badge with the same name.
-- +goose StatementBegin
DO $$
DECLARE
    legacy_id UUID;
    canonical_id UUID;
    pair TEXT[];
BEGIN
    FOREACH pair SLICE 1 IN ARRAY ARRAY[
        ARRAY['BEST_DEFENDER', 'DPOY'],
        ARRAY['BEST_RECEIVER', 'OPOY'],
        ARRAY['ROTS', 'ROOKIE_OF_THE_SEASON']
    ]
    LOOP
        SELECT id INTO legacy_id FROM badges WHERE code = pair[1];
        SELECT id INTO canonical_id FROM badges WHERE code = pair[2];

        IF legacy_id IS NOT NULL AND canonical_id IS NOT NULL AND legacy_id <> canonical_id THEN
            -- Re-point awards, dropping any that would collide with an award the
            -- canonical badge already holds for the same player/TOTW edition.
            DELETE FROM player_badge_awards
            WHERE badge_id = legacy_id
              AND totw_id IS NOT NULL
              AND EXISTS (
                  SELECT 1 FROM player_badge_awards existing
                  WHERE existing.badge_id = canonical_id
                    AND existing.totw_id = player_badge_awards.totw_id
                    AND existing.player_id = player_badge_awards.player_id
              );
            UPDATE player_badge_awards SET badge_id = canonical_id WHERE badge_id = legacy_id;

            -- Merge per-player counters, then drop the emptied legacy rows.
            UPDATE player_badges canonical
            SET count = canonical.count + legacy.count,
                last_awarded_at = GREATEST(canonical.last_awarded_at, legacy.last_awarded_at)
            FROM player_badges legacy
            WHERE legacy.badge_id = legacy_id
              AND canonical.badge_id = canonical_id
              AND canonical.player_id = legacy.player_id;

            INSERT INTO player_badges (player_id, badge_id, count, last_awarded_at)
            SELECT legacy.player_id, canonical_id, legacy.count, legacy.last_awarded_at
            FROM player_badges legacy
            WHERE legacy.badge_id = legacy_id
              AND NOT EXISTS (
                  SELECT 1 FROM player_badges canonical
                  WHERE canonical.badge_id = canonical_id AND canonical.player_id = legacy.player_id
              );

            DELETE FROM player_badges WHERE badge_id = legacy_id;
            DELETE FROM badges WHERE id = legacy_id;
        END IF;
    END LOOP;
END $$;
-- +goose StatementEnd

-- +goose Down
-- Revert icons to emoji fallbacks
UPDATE badges SET icon = '🏆' WHERE code = 'MVP';
UPDATE badges SET icon = '⭐' WHERE code = 'POTW';
UPDATE badges SET icon = '⭐' WHERE code = 'TOTW';
UPDATE badges SET icon = '👑' WHERE code = 'TOTS';
UPDATE badges SET icon = '🛡️' WHERE code = 'DPOY';
UPDATE badges SET icon = '⚡' WHERE code = 'OPOY';
DELETE FROM badges WHERE code IN ('BEST_CENTER', 'BEST_RUSHER', 'ROOKIE_OF_THE_SEASON', 'TOURNAMENT_MVP');
