-- Standalone SQL script: Update all "My Showtime Stars" team names to user's "<Name> Team"
-- Can be run directly on the database.

BEGIN;

-- Step 1: Update every team named 'My Showtime Stars' (or empty/null) to user's Name + Team
UPDATE fantasy_teams ft
SET name = CASE
        WHEN TRIM(COALESCE(u.full_name, '')) <> '' THEN TRIM(u.full_name) || ' Team'
        WHEN TRIM(COALESCE(u.email, '')) <> '' THEN split_part(u.email, '@', 1) || ' Team'
        ELSE 'Showtime Team'
    END,
    updated_at = NOW()
FROM users u
WHERE ft.user_id = u.id
  AND (TRIM(LOWER(ft.name)) = 'my showtime stars' OR TRIM(COALESCE(ft.name, '')) = '');

-- Step 2: Disambiguate any collisions within the same season so that all names remain unique
WITH duplicates AS (
    SELECT id, season_id, name,
           ROW_NUMBER() OVER (PARTITION BY season_id, LOWER(TRIM(name)) ORDER BY created_at ASC, id ASC) AS rn
    FROM fantasy_teams
)
UPDATE fantasy_teams ft
SET name = ft.name || ' ' || d.rn
FROM duplicates d
WHERE ft.id = d.id AND d.rn > 1;

COMMIT;

-- Verify results
SELECT ft.id, ft.season_id, ft.name, u.full_name, u.email
FROM fantasy_teams ft
JOIN users u ON ft.user_id = u.id
ORDER BY ft.season_id, ft.name;
