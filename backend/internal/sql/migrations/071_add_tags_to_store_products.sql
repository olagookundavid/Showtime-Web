-- +goose Up
ALTER TABLE store_products
    ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_store_products_tags ON store_products USING GIN(tags);

-- +goose Down
DROP INDEX IF EXISTS idx_store_products_tags;
ALTER TABLE store_products DROP COLUMN IF EXISTS tags;
