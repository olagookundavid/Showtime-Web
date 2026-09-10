-- +goose Up
ALTER TABLE fantasy_player_prices
    ADD COLUMN IF NOT EXISTS is_overridden BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS calculated_price NUMERIC(10,2);

UPDATE fantasy_player_prices
SET calculated_price = price
WHERE calculated_price IS NULL;

-- +goose Down
ALTER TABLE fantasy_player_prices
    DROP COLUMN IF EXISTS is_overridden,
    DROP COLUMN IF EXISTS calculated_price;
