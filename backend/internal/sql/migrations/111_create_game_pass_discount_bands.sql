-- +goose Up

-- Game Pass discount bands: the bundle discount a buyer gets for the number of
-- gamedays they put in one Game Pass. Global, admin managed.
--
-- The service validates every save and names the conflicting band; the
-- constraints below are the backstop, so a race between two admins (or a
-- hand-written UPDATE) can never leave the pricing table ambiguous.
CREATE TABLE IF NOT EXISTS game_pass_discount_bands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    min_gamedays INT NOT NULL,
    -- NULL means open ended: the top band, "6 or more".
    max_gamedays INT NULL,
    discount_percent INT NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT game_pass_discount_bands_min_check CHECK (min_gamedays >= 2),
    CONSTRAINT game_pass_discount_bands_max_check CHECK (max_gamedays IS NULL OR max_gamedays >= min_gamedays),
    CONSTRAINT game_pass_discount_bands_percent_check CHECK (discount_percent BETWEEN 0 AND 100),

    -- Active bands must not overlap. int4range with a NULL upper bound is
    -- unbounded, so two active open-ended bands always overlap too — this one
    -- constraint also enforces "at most one open-ended band".
    CONSTRAINT game_pass_discount_bands_no_overlap
        EXCLUDE USING gist (int4range(min_gamedays, max_gamedays, '[]') WITH &&)
        WHERE (is_active)
);

INSERT INTO game_pass_discount_bands (min_gamedays, max_gamedays, discount_percent, display_order) VALUES
    (2, 3, 5, 1),
    (4, 5, 10, 2),
    (6, NULL, 15, 3);

-- +goose Down
DROP TABLE IF EXISTS game_pass_discount_bands;
