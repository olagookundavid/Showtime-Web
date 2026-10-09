-- +goose Up

-- Game Pass orders: one paid bundle of several gamedays for one admission tier.
-- Every price column is a snapshot taken at checkout, so later changes to the
-- season rates or discount bands never re-price a past order.
CREATE TABLE IF NOT EXISTS game_pass_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    user_id UUID NULL,
    season_tier_id UUID NULL REFERENCES season_admission_tiers(id) ON DELETE SET NULL,
    tier_name TEXT NOT NULL,
    unit_price INT NOT NULL,
    gameday_count INT NOT NULL,
    holders INT NOT NULL,
    standard_total INT NOT NULL,
    discount_percent INT NOT NULL,
    discount_amount INT NOT NULL,
    total INT NOT NULL,
    -- Mirrors TicketStatus for the payment lifecycle: pending, paid, failed.
    payment_status TEXT NOT NULL DEFAULT 'pending',
    paystack_reference TEXT NULL UNIQUE,
    paystack_access_code TEXT NULL,
    paid_at TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT game_pass_orders_status_check CHECK (payment_status IN ('pending', 'paid', 'failed')),
    CONSTRAINT game_pass_orders_holders_check CHECK (holders >= 1)
);

CREATE INDEX IF NOT EXISTS idx_game_pass_orders_status_created ON game_pass_orders (payment_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_pass_orders_email ON game_pass_orders (LOWER(email));

-- The gamedays in each bundle. Deleting an event day with paid tickets is
-- already refused; one with only unpaid orders just drops out of them.
CREATE TABLE IF NOT EXISTS game_pass_order_gamedays (
    order_id UUID NOT NULL REFERENCES game_pass_orders(id) ON DELETE CASCADE,
    event_day_id UUID NOT NULL REFERENCES event_days(id) ON DELETE CASCADE,
    PRIMARY KEY (order_id, event_day_id)
);

-- Bundled tickets are ordinary tickets (one per holder per gameday), linked
-- back to their order. They carry no paystack_reference of their own: that
-- column is unique, and the reference belongs to the order.
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS game_pass_order_id UUID NULL
    REFERENCES game_pass_orders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_game_pass_order ON tickets (game_pass_order_id) WHERE game_pass_order_id IS NOT NULL;

-- +goose Down
DROP INDEX IF EXISTS idx_tickets_game_pass_order;
ALTER TABLE tickets DROP COLUMN IF EXISTS game_pass_order_id;
DROP TABLE IF EXISTS game_pass_order_gamedays;
DROP INDEX IF EXISTS idx_game_pass_orders_email;
DROP INDEX IF EXISTS idx_game_pass_orders_status_created;
DROP TABLE IF EXISTS game_pass_orders;
