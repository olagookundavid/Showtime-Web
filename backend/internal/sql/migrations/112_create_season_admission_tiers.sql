-- +goose Up

-- Season admission tiers: one authoritative per-gameday rate for each admission
-- tier, used to price Game Pass bundles. Separate from ticket_tiers, which stay
-- the per-gameday prices for single ticket sales.
CREATE TABLE IF NOT EXISTS season_admission_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    -- Whole naira.
    price INT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT season_admission_tiers_name_check CHECK (btrim(name) <> ''),
    CONSTRAINT season_admission_tiers_price_check CHECK (price >= 0)
);

-- A Game Pass tier is matched to each gameday's ticket tier by name, so names
-- must be unique regardless of case.
CREATE UNIQUE INDEX IF NOT EXISTS uq_season_admission_tiers_name ON season_admission_tiers (LOWER(name));

-- +goose Down
DROP INDEX IF EXISTS uq_season_admission_tiers_name;
DROP TABLE IF EXISTS season_admission_tiers;
