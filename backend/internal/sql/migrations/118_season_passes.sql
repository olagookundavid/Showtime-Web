-- +goose Up

-- A Season Pass is a standalone ticket: an admin gives it a name, a price and an
-- end date. Whoever holds its code is let in at every match day up to and including
-- that end date. It is not made from a ticket, not tied to a tournament, and its
-- price is not worked out from anything; the admin types it.
CREATE TABLE IF NOT EXISTS season_passes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    -- Naira for one pass.
    price INT NOT NULL DEFAULT 0 CHECK (price >= 0),
    -- The last day the pass lets people in. A plain date, in Lagos time.
    ends_on DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    -- Dormant. A pass may later be tied to a ticket (and through it to
    -- competitions). Nothing reads or writes this yet and no API exposes it.
    product_id UUID REFERENCES ticket_products(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A pass is bought as one ticket. It has no match days: validity is the pass's end
-- date, so no seats are taken and no per-day reminders are sent.
ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS season_pass_id UUID REFERENCES season_passes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_season_pass ON tickets (season_pass_id);

ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_purchase_type_check;
ALTER TABLE tickets
    ADD CONSTRAINT tickets_purchase_type_check CHECK (purchase_type IN ('SINGLE', 'GAME_PASS', 'SEASON_PASS'));

-- One row per pass per day it was used to get in. A second scan the same day is
-- still let in and is not recorded twice.
CREATE TABLE IF NOT EXISTS season_pass_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    checked_in_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (ticket_id, entry_date)
);

-- +goose Down
DROP TABLE IF EXISTS season_pass_entries;
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_purchase_type_check;
UPDATE tickets SET purchase_type = 'GAME_PASS' WHERE purchase_type = 'SEASON_PASS';
ALTER TABLE tickets
    ADD CONSTRAINT tickets_purchase_type_check CHECK (purchase_type IN ('SINGLE', 'GAME_PASS'));
ALTER TABLE tickets DROP COLUMN IF EXISTS season_pass_id;
DROP TABLE IF EXISTS season_passes;
