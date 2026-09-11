-- +goose Up
-- The squad builder now saves each pick as it is made, so a team sheet exists
-- in the database long before it is finished. PARTIAL is that state.
--
-- It is a third status rather than a flag on DRAFT because DRAFT already means
-- something precise: complete, validated, and waiting for the deadline. That is
-- exactly the promise LockLineupsForGameweek relies on when it promotes every
-- DRAFT to LOCKED without re-checking. Widening DRAFT to include half-finished
-- sheets would have quietly put incomplete lineups into the scoring run.
ALTER TABLE fantasy_lineups DROP CONSTRAINT IF EXISTS fantasy_lineups_status_check;
ALTER TABLE fantasy_lineups
    ADD CONSTRAINT fantasy_lineups_status_check
    CHECK (status IN ('PARTIAL', 'DRAFT', 'LOCKED'));

-- +goose Down
-- Any sheet still unfinished has no meaning under the old two-status model —
-- it was never scoreable — so it is dropped rather than promoted to DRAFT,
-- which would hand incomplete lineups to the scoring run on rollback.
DELETE FROM fantasy_lineups WHERE status = 'PARTIAL';

ALTER TABLE fantasy_lineups DROP CONSTRAINT IF EXISTS fantasy_lineups_status_check;
ALTER TABLE fantasy_lineups
    ADD CONSTRAINT fantasy_lineups_status_check
    CHECK (status IN ('DRAFT', 'LOCKED'));
