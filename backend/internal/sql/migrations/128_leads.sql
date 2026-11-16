-- +goose Up

-- People who said they are interested in Showtime: watching games, meeting the
-- coaches or playing flag football. They arrive through the public /join page,
-- usually from a link the social media and community teams share, so each lead
-- remembers which link (source) first brought them in.
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    email VARCHAR(254) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    -- Keys from the form: watch, coaches, play.
    interests TEXT[] NOT NULL DEFAULT '{}',
    -- Where they came from (instagram, whatsapp, ...): the first link they used.
    source VARCHAR(40) NOT NULL DEFAULT 'direct',
    -- They ticked the box agreeing to hear from us about game days.
    consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One lead per email, however many times the form is submitted.
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_email_lower ON leads (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads (created_at DESC);

-- +goose Down

DROP TABLE IF EXISTS leads;
