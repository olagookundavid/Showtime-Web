-- ==============================================================================
-- RESTORE SUPPRESSED PLAYER PRICES & COMPENSATE AFFECTED SQUAD SALES
-- ==============================================================================
-- Description:
--   1. Identifies players whose fantasy price was systematically dragged down
--      by the appearance threshold bug (< 3 match appearances) across GW1-GW3.
--   2. Restores their gameweek price records in `fantasy_player_prices` back to
--      their legitimate opening/seeded price (where not manually overridden).
--   3. Checks if any managers sold these players at the depressed price, and
--      refunds the artificial difference back to the manager's `bank`.
--
-- The appearance count that matters is the count AS OF the gameweek (or sale)
-- being evaluated, not the player's current season-to-date total: repriceSeason
-- runs once per gameweek and only ever sees the matches played up to that point,
-- so a player who had 1 appearance in GW1 but has 4 by the time this script runs
-- must still be evaluated against their GW1 total, or their suppressed GW1 price
-- (and any GW1 sale) is missed entirely. Appearances "as of" a gameweek are
-- reconstructed from matches played on or before that gameweek's event day date;
-- for a squad sale, "as of" the sale is matches played on or before sold_at.
--
-- Usage:
--   psql "$DATABASE_URL" -f scripts/restore_suppressed_player_prices.sql
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. DIAGNOSTICS: Show players with < 3 appearances (as of that gameweek) whose
--    prices were dragged down
-- ------------------------------------------------------------------------------
SELECT
    p.name AS player_name,
    COALESCE(p.position, '-') AS position,
    t.name AS club,
    gw.number AS gameweek_number,
    openp.price AS opening_price,
    curr.price AS suppressed_price,
    (openp.price - curr.price) AS price_dragged_down,
    COALESCE(app.match_count, 0) AS appearances_as_of_gameweek
FROM fantasy_player_prices curr
JOIN fantasy_player_prices openp
    ON curr.season_id = openp.season_id
   AND curr.player_id = openp.player_id
   AND openp.gameweek_id IS NULL
JOIN players p ON p.id = curr.player_id
LEFT JOIN teams t ON t.id = p.team_id
JOIN fantasy_seasons fs ON fs.id = curr.season_id
JOIN fantasy_gameweeks gw ON gw.id = curr.gameweek_id
JOIN event_days ed ON ed.id = gw.event_day_id
LEFT JOIN LATERAL (
    SELECT COUNT(DISTINCT ps.match_id) AS match_count
    FROM player_stats ps
    JOIN matches m ON m.id = ps.match_id
    WHERE ps.player_id = curr.player_id
      AND ps.competition_id = fs.competition_id
      AND m.date <= ed.date
) app ON true
WHERE curr.gameweek_id IS NOT NULL
  AND curr.is_overridden = false
  AND curr.price < openp.price
  AND COALESCE(app.match_count, 0) < 3
ORDER BY (openp.price - curr.price) DESC, p.name ASC;

-- ------------------------------------------------------------------------------
-- 2. RESTORE PRICES: Reset gameweek prices to opening price for < 3 appearances
--    as of that gameweek
-- ------------------------------------------------------------------------------
UPDATE fantasy_player_prices curr
SET price = openp.price,
    calculated_price = openp.price
FROM fantasy_player_prices openp
JOIN fantasy_seasons fs ON fs.id = openp.season_id
WHERE curr.season_id = openp.season_id
  AND curr.player_id = openp.player_id
  AND openp.gameweek_id IS NULL
  AND curr.gameweek_id IS NOT NULL
  AND curr.is_overridden = false
  AND curr.price < openp.price
  AND COALESCE((
      SELECT COUNT(DISTINCT ps.match_id)
      FROM player_stats ps
      JOIN matches m ON m.id = ps.match_id
      JOIN fantasy_gameweeks gw ON gw.id = curr.gameweek_id
      JOIN event_days ed ON ed.id = gw.event_day_id
      WHERE ps.player_id = curr.player_id
        AND ps.competition_id = fs.competition_id
        AND m.date <= ed.date
  ), 0) < 3;

