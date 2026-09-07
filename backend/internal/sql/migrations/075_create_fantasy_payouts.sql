-- +goose Up

-- Prize structure per league. A league with no rows here falls back to the
-- service's default split (50/30/20).
CREATE TABLE IF NOT EXISTS fantasy_league_prizes (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id  UUID NOT NULL REFERENCES fantasy_leagues(id) ON DELETE CASCADE,
    rank       INT NOT NULL CHECK (rank >= 1),
    percent    NUMERIC(6,3) NOT NULL CHECK (percent > 0 AND percent <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(league_id, rank)
);

-- Settlement bookkeeping. settled_at is the idempotency guard: prize money is
-- only ever distributed for a league whose settled_at is still NULL.
ALTER TABLE fantasy_leagues
    ADD COLUMN IF NOT EXISTS gross_entry_kobo  BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS platform_cut_kobo BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS prize_pool_kobo   BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS settled_at        TIMESTAMPTZ;

-- One row per user, holding the spendable balance. Its purpose is to be the
-- single lockable row (SELECT ... FOR UPDATE) that serialises concurrent
-- credits and withdrawals; the ledger below is the authoritative history.
-- The non-negative CHECK makes over-withdrawal impossible at the database
-- level, whatever the application does.
CREATE TABLE IF NOT EXISTS fantasy_wallets (
    user_id      UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    balance_kobo BIGINT NOT NULL DEFAULT 0 CHECK (balance_kobo >= 0),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Withdrawal requests. Bank details are copied onto the request rather than
-- referenced, so the record always shows exactly what was submitted for that
-- payout even if the user later banks somewhere else.
CREATE TABLE IF NOT EXISTS fantasy_payout_requests (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_kobo          BIGINT NOT NULL CHECK (amount_kobo > 0),
    status               TEXT NOT NULL DEFAULT 'PENDING'
                             CHECK (status IN ('PENDING', 'PROCESSING', 'PAID', 'REJECTED', 'CANCELLED')),
    bank_name            TEXT NOT NULL,
    account_number       TEXT NOT NULL,
    account_name         TEXT NOT NULL,
    user_notes           TEXT NOT NULL DEFAULT '',
    admin_notes          TEXT NOT NULL DEFAULT '',
    payment_reference    TEXT NOT NULL DEFAULT '',
    processed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    processed_at         TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fantasy_payouts_queue ON fantasy_payout_requests(status, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_fantasy_payouts_user ON fantasy_payout_requests(user_id, created_at DESC);

-- Append-only money ledger. Rows are never updated or deleted: a reversal is a
-- new compensating row, so the history always reconstructs the balance.
CREATE TABLE IF NOT EXISTS fantasy_wallet_transactions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_kobo       BIGINT NOT NULL, -- signed: credits positive, debits negative
    type              TEXT NOT NULL
                          CHECK (type IN ('WINNINGS', 'PAYOUT', 'PAYOUT_REVERSAL', 'ADJUSTMENT')),
    league_id         UUID REFERENCES fantasy_leagues(id) ON DELETE SET NULL,
    payout_request_id UUID REFERENCES fantasy_payout_requests(id) ON DELETE SET NULL,
    description       TEXT NOT NULL DEFAULT '',
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fantasy_wallet_tx_user ON fantasy_wallet_transactions(user_id, created_at DESC);

-- Belt-and-braces against double-crediting a league's prize money: even if the
-- settled_at guard were bypassed, a user can only ever hold one WINNINGS row
-- per league.
CREATE UNIQUE INDEX IF NOT EXISTS uix_fantasy_wallet_tx_winnings
    ON fantasy_wallet_transactions (user_id, league_id)
    WHERE type = 'WINNINGS';

-- Platform's percentage cut of paid-league entry fees.
INSERT INTO app_settings (setting_key, setting_value)
VALUES ('fantasy_platform_cut_percent', '10')
ON CONFLICT (setting_key) DO NOTHING;

-- +goose Down
DELETE FROM app_settings WHERE setting_key = 'fantasy_platform_cut_percent';
DROP INDEX IF EXISTS uix_fantasy_wallet_tx_winnings;
DROP TABLE IF EXISTS fantasy_wallet_transactions;
DROP TABLE IF EXISTS fantasy_payout_requests;
DROP TABLE IF EXISTS fantasy_wallets;
ALTER TABLE fantasy_leagues
    DROP COLUMN IF EXISTS settled_at,
    DROP COLUMN IF EXISTS prize_pool_kobo,
    DROP COLUMN IF EXISTS platform_cut_kobo,
    DROP COLUMN IF EXISTS gross_entry_kobo;
DROP TABLE IF EXISTS fantasy_league_prizes;
