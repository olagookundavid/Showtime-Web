-- +goose Up

-- Splits player claims into two review tracks.
--
-- A ROSTER claim ("that's me on the list") stays with the team manager, who is the
-- only person able to say whether the claimant is really that player.
--
-- A NEW_PLAYER request ("I'm not on the list") now belongs to the league office. For
-- a brand-new player there is no history to check — no appearances, no past teams,
-- nothing to compare a claimant against — so this review is not an identity check at
-- all. It is a decision about whether someone joins the league roster, which is the
-- admin's call, not a manager's.
--
-- The manager still endorses: they know the person, the admin holds the authority.
-- Endorsement is advisory and never blocks — an unresponsive manager must not be able
-- to strand a request, so the admin can decide with or without it.

-- claim_kind records what the claimant asked for and never changes afterwards.
-- It cannot be derived from "player_id IS NULL" because approving a NEW_PLAYER
-- request writes the newly created player's id back onto the claim — after which the
-- two kinds would be indistinguishable, and every audit answer about who was entitled
-- to approve it would be wrong.
ALTER TABLE player_claims
    ADD COLUMN IF NOT EXISTS claim_kind VARCHAR(20) NOT NULL DEFAULT 'ROSTER';
    -- ROSTER | NEW_PLAYER

-- The manager's advisory opinion. NULL means "not yet given", which is a normal and
-- actionable state for the admin, not an error.
ALTER TABLE player_claims
    ADD COLUMN IF NOT EXISTS endorsement VARCHAR(20);
    -- NULL | ENDORSED | DECLINED
ALTER TABLE player_claims
    ADD COLUMN IF NOT EXISTS endorsed_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE player_claims
    ADD COLUMN IF NOT EXISTS endorsed_at TIMESTAMPTZ;
ALTER TABLE player_claims
    ADD COLUMN IF NOT EXISTS endorsement_note TEXT NOT NULL DEFAULT '';

-- +goose StatementBegin
-- Backfill. Correct for every claim still pending, which is the set that matters:
-- those are the ones whose routing changes under this migration. A NEW_PLAYER request
-- that was already approved under the old rules has its player_id filled in and will
-- be labelled ROSTER — historically inaccurate, but it only affects how a settled
-- claim is displayed, and there is no way to recover the distinction after the fact.
UPDATE player_claims
SET claim_kind = 'NEW_PLAYER'
WHERE player_id IS NULL;
-- +goose StatementEnd

-- Drives the manager's queue (ROSTER, plus NEW_PLAYER still awaiting endorsement) and
-- the admin's separate new-player queue.
CREATE INDEX IF NOT EXISTS idx_player_claims_kind_status
    ON player_claims (claim_kind, status);

-- +goose Down
DROP INDEX IF EXISTS idx_player_claims_kind_status;
ALTER TABLE player_claims DROP COLUMN IF EXISTS endorsement_note;
ALTER TABLE player_claims DROP COLUMN IF EXISTS endorsed_at;
ALTER TABLE player_claims DROP COLUMN IF EXISTS endorsed_by;
ALTER TABLE player_claims DROP COLUMN IF EXISTS endorsement;
ALTER TABLE player_claims DROP COLUMN IF EXISTS claim_kind;
