-- +goose Up
-- A team's game day tickets are no longer only for the players on the team sheet.
-- Every team has a fixed number of slots for a match (30), and a slot goes to a
-- player on the sheet, one of the team's managers, or an extra person the team
-- manager gives one to (a reserve, another manager). team_role says which.
-- revoked_at marks a ticket a manager took back on purpose, so saving the team
-- sheet again does not hand it out a second time.
ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS team_role VARCHAR(10) CHECK (team_role IN ('PLAYER', 'MANAGER', 'EXTRA')),
    ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

UPDATE tickets SET team_role = 'PLAYER' WHERE purchase_type = 'PLAYER' AND team_role IS NULL;

-- One live ticket per manager per match.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_manager_match_live
    ON tickets (match_id, user_id)
    WHERE purchase_type = 'PLAYER' AND team_role = 'MANAGER' AND status <> 'CANCELLED';

-- +goose Down
DROP INDEX IF EXISTS idx_tickets_manager_match_live;
DELETE FROM tickets WHERE team_role IN ('MANAGER', 'EXTRA') AND player_id IS NULL;
ALTER TABLE tickets
    DROP COLUMN IF EXISTS revoked_at,
    DROP COLUMN IF EXISTS team_role;
