-- +goose Up

-- Cleanup for the AutoProvisionActiveContracts defect.
--
-- That routine was a one-time backfill for the historical player import, but it was
-- called from the read path of GetContractsByTeamID, so it re-ran on every contracts
-- page load. Combined with UpdatePlayer being unable to clear players.team_id (empty
-- string into a UUID column, error discarded at the call site), every expiry cycle
-- resurrected the expired contract AND inserted a fresh duplicate. Result before this
-- migration: 9,045 ACTIVE contracts across 853 players, and zero EXPIRED rows.
--
-- Step 1 keeps one ACTIVE contract per player, Step 2 rebases it so the 10-match
-- window starts from today, Step 3 makes the duplication unrepresentable.

-- +goose StatementBegin
-- Step 1: collapse to one ACTIVE contract per player.
--
-- Ranking puts genuinely negotiated contracts first (notes <> the auto-provisioned
-- marker sorts FALSE before TRUE), so a real agreement always wins over a generated
-- one, and only generated rows are ever deleted. If a player somehow holds two real
-- ACTIVE contracts, nothing here touches them and the unique index in Step 3 will
-- abort this migration rather than silently discard a real agreement.
WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY player_id
            ORDER BY
                (notes = 'Auto-provisioned Active Roster Contract') ASC,
                created_at ASC,
                id ASC
        ) AS rn
    FROM contracts
    WHERE status = 'ACTIVE'
)
DELETE FROM contracts c
USING ranked r
WHERE c.id = r.id
  AND r.rn > 1
  AND c.notes = 'Auto-provisioned Active Roster Contract';
-- +goose StatementEnd

-- +goose StatementBegin
-- Step 2: rebase every surviving auto-provisioned contract onto today.
--
-- matches_at_start becomes the team's current FINISHED match count, so with
-- contract_length 10 the Model B display reads "matches played / matches played + 10"
-- and every player has a full 10 matches from now. The duplicates were each stamped
-- at a different point in the season (baselines ranged 8..58), so without this the
-- survivors would expire at wildly different times — many of them immediately.
--
-- last_notified_remaining resets to -1 (the column default) so the 3/2/1/0 warning
-- cascade re-arms for the new window instead of treating it as already-notified.
UPDATE contracts c
SET matches_at_start = (
        SELECT COUNT(*)
        FROM matches m
        WHERE (m.home_team_id = c.team_id OR m.away_team_id = c.team_id)
          AND m.status = 'FINISHED'
    ),
    contract_length = 10,
    last_notified_remaining = -1,
    updated_at = NOW()
WHERE c.status = 'ACTIVE'
  AND c.notes = 'Auto-provisioned Active Roster Contract';
-- +goose StatementEnd

-- +goose StatementBegin
-- Step 3: a player can hold at most one ACTIVE contract.
--
-- Safe for the renewal flow: RenewContract creates the new row as PENDING, and
-- RespondToContract terminates the outgoing ACTIVE contract before activating the
-- incoming one, so the two are never ACTIVE simultaneously.
CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_one_active_per_player
    ON contracts (player_id)
    WHERE status = 'ACTIVE';
-- +goose StatementEnd

-- +goose Down

-- The deleted duplicate rows are not recoverable from this migration; they were
-- artifacts of the defect above, and a pg_dump of the contracts table was taken
-- before it ran. Only the constraint is reversible.
DROP INDEX IF EXISTS idx_contracts_one_active_per_player;
