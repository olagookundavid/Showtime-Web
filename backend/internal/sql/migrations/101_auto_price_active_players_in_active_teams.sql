-- +goose Up

-- 1. Function to automatically give any active player on an active team a ₦3.0m base price on fantasy
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION ensure_player_fantasy_price()
RETURNS TRIGGER AS $$
BEGIN
    -- Only active players assigned to a team
    IF NEW.team_id IS NOT NULL AND COALESCE(NEW.status, 'active') = 'active' THEN
        -- Check if the team is active and player is not in reserves
        IF EXISTS (
            SELECT 1 FROM teams t 
            WHERE t.id = NEW.team_id 
              AND COALESCE(t.status, 'active') = 'active'
        ) AND NOT EXISTS (
            SELECT 1 FROM team_reserves tr 
            WHERE tr.player_id = NEW.id
        ) THEN
            -- Insert into fantasy_player_prices for active/draft seasons
            INSERT INTO fantasy_player_prices (
                season_id,
                player_id,
                gameweek_id,
                base_price,
                rating,
                price,
                calculated_price,
                is_overridden
            )
            SELECT 
                fs.id,
                NEW.id,
                NULL,
                3.00,
                5.00,
                3.00,
                3.00,
                false
            FROM fantasy_seasons fs
            WHERE fs.status IN ('ACTIVE', 'DRAFT')
              AND (
                  fs.competition_id IS NULL
                  OR NOT EXISTS (
                      SELECT 1 FROM competition_teams ct
                      WHERE ct.competition_id = fs.competition_id
                  )
                  OR EXISTS (
                      SELECT 1 FROM competition_teams ct
                      WHERE ct.competition_id = fs.competition_id AND ct.team_id = NEW.team_id
                  )
              )
            ON CONFLICT (season_id, player_id) WHERE gameweek_id IS NULL DO NOTHING;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

DROP TRIGGER IF EXISTS trg_ensure_player_fantasy_price ON players;
CREATE TRIGGER trg_ensure_player_fantasy_price
AFTER INSERT OR UPDATE OF team_id, status ON players
FOR EACH ROW
EXECUTE FUNCTION ensure_player_fantasy_price();

-- 2. Trigger when a player graduates from team_reserves back to the main squad
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION ensure_reserve_graduated_fantasy_price()
RETURNS TRIGGER AS $$
DECLARE
    p_team_id UUID;
    p_status VARCHAR(20);
BEGIN
    SELECT team_id, COALESCE(status, 'active') INTO p_team_id, p_status
    FROM players WHERE id = OLD.player_id;

    IF p_team_id IS NOT NULL AND p_status = 'active' THEN
        IF EXISTS (
            SELECT 1 FROM teams t 
            WHERE t.id = p_team_id 
              AND COALESCE(t.status, 'active') = 'active'
        ) THEN
            INSERT INTO fantasy_player_prices (
                season_id,
                player_id,
                gameweek_id,
                base_price,
                rating,
                price,
                calculated_price,
                is_overridden
            )
            SELECT 
                fs.id,
                OLD.player_id,
                NULL,
                3.00,
                5.00,
                3.00,
                3.00,
                false
            FROM fantasy_seasons fs
            WHERE fs.status IN ('ACTIVE', 'DRAFT')
              AND (
                  fs.competition_id IS NULL
                  OR NOT EXISTS (
                      SELECT 1 FROM competition_teams ct
                      WHERE ct.competition_id = fs.competition_id
                  )
                  OR EXISTS (
                      SELECT 1 FROM competition_teams ct
                      WHERE ct.competition_id = fs.competition_id AND ct.team_id = p_team_id
                  )
              )
            ON CONFLICT (season_id, player_id) WHERE gameweek_id IS NULL DO NOTHING;
        END IF;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

DROP TRIGGER IF EXISTS trg_ensure_reserve_graduated_fantasy_price ON team_reserves;
CREATE TRIGGER trg_ensure_reserve_graduated_fantasy_price
AFTER DELETE ON team_reserves
FOR EACH ROW
EXECUTE FUNCTION ensure_reserve_graduated_fantasy_price();

-- 3. Backfill: Seed 3.00 base price for all currently active players in active teams not in reserves
INSERT INTO fantasy_player_prices (
    season_id,
    player_id,
    gameweek_id,
    base_price,
    rating,
    price,
    calculated_price,
    is_overridden
)
SELECT 
    fs.id,
    p.id,
    NULL,
    3.00,
    5.00,
    3.00,
    3.00,
    false
FROM players p
JOIN teams t ON p.team_id = t.id
CROSS JOIN fantasy_seasons fs
WHERE fs.status IN ('ACTIVE', 'DRAFT')
  AND COALESCE(t.status, 'active') = 'active'
  AND COALESCE(p.status, 'active') = 'active'
  AND NOT EXISTS (
      SELECT 1 FROM team_reserves tr WHERE tr.player_id = p.id
  )
  AND (
      fs.competition_id IS NULL
      OR NOT EXISTS (
          SELECT 1 FROM competition_teams ct
          WHERE ct.competition_id = fs.competition_id
      )
      OR EXISTS (
          SELECT 1 FROM competition_teams ct
          WHERE ct.competition_id = fs.competition_id AND ct.team_id = t.id
      )
  )
ON CONFLICT (season_id, player_id) WHERE gameweek_id IS NULL DO NOTHING;

-- +goose Down
DROP TRIGGER IF EXISTS trg_ensure_reserve_graduated_fantasy_price ON team_reserves;
DROP FUNCTION IF EXISTS ensure_reserve_graduated_fantasy_price();
DROP TRIGGER IF EXISTS trg_ensure_player_fantasy_price ON players;
DROP FUNCTION IF EXISTS ensure_player_fantasy_price();
