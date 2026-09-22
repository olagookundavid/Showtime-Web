-- +goose Up

-- Disambiguate any duplicate team names within the same season before enforcing unique constraint
WITH duplicates AS (
    SELECT id, season_id, name,
           ROW_NUMBER() OVER (PARTITION BY season_id, LOWER(TRIM(name)) ORDER BY created_at ASC, id ASC) AS rn
    FROM fantasy_teams
)
UPDATE fantasy_teams ft
SET name = ft.name || ' ' || d.rn
FROM duplicates d
WHERE ft.id = d.id AND d.rn > 1;

-- 3. Enforce case-insensitive unique team name per season
CREATE UNIQUE INDEX IF NOT EXISTS uix_fantasy_teams_season_name
    ON fantasy_teams (season_id, LOWER(TRIM(name)));

-- +goose Down
DROP INDEX IF EXISTS uix_fantasy_teams_season_name;
