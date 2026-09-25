-- +goose Up
-- Migration 099: Filter MVP Badges to strictly 2026 matches only

-- 1. Remove stale or non-2026 match MVP awards from player_badge_awards
DELETE FROM player_badge_awards pba
USING matches m, badges b
WHERE b.code = 'MVP'
  AND pba.badge_id = b.id
  AND pba.match_id = m.id
  AND (m.status != 'FINISHED' 
       OR m.mvp_player_id IS NULL 
       OR m.mvp_player_id != pba.player_id
       OR EXTRACT(YEAR FROM m.date) != 2026);

-- 2. Backfill MVP badge awards for all finished 2026 matches where mvp_player_id IS NOT NULL
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
  AND EXTRACT(YEAR FROM m.date) = 2026
ON CONFLICT DO NOTHING;

-- 3. Recount & synchronize player_badges for MVP
INSERT INTO player_badges (player_id, badge_id, count, last_awarded_at, created_at, updated_at)
SELECT 
    pba.player_id, 
    b.id, 
    COALESCE(SUM(pba.count), 0), 
    MAX(pba.created_at), 
    NOW(), 
    NOW()
FROM player_badge_awards pba
JOIN badges b ON b.code = 'MVP' AND pba.badge_id = b.id
GROUP BY pba.player_id, b.id
ON CONFLICT (player_id, badge_id) 
DO UPDATE SET 
    count = EXCLUDED.count, 
    last_awarded_at = EXCLUDED.last_awarded_at, 
    updated_at = NOW();

-- 4. Zero out counters for players who now have 0 awards for MVP
UPDATE player_badges pb
SET count = 0, updated_at = NOW()
FROM badges b
WHERE b.code = 'MVP' AND pb.badge_id = b.id
  AND NOT EXISTS (
      SELECT 1 FROM player_badge_awards pba
      WHERE pba.player_id = pb.player_id AND pba.badge_id = b.id
  );

-- +goose Down
-- Re-backfill all historical finished matches without year restriction
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
