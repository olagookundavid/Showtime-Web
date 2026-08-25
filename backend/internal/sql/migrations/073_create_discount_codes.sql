-- +goose Up

-- Discount codes are deliberately a third code concept, distinct from the two
-- that already exist: ticket_tiers.access_code (unlocks a hidden tier) and
-- ticket_referral_codes (attribution only, no price effect). This one changes
-- what the buyer pays and is the only one that does.
CREATE TABLE IF NOT EXISTS discount_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Stored upper-cased; every lookup upper-cases its input, so codes are
    -- case-insensitive for buyers without needing a functional index.
    code VARCHAR(40) NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    -- NULL means unlimited redemptions; a number caps them.
    max_uses INT CHECK (max_uses IS NULL OR max_uses > 0),
    -- NULL means the code never expires.
    expires_at TIMESTAMPTZ,
    -- Who may redeem. 'all' is the default; the other two let an admin run a
    -- members-only or a guest-acquisition campaign.
    audience VARCHAR(20) NOT NULL DEFAULT 'all'
        CHECK (audience IN ('all', 'authenticated', 'guest')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per product or ticket tier the code covers, each with its own naira
-- reduction. This is what makes a code product-agnostic: the same code can take
-- ₦1,000 off one product and ₦3,000 off another.
--
-- entity_id is intentionally not a foreign key: it points at either
-- store_products or ticket_tiers depending on entity_type, and no single FK can
-- express that. Deletions are handled by the service, which drops orphaned rows.
CREATE TABLE IF NOT EXISTS discount_code_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discount_code_id UUID NOT NULL REFERENCES discount_codes(id) ON DELETE CASCADE,
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('product', 'ticket_tier')),
    entity_id UUID NOT NULL,
    amount_off NUMERIC(12, 2) NOT NULL CHECK (amount_off > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (discount_code_id, entity_type, entity_id)
);

-- A redemption is created 'reserved' at checkout, flipped to 'confirmed' when
-- payment succeeds, and 'released' if payment fails or the order is cancelled.
--
-- Reserving up front is what stops two buyers from spending the last use of a
-- code at the same time. Abandoned checkouts are handled by age rather than a
-- sweeper job: the usage count only honours reservations younger than an hour,
-- so a cart nobody paid for frees its hold on its own.
CREATE TABLE IF NOT EXISTS discount_code_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discount_code_id UUID NOT NULL REFERENCES discount_codes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    -- Held even for logged-in buyers: it is how a per-customer limit is applied
    -- to guest checkouts, which have no account to key on.
    email TEXT NOT NULL,
    order_id UUID REFERENCES online_orders(id) ON DELETE CASCADE,
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    amount_discounted NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'reserved'
        CHECK (status IN ('reserved', 'confirmed', 'released')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Exactly one of the two purchase kinds, never both and never neither.
    CONSTRAINT discount_redemption_one_target CHECK (
        (order_id IS NOT NULL AND ticket_id IS NULL) OR
        (order_id IS NULL AND ticket_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_discount_code_items_code ON discount_code_items(discount_code_id);
CREATE INDEX IF NOT EXISTS idx_discount_code_items_entity ON discount_code_items(entity_type, entity_id);
-- Covers the usage-count query, which filters by code and status on every redeem.
CREATE INDEX IF NOT EXISTS idx_discount_redemptions_code ON discount_code_redemptions(discount_code_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discount_redemptions_order ON discount_code_redemptions(order_id);
CREATE INDEX IF NOT EXISTS idx_discount_redemptions_ticket ON discount_code_redemptions(ticket_id);

-- What the buyer actually saved, kept on the purchase so receipts, refunds and
-- reporting don't have to re-derive it from a code that may since have changed.
ALTER TABLE online_orders ADD COLUMN IF NOT EXISTS discount_code VARCHAR(40);
ALTER TABLE online_orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS discount_code VARCHAR(40);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS discount_amount INT NOT NULL DEFAULT 0;

-- +goose Down
ALTER TABLE tickets DROP COLUMN IF EXISTS discount_amount;
ALTER TABLE tickets DROP COLUMN IF EXISTS discount_code;
ALTER TABLE online_orders DROP COLUMN IF EXISTS discount_amount;
ALTER TABLE online_orders DROP COLUMN IF EXISTS discount_code;
DROP TABLE IF EXISTS discount_code_redemptions;
DROP TABLE IF EXISTS discount_code_items;
DROP TABLE IF EXISTS discount_codes;
