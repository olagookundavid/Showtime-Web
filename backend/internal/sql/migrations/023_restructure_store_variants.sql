-- +goose Up

-- Restructure variants from a single-dimension model (one row per option/value
-- pair) to a combination model where each variant row is a unique product
-- option tuple (e.g. Size=M, Color=Navy, AgeGroup=Adults). Pricing is owned by
-- ONE option (drives_price) so admins enter prices once per pricing value
-- rather than once per combination.

-- 1. Add product-level options definition. Cap is enforced in code (3 options).
ALTER TABLE store_products
    ADD COLUMN IF NOT EXISTS options JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. Replace per-(name,value) variant model with per-combination model.
--    Existing rows are dev-only test data; safe to wipe.
DELETE FROM store_product_variants;

ALTER TABLE store_product_variants
    DROP COLUMN IF EXISTS variant_name,
    DROP COLUMN IF EXISTS variant_value,
    DROP COLUMN IF EXISTS price;

ALTER TABLE store_product_variants
    ADD COLUMN IF NOT EXISTS option1_value VARCHAR(100),
    ADD COLUMN IF NOT EXISTS option2_value VARCHAR(100),
    ADD COLUMN IF NOT EXISTS option3_value VARCHAR(100),
    ADD COLUMN IF NOT EXISTS image_url     TEXT;

-- Uniqueness of a combination within a product. NULLs are treated as distinct
-- in Postgres, which works for us since a product either uses N options
-- consistently across all its variants or uses none.
CREATE UNIQUE INDEX IF NOT EXISTS idx_store_product_variants_combo
    ON store_product_variants(product_id, option1_value, option2_value, option3_value);

-- 3. Snapshot the human-readable variant label onto each order item so the
--    receipt survives admin-side renames/deletes of variant values.
ALTER TABLE online_order_items
    ADD COLUMN IF NOT EXISTS variant_label TEXT NOT NULL DEFAULT '';

-- +goose Down

ALTER TABLE online_order_items
    DROP COLUMN IF EXISTS variant_label;

DROP INDEX IF EXISTS idx_store_product_variants_combo;

ALTER TABLE store_product_variants
    DROP COLUMN IF EXISTS option1_value,
    DROP COLUMN IF EXISTS option2_value,
    DROP COLUMN IF EXISTS option3_value,
    DROP COLUMN IF EXISTS image_url;

ALTER TABLE store_product_variants
    ADD COLUMN IF NOT EXISTS variant_name  VARCHAR(100) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS variant_value VARCHAR(100) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS price         NUMERIC(12, 2);

ALTER TABLE store_products
    DROP COLUMN IF EXISTS options;
