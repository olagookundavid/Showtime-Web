-- +goose Up

-- claim_status is explicit rather than inferred from "user_id IS NULL" because "has a
-- login account" and "has been claimed by its owner" are different facts, and
-- conflating them is what makes approval bypasses hard to see. A pending claimant has
-- a users row already (so email uniqueness is enforced at submit time) but must not
-- count as claimed until a manager approves.
--
-- Every existing player defaults to UNCLAIMED, which is correct: the historical import
-- left email, phone and photo blank for all of them, so all of them must claim.
ALTER TABLE players ADD COLUMN IF NOT EXISTS claim_status VARCHAR(20) NOT NULL DEFAULT 'UNCLAIMED';
    -- UNCLAIMED | PENDING | CLAIMED

CREATE INDEX IF NOT EXISTS idx_players_team_claim_status ON players (team_id, claim_status);

-- +goose Down
DROP INDEX IF EXISTS idx_players_team_claim_status;
ALTER TABLE players DROP COLUMN IF EXISTS claim_status;
