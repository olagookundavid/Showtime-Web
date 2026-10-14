-- +goose Up

-- A Season Pass is offered on top of a ticket: it covers every match day still to
-- be played in the competitions that ticket is linked to, at a percentage off the
-- ticket's price per day. The price is not stored. It is worked out when someone
-- looks at the pass or buys it, from the match days that remain, so it falls as
-- the season goes on.
CREATE TABLE IF NOT EXISTS season_passes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- One pass per ticket.
    product_id UUID NOT NULL UNIQUE REFERENCES ticket_products(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    percent_off NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (percent_off >= 0 AND percent_off <= 100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A season pass is bought as one ticket with a day per remaining match day, so
-- seats, check-in and reminders work exactly as they do for a Game Pass.
ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS season_pass_id UUID REFERENCES season_passes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_season_pass ON tickets (season_pass_id);

ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_purchase_type_check;
ALTER TABLE tickets
    ADD CONSTRAINT tickets_purchase_type_check CHECK (purchase_type IN ('SINGLE', 'GAME_PASS', 'SEASON_PASS'));

-- +goose Down
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_purchase_type_check;
UPDATE tickets SET purchase_type = 'GAME_PASS' WHERE purchase_type = 'SEASON_PASS';
ALTER TABLE tickets
    ADD CONSTRAINT tickets_purchase_type_check CHECK (purchase_type IN ('SINGLE', 'GAME_PASS'));
ALTER TABLE tickets DROP COLUMN IF EXISTS season_pass_id;
DROP TABLE IF EXISTS season_passes;
