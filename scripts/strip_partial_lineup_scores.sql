-- ==============================================================================
-- STRIP PARTIAL LINEUP SCORES & DEMOTE TO 'PARTIAL'
-- ==============================================================================
-- Description:
--   Demotes any fantasy lineup that was not completely filled (< 14 picks)
--   from 'LOCKED' or 'DRAFT' down to 'PARTIAL', resets their points and pick points
--   to 0.000, deletes any points logs, and recalculates team season total points.
--
-- Usage:
--   psql "$DATABASE_URL" -f scripts/strip_partial_lineup_scores.sql
-- ==============================================================================

BEGIN;

-- 1. Diagnostics: Show which incomplete lineups currently have scores or locked status
SELECT 
    fgw.number AS gw,
    ft.name AS team_name,
    fl.status,
    fl.points,
    COUNT(flp.id) AS pick_count
FROM fantasy_lineups fl
JOIN fantasy_teams ft ON fl.team_id = ft.id
JOIN fantasy_gameweeks fgw ON fl.gameweek_id = fgw.id
LEFT JOIN fantasy_lineup_picks flp ON flp.lineup_id = fl.id
GROUP BY fgw.number, ft.name, fl.status, fl.points, fl.id
HAVING COUNT(flp.id) <> 14 AND (fl.status IN ('LOCKED', 'DRAFT') OR fl.points > 0);

-- 2. Zero pick points for incomplete lineups
UPDATE fantasy_lineup_picks flp
SET points = 0.000
FROM fantasy_lineups fl
WHERE flp.lineup_id = fl.id
  AND (SELECT COUNT(*) FROM fantasy_lineup_picks flp2 WHERE flp2.lineup_id = fl.id) <> 14;

-- 3. Delete gameweek points logs for incomplete lineups
DELETE FROM fantasy_gw_points fgp
USING fantasy_lineups fl
WHERE fgp.team_id = fl.team_id
  AND fgp.gameweek_id = fl.gameweek_id
  AND (SELECT COUNT(*) FROM fantasy_lineup_picks flp WHERE flp.lineup_id = fl.id) <> 14;

-- 4. Demote incomplete lineups to 'PARTIAL' and reset their score to 0.000
UPDATE fantasy_lineups fl
SET status = 'PARTIAL',
    points = 0.000,
    updated_at = NOW()
WHERE (SELECT COUNT(*) FROM fantasy_lineup_picks flp WHERE flp.lineup_id = fl.id) <> 14
  AND (fl.status IN ('LOCKED', 'DRAFT') OR fl.points > 0);

-- 5. Re-settle season total points for all teams from valid LOCKED lineups only
UPDATE fantasy_teams ft
SET total_points = COALESCE((
        SELECT SUM(fl.points) FROM fantasy_lineups fl
        WHERE fl.team_id = ft.id AND fl.status = 'LOCKED'
    ), 0),
    updated_at = NOW();

-- 6. Diagnostics: Show top 15 updated standings
SELECT 
    ROW_NUMBER() OVER (ORDER BY ft.total_points DESC) AS rank,
    ft.name AS team_name,
    ft.total_points,
    COALESCE(u.full_name, u.email, 'Anonymous') AS manager
FROM fantasy_teams ft
LEFT JOIN users u ON ft.user_id = u.id
ORDER BY ft.total_points DESC
LIMIT 15;

COMMIT;
