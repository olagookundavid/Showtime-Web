-- +goose Up

-- A user can move Fantasy prize winnings (fantasy_wallets, withdrawable by bank
-- payout) into their spend wallet (wallets). It is one-way: spend wallet money is
-- closed-loop and never goes back to prizes or out to a bank.
--
-- Each transfer writes one row on each ledger in the same database transaction.
-- The spend ledger row has the new type FANTASY_TRANSFER. The prize ledger row
-- gets its own type, WALLET_TRANSFER: ADJUSTMENT is for manual staff corrections
-- and would be indistinguishable from them, and PAYOUT means money that left the
-- business by bank transfer, which this is not.
ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;
ALTER TABLE wallet_transactions
    ADD CONSTRAINT wallet_transactions_type_check
    CHECK (type IN ('TOPUP', 'VOUCHER_PURCHASE', 'PURCHASE', 'REFUND', 'ADJUSTMENT', 'FANTASY_TRANSFER'));

ALTER TABLE fantasy_wallet_transactions DROP CONSTRAINT IF EXISTS fantasy_wallet_transactions_type_check;
ALTER TABLE fantasy_wallet_transactions
    ADD CONSTRAINT fantasy_wallet_transactions_type_check
    CHECK (type IN ('WINNINGS', 'PAYOUT', 'PAYOUT_REVERSAL', 'ADJUSTMENT', 'WALLET_TRANSFER'));

-- The prize ledger had no reference column. A transfer stores the same reference
-- (FTR-<uuid>) on both ledgers so each row can be matched to the other. NULL for
-- every other kind of row, and unique when set.
ALTER TABLE fantasy_wallet_transactions ADD COLUMN IF NOT EXISTS reference TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uix_fantasy_wallet_tx_reference
    ON fantasy_wallet_transactions (reference) WHERE reference IS NOT NULL;

-- +goose Down

-- Money rows are never deleted: removing a transfer from one ledger would break
-- the other and the balances they explain. Rows of the new types are re-typed as
-- ADJUSTMENT instead, so the constraints can go back and every balance still adds
-- up. The reference (which the prize ledger loses with its column) is kept in the
-- description so a pair can still be matched by hand.
UPDATE fantasy_wallet_transactions
    SET type = 'ADJUSTMENT', description = description || ' [' || COALESCE(reference, '') || ']'
    WHERE type = 'WALLET_TRANSFER';
UPDATE wallet_transactions
    SET type = 'ADJUSTMENT', description = description || ' [' || COALESCE(reference, '') || ']'
    WHERE type = 'FANTASY_TRANSFER';

DROP INDEX IF EXISTS uix_fantasy_wallet_tx_reference;
ALTER TABLE fantasy_wallet_transactions DROP COLUMN IF EXISTS reference;

ALTER TABLE fantasy_wallet_transactions DROP CONSTRAINT IF EXISTS fantasy_wallet_transactions_type_check;
ALTER TABLE fantasy_wallet_transactions
    ADD CONSTRAINT fantasy_wallet_transactions_type_check
    CHECK (type IN ('WINNINGS', 'PAYOUT', 'PAYOUT_REVERSAL', 'ADJUSTMENT'));

ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;
ALTER TABLE wallet_transactions
    ADD CONSTRAINT wallet_transactions_type_check
    CHECK (type IN ('TOPUP', 'VOUCHER_PURCHASE', 'PURCHASE', 'REFUND', 'ADJUSTMENT'));
