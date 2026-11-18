-- +goose Up

-- A spend wallet for every account (fans and players alike). Money is stored as
-- integer kobo, like the Fantasy prize wallet, and never leaves Showtime: it is
-- topped up with Paystack and spent on things inside the app. It is separate from
-- fantasy_wallets, which holds withdrawable prize winnings.
CREATE TABLE IF NOT EXISTS wallets (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    balance_kobo BIGINT NOT NULL DEFAULT 0 CHECK (balance_kobo >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Append-only ledger: amount_kobo is signed (credit +, debit -) and every row is
-- written in the same database transaction as the balance change it describes.
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_kobo BIGINT NOT NULL CHECK (amount_kobo <> 0),
    balance_after_kobo BIGINT NOT NULL CHECK (balance_after_kobo >= 0),
    type TEXT NOT NULL CHECK (type IN ('TOPUP', 'VOUCHER_PURCHASE', 'PURCHASE', 'REFUND', 'ADJUSTMENT')),
    -- What the row is about, e.g. the Paystack reference of a top-up.
    reference TEXT,
    -- Set for voucher purchases and refunds (the vouchers table arrives later).
    voucher_id UUID,
    description TEXT NOT NULL DEFAULT '',
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user ON wallet_transactions (user_id, created_at DESC);

-- The same payment can reach us twice (webhook and the browser coming back). The
-- second one must not credit again, so a reference may appear once per type.
CREATE UNIQUE INDEX IF NOT EXISTS uix_wallet_tx_type_reference
    ON wallet_transactions (type, reference) WHERE reference IS NOT NULL;

-- One row per attempt to top up: created when the user starts paying, settled when
-- Paystack confirms. The wallet is only credited when this row flips to PAID.
CREATE TABLE IF NOT EXISTS wallet_topups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_kobo BIGINT NOT NULL CHECK (amount_kobo > 0),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'FAILED')),
    paystack_reference TEXT NOT NULL UNIQUE,
    paystack_access_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_wallet_topups_user ON wallet_topups (user_id, created_at DESC);

-- The Wallets admin page (balances, ledger, manual adjustments) is its own feature
-- so it can be given to a role on its own. Only the admin role gets it to start
-- with, selected from roles so a role deleted since migration 115 can't break this.
INSERT INTO role_permissions (role_key, feature, level)
SELECT key, 'wallets', 'full' FROM roles WHERE key = 'admin'
ON CONFLICT (role_key, feature) DO NOTHING;

-- +goose Down

DELETE FROM role_permissions WHERE feature = 'wallets';
DROP TABLE IF EXISTS wallet_topups;
DROP TABLE IF EXISTS wallet_transactions;
DROP TABLE IF EXISTS wallets;
