-- +goose Up

-- Tickets become first-class products (5K, VIP, VVIP...). A product is sold per
-- match day (event_days) through ticket_product_days, which carries the price
-- override and capacity. A purchase is one ticket row with one ticket_days row per
-- match day it covers: one day is a normal ticket, several is a Game Pass.
--
-- This replaces ticket_tiers (a tier belonged to exactly one event day). Event
-- days stay: fantasy, matches and team of the week all hang off them.

CREATE TABLE IF NOT EXISTS ticket_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    -- Price per match day. A day can override it in ticket_product_days.
    base_price INT NOT NULL DEFAULT 0 CHECK (base_price >= 0),
    is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
    access_code VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    -- Some products (a 5K run, say) should not be sold as a multi-day pass.
    allow_game_pass BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_products_name ON ticket_products (LOWER(name));

-- The oversell-lock row: one per product per match day it is sold on.
-- Sold and held counts are derived from tickets, not stored here, so they cannot
-- drift from the tickets that actually exist.
CREATE TABLE IF NOT EXISTS ticket_product_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES ticket_products(id) ON DELETE CASCADE,
    event_day_id UUID NOT NULL REFERENCES event_days(id) ON DELETE CASCADE,
    -- NULL means use the product's base_price.
    price_override INT CHECK (price_override IS NULL OR price_override >= 0),
    -- 0 means unlimited, as it did for tiers.
    capacity INT NOT NULL DEFAULT 0 CHECK (capacity >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, event_day_id)
);
CREATE INDEX IF NOT EXISTS idx_ticket_product_days_event_day ON ticket_product_days (event_day_id);

-- Percentage off a Game Pass by how many days it covers. The rule that applies is
-- the active one with the highest min_days that the selection reaches.
CREATE TABLE IF NOT EXISTS game_pass_discount_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    min_days INT NOT NULL UNIQUE CHECK (min_days >= 2),
    percent_off NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (percent_off >= 0 AND percent_off <= 100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Launch at 0% everywhere: a 3-day pass costs 3x until an admin sets a ladder.
INSERT INTO game_pass_discount_rules (min_days, percent_off) VALUES (2, 0), (3, 0), (4, 0), (5, 0)
ON CONFLICT (min_days) DO NOTHING;

ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES ticket_products(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS purchase_type VARCHAR(20) NOT NULL DEFAULT 'SINGLE'
        CHECK (purchase_type IN ('SINGLE', 'GAME_PASS')),
    ADD COLUMN IF NOT EXISTS product_name VARCHAR(100) NOT NULL DEFAULT '',
    -- unit_price x quantity before any discount.
    ADD COLUMN IF NOT EXISTS subtotal INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS game_pass_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS game_pass_discount_amount INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_tickets_product ON tickets (product_id);

-- One row per match day a ticket covers. Title/date/venue are copied at purchase
-- so the ticket stays readable if the match day is later edited or removed, and
-- attendance is tracked per day so one code can cover a whole pass.
CREATE TABLE IF NOT EXISTS ticket_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    event_day_id UUID REFERENCES event_days(id) ON DELETE SET NULL,
    product_day_id UUID REFERENCES ticket_product_days(id) ON DELETE SET NULL,
    unit_price INT NOT NULL DEFAULT 0,
    day_title VARCHAR(255) NOT NULL DEFAULT '',
    day_date DATE,
    day_venue VARCHAR(255) NOT NULL DEFAULT '',
    checked_in_at TIMESTAMPTZ,
    checked_in_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ticket_days_ticket ON ticket_days (ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_days_event_day ON ticket_days (event_day_id);
CREATE INDEX IF NOT EXISTS idx_ticket_days_product_day ON ticket_days (product_day_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_days_unique_day ON ticket_days (ticket_id, event_day_id)
    WHERE event_day_id IS NOT NULL;

-- Carry every existing ticket into the new shape (one day each) before the old
-- columns go, so sales history, revenue and past check-ins survive.
UPDATE tickets SET product_name = tier_name, subtotal = unit_price * quantity;

INSERT INTO ticket_days (ticket_id, event_day_id, unit_price, day_title, day_date, day_venue, checked_in_at, checked_in_by)
SELECT t.id, t.event_day_id, t.unit_price, t.event_title, t.event_date, t.event_venue, t.checked_in_at, t.checked_in_by
FROM tickets t;

-- Existing discount codes are retired: nothing they point at survives, and the
-- new code system targets ticket products. Redemption history is kept.
UPDATE discount_codes SET is_active = FALSE, expires_at = NOW()
WHERE id IN (SELECT discount_code_id FROM discount_code_items WHERE entity_type = 'ticket_tier');

DELETE FROM discount_code_items WHERE entity_type = 'ticket_tier';

ALTER TABLE discount_code_items DROP CONSTRAINT IF EXISTS discount_code_items_entity_type_check;
ALTER TABLE discount_code_items
    ADD CONSTRAINT discount_code_items_entity_type_check CHECK (entity_type IN ('product', 'ticket_product'));

-- The per-event columns move to ticket_days; tiers are replaced by products.
ALTER TABLE tickets
    DROP COLUMN IF EXISTS event_day_id,
    DROP COLUMN IF EXISTS tier_id,
    DROP COLUMN IF EXISTS checked_in_at,
    DROP COLUMN IF EXISTS checked_in_by,
    DROP COLUMN IF EXISTS event_title,
    DROP COLUMN IF EXISTS event_date,
    DROP COLUMN IF EXISTS event_venue,
    DROP COLUMN IF EXISTS tier_name;

DROP TABLE IF EXISTS ticket_tiers;

-- +goose Down
-- The tier model cannot be rebuilt from products, so this only removes what Up
-- added. Restore from a backup to go back to tiers.
ALTER TABLE tickets
    DROP COLUMN IF EXISTS game_pass_discount_amount,
    DROP COLUMN IF EXISTS game_pass_discount_percent,
    DROP COLUMN IF EXISTS subtotal,
    DROP COLUMN IF EXISTS product_name,
    DROP COLUMN IF EXISTS purchase_type,
    DROP COLUMN IF EXISTS product_id;
DROP TABLE IF EXISTS ticket_days;
DROP TABLE IF EXISTS game_pass_discount_rules;
DROP TABLE IF EXISTS ticket_product_days;
DROP TABLE IF EXISTS ticket_products;
