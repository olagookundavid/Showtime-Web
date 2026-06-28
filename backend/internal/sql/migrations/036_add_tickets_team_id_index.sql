-- +goose Up
-- Index the team_id lookups used by per-team allocation checks and team
-- ticket reporting (CountByTeamAndEventDay, team allocation listing). Without
-- it these run sequential scans on every purchase under launch-day load.
-- Non-concurrent is fine here: the tickets table is small pre-launch so the
-- brief lock is negligible, and it stays compatible with boot migrations.
CREATE INDEX IF NOT EXISTS idx_tickets_team_id ON tickets(team_id);

-- +goose Down
DROP INDEX IF EXISTS idx_tickets_team_id;
