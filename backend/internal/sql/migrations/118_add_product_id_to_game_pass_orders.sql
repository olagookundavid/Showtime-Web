-- +goose Up

-- Game Pass checkout now prices and reserves against ticket_products /
-- ticket_product_days instead of season_admission_tiers (which ticket_tiers,
-- what checkout used to match season tiers against, no longer exists to
-- back). season_tier_id stays on the table — nothing written under the old
-- path is lost — it just stops being set by new orders.
ALTER TABLE game_pass_orders
    ADD COLUMN IF NOT EXISTS product_id UUID NULL REFERENCES ticket_products(id) ON DELETE SET NULL;

-- +goose Down
ALTER TABLE game_pass_orders DROP COLUMN IF EXISTS product_id;
