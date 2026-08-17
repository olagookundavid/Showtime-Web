-- +goose Up

-- One row per attempt by a person to claim an existing player, or to request that a
-- player be created for them. player_id IS NULL means "my name wasn't in the list":
-- the players row is created by the manager at approval, never at submit, so nobody
-- who merely loads the claim page can pollute the roster.
--
-- verify_token_hash stores a hash, never the token itself, on the same reasoning as a
-- password. Email verification is informational here: it proves the account is
-- recoverable, not that the claimant is who they say. The manager proves identity.
CREATE TABLE IF NOT EXISTS player_claims (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id              UUID REFERENCES players(id) ON DELETE CASCADE,
    team_id                UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id                UUID REFERENCES users(id) ON DELETE SET NULL,
    code_id                UUID REFERENCES team_claim_codes(id) ON DELETE SET NULL,
    claimed_email          VARCHAR(255) NOT NULL,
    claimed_phone          VARCHAR(50) NOT NULL DEFAULT '',
    claimed_photo          TEXT NOT NULL DEFAULT '',
    proposed_name          VARCHAR(255) NOT NULL DEFAULT '',
    proposed_jersey_number INT,
    proposed_position      VARCHAR(50) NOT NULL DEFAULT '',
    status                 VARCHAR(20) NOT NULL DEFAULT 'PENDING',
                           -- PENDING | APPROVED | REJECTED
    email_verified_at      TIMESTAMPTZ,
    verify_token_hash      BYTEA,
    verify_token_expires   TIMESTAMPTZ,
    reviewed_by            UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at            TIMESTAMPTZ,
    reject_reason          TEXT NOT NULL DEFAULT '',
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Makes the double-claim race unrepresentable rather than merely unlikely: two people
-- submitting for the same player at the same moment cannot both end up pending, and an
-- approved player can never be claimed again. Rejected claims are excluded, so a
-- rejection frees the player to be claimed by someone else.
CREATE UNIQUE INDEX IF NOT EXISTS idx_player_claims_one_open_per_player
    ON player_claims (player_id)
    WHERE player_id IS NOT NULL AND status IN ('PENDING', 'APPROVED');

CREATE INDEX IF NOT EXISTS idx_player_claims_team_status ON player_claims (team_id, status);
CREATE INDEX IF NOT EXISTS idx_player_claims_user ON player_claims (user_id);

-- +goose Down
DROP INDEX IF EXISTS idx_player_claims_user;
DROP INDEX IF EXISTS idx_player_claims_team_status;
DROP INDEX IF EXISTS idx_player_claims_one_open_per_player;
DROP TABLE IF EXISTS player_claims;
