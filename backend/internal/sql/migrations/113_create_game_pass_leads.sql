-- +goose Up

-- Game Pass leads: a buyer's "notify me" interest in a bundle, captured before
-- real purchases exist. Not a purchase and not binding. The pricing columns are
-- a snapshot the server computed when the lead was submitted.
CREATE TABLE IF NOT EXISTS game_pass_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    tier_name TEXT NOT NULL,
    -- An interest record, so an array is enough; nothing joins through it.
    gameday_ids UUID[] NOT NULL,
    holders INT NOT NULL,
    standard_total INT NOT NULL,
    discount_percent INT NOT NULL,
    discount_amount INT NOT NULL,
    total INT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT game_pass_leads_status_check CHECK (status IN ('new', 'contacted', 'converted', 'dismissed')),
    CONSTRAINT game_pass_leads_holders_check CHECK (holders >= 1)
);

CREATE INDEX IF NOT EXISTS idx_game_pass_leads_status_created ON game_pass_leads (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_pass_leads_email ON game_pass_leads (LOWER(email));

-- +goose Down
DROP INDEX IF EXISTS idx_game_pass_leads_email;
DROP INDEX IF EXISTS idx_game_pass_leads_status_created;
DROP TABLE IF EXISTS game_pass_leads;
