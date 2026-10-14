-- +goose Up

-- A ticket is now linked to competitions (the Season, the Cup, 5v5...), not to
-- individual match days. Every match day of a linked competition is
-- automatically on sale for that ticket, so setting a ticket up is "pick a price,
-- a seat limit and the competitions", and new fixtures need no extra work.
--
-- ticket_product_days stays, but only as the row that is locked to keep a match
-- day from overselling: it is created the first time a day is looked at for a
-- ticket. The per-day price, seat limit and on/off switch it used to carry move
-- up to the ticket itself.

CREATE TABLE IF NOT EXISTS ticket_product_competitions (
    product_id UUID NOT NULL REFERENCES ticket_products(id) ON DELETE CASCADE,
    competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (product_id, competition_id)
);
CREATE INDEX IF NOT EXISTS idx_ticket_product_competitions_competition
    ON ticket_product_competitions (competition_id);

-- Seats per match day, the same for every day of every linked competition.
-- 0 means unlimited. Anything an admin had already set per day is carried up as
-- the highest of those limits, so no ticket becomes tighter than it was.
ALTER TABLE ticket_products
    ADD COLUMN IF NOT EXISTS capacity INT NOT NULL DEFAULT 0 CHECK (capacity >= 0);

UPDATE ticket_products p
SET capacity = COALESCE((SELECT MAX(d.capacity) FROM ticket_product_days d WHERE d.product_id = p.id), 0);

-- Everything is bought as a Game Pass now (one or more match days), so a ticket
-- no longer opts out of it.
ALTER TABLE ticket_products DROP COLUMN IF EXISTS allow_game_pass;

ALTER TABLE ticket_product_days
    DROP COLUMN IF EXISTS price_override,
    DROP COLUMN IF EXISTS capacity,
    DROP COLUMN IF EXISTS is_active;

-- +goose Down
ALTER TABLE ticket_product_days
    ADD COLUMN IF NOT EXISTS price_override INT CHECK (price_override IS NULL OR price_override >= 0),
    ADD COLUMN IF NOT EXISTS capacity INT NOT NULL DEFAULT 0 CHECK (capacity >= 0),
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE ticket_products ADD COLUMN IF NOT EXISTS allow_game_pass BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE ticket_products DROP COLUMN IF EXISTS capacity;
DROP TABLE IF EXISTS ticket_product_competitions;
