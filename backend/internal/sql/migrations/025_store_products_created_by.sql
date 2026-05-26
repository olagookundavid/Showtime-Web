-- +goose Up

-- Track which admin added each product. Nullable + ON DELETE SET NULL so
-- removing a user account doesn't break their products' history.
ALTER TABLE store_products
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_store_products_created_by ON store_products(created_by);

-- +goose Down

DROP INDEX IF EXISTS idx_store_products_created_by;
ALTER TABLE store_products DROP COLUMN IF EXISTS created_by;
