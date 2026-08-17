-- +goose Up

-- Codes a team manager hands to their players so they can find themselves on the
-- claim page. The code is deliberately low-security: it is shared with a whole squad
-- and gates nothing but a dropdown of names that are already public on the site. The
-- real gate is the manager's approval of the resulting claim. Codes are rotatable and
-- expiring so a manager can burn one once onboarding is done.
CREATE TABLE IF NOT EXISTS team_claim_codes (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    code       VARCHAR(32) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ,
    max_uses   INT NOT NULL DEFAULT 100,
    uses       INT NOT NULL DEFAULT 0,
    revoked_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- At most one live code per team, so "the team's code" is always unambiguous.
-- Rotating a code revokes the previous one rather than leaving two valid.
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_claim_codes_one_live_per_team
    ON team_claim_codes (team_id)
    WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_team_claim_codes_code ON team_claim_codes (code);

-- +goose Down
DROP INDEX IF EXISTS idx_team_claim_codes_code;
DROP INDEX IF EXISTS idx_team_claim_codes_one_live_per_team;
DROP TABLE IF EXISTS team_claim_codes;