-- ------------------------------------------------------------------------------
-- 3. DIAGNOSTICS: Check if any managers sold affected players at a loss due to
--    the bug (appearance count as of the sale date)
-- ------------------------------------------------------------------------------
SELECT
    ft.name AS fantasy_team,
    p.name AS player_name,
    fsp.purchase_price,
    fsp.sold_price,
    (fsp.purchase_price - fsp.sold_price) AS loss_on_sale,
    fsp.sold_at
FROM fantasy_squad_players fsp
JOIN fantasy_teams ft ON ft.id = fsp.team_id
JOIN players p ON p.id = fsp.player_id
JOIN fantasy_seasons fs ON fs.id = ft.season_id
WHERE fsp.sold_at IS NOT NULL
  AND fsp.sold_price < fsp.purchase_price
  AND COALESCE((
      SELECT COUNT(DISTINCT ps.match_id)
      FROM player_stats ps
      JOIN matches m ON m.id = ps.match_id
      WHERE ps.player_id = fsp.player_id
        AND ps.competition_id = fs.competition_id
        AND m.date <= fsp.sold_at::date
  ), 0) < 3;

-- ------------------------------------------------------------------------------
-- 4. REFUND MANAGERS: Credit bank for any unfair loss on sales of affected players
--    (appearance count as of the sale date)
-- ------------------------------------------------------------------------------
UPDATE fantasy_teams ft
SET bank = bank + refund.total_loss,
    updated_at = NOW()
FROM (
    SELECT
        fsp.team_id,
        SUM(fsp.purchase_price - fsp.sold_price) AS total_loss
    FROM fantasy_squad_players fsp
    JOIN fantasy_teams t ON t.id = fsp.team_id
    JOIN fantasy_seasons fs ON fs.id = t.season_id
    WHERE fsp.sold_at IS NOT NULL
      AND fsp.sold_price < fsp.purchase_price
      AND COALESCE((
          SELECT COUNT(DISTINCT ps.match_id)
          FROM player_stats ps
          JOIN matches m ON m.id = ps.match_id
          WHERE ps.player_id = fsp.player_id
            AND ps.competition_id = fs.competition_id
            AND m.date <= fsp.sold_at::date
      ), 0) < 3
    GROUP BY fsp.team_id
) refund
WHERE ft.id = refund.team_id;

-- Also update the sold_price on the squad ledger so historical records reconcile
UPDATE fantasy_squad_players fsp
SET sold_price = fsp.purchase_price
FROM fantasy_teams ft
JOIN fantasy_seasons fs ON fs.id = ft.season_id
WHERE fsp.team_id = ft.id
  AND fsp.sold_at IS NOT NULL
  AND fsp.sold_price < fsp.purchase_price
  AND COALESCE((
      SELECT COUNT(DISTINCT ps.match_id)
      FROM player_stats ps
      JOIN matches m ON m.id = ps.match_id
      WHERE ps.player_id = fsp.player_id
        AND ps.competition_id = fs.competition_id
        AND m.date <= fsp.sold_at::date
  ), 0) < 3;

-- ------------------------------------------------------------------------------
-- 5. VERIFICATION: Confirm no prices remain below opening price for < 3
--    appearances as of their gameweek
-- ------------------------------------------------------------------------------
SELECT
    COUNT(*) AS remaining_suppressed_prices
FROM fantasy_player_prices curr
JOIN fantasy_player_prices openp
    ON curr.season_id = openp.season_id
   AND curr.player_id = openp.player_id
   AND openp.gameweek_id IS NULL
JOIN fantasy_seasons fs ON fs.id = curr.season_id
JOIN fantasy_gameweeks gw ON gw.id = curr.gameweek_id
JOIN event_days ed ON ed.id = gw.event_day_id
WHERE curr.gameweek_id IS NOT NULL
  AND curr.is_overridden = false
  AND curr.price < openp.price
  AND COALESCE((
      SELECT COUNT(DISTINCT ps.match_id)
      FROM player_stats ps
      JOIN matches m ON m.id = ps.match_id
      WHERE ps.player_id = curr.player_id
        AND ps.competition_id = fs.competition_id
        AND m.date <= ed.date
  ), 0) < 3;

COMMIT;
