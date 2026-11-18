-- +goose Up

-- What can be sold as a voucher: a named bundle of items at a fixed price, e.g.
-- "Burger + drink". Admins manage this list. A product is switched off (active =
-- false) rather than deleted, so vouchers already sold keep a record of it.
CREATE TABLE IF NOT EXISTS voucher_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price_kobo BIGINT NOT NULL CHECK (price_kobo >= 0),
    -- [{"name": "Burger", "qty": 1}, ...]
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per voucher. The name, items and price are copied from the product when
-- the voucher is made, so later edits to the catalogue never change a voucher that
-- someone already holds. The holder is a name (and optional email), because not
-- everyone a voucher is given to has an account.
CREATE TABLE IF NOT EXISTS vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    product_id UUID REFERENCES voucher_products(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    price_kobo BIGINT NOT NULL DEFAULT 0 CHECK (price_kobo >= 0),
    source TEXT NOT NULL CHECK (source IN ('PURCHASED', 'ADMIN_ISSUED')),

    holder_name TEXT NOT NULL,
    holder_email TEXT,
    holder_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    purchased_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    issued_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Calendar dates in Lagos, both ends inclusive. A one-day voucher has the
    -- same date twice.
    valid_from DATE NOT NULL,
    valid_to DATE NOT NULL,
    CHECK (valid_to >= valid_from),

    status TEXT NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('ISSUED', 'REDEEMED', 'VOID')),
    redeemed_at TIMESTAMPTZ,
    redeemed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    voided_at TIMESTAMPTZ,
    voided_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    -- The wallet debit that paid for a purchased voucher.
    wallet_tx_id UUID REFERENCES wallet_transactions(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vouchers_holder_user ON vouchers (holder_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vouchers_purchaser ON vouchers (purchased_by_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vouchers_status ON vouchers (status, created_at DESC);

-- The ledger rows for a voucher purchase or refund now point at the voucher.
ALTER TABLE wallet_transactions
    ADD CONSTRAINT fk_wallet_tx_voucher
    FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE SET NULL;

-- Two features: "vouchers" is the admin page (catalogue, issuing, voiding) and
-- "voucher_redeem" is the bar screen, which opens no admin area. Only the admin
-- role holds them to start with; give voucher_redeem to bar staff on /admin/roles.
INSERT INTO role_permissions (role_key, feature, level)
SELECT key, f.feature, 'full'
FROM roles, (VALUES ('vouchers'), ('voucher_redeem')) AS f(feature)
WHERE key = 'admin'
ON CONFLICT (role_key, feature) DO NOTHING;

-- +goose Down

DELETE FROM role_permissions WHERE feature IN ('vouchers', 'voucher_redeem');
ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS fk_wallet_tx_voucher;
DROP TABLE IF EXISTS vouchers;
DROP TABLE IF EXISTS voucher_products;
