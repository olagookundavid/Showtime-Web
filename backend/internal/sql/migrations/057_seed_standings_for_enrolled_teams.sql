-- +goose Up
-- Seed standings entries with 0 stats for all enrolled competition_teams that don't have standings entries yet
INSERT INTO standings (
    competition_id, team_id, position, played, won, drawn, lost,
    goals_for, goals_against, pct, l5, created_at, updated_at
)
SELECT 
    ct.competition_id,
    ct.team_id,
    0, 0, 0, 0, 0, 0, 0, 0, '', NOW(), NOW()
FROM competition_teams ct
JOIN competitions c ON ct.competition_id = c.id
WHERE c.format = 'LEAGUE' OR c.format IS NULL OR c.format = ''
ON CONFLICT (competition_id, team_id) DO NOTHING;

-- +goose Down
-- No-op down migration for initial standings seeding
