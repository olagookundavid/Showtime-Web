-- +goose Up

-- A bundle in the catalogue is now either a BUNDLE (a list of items, sold in the
-- shop or given away) or a VALUE "price voucher": a named amount of money, such as
-- "Thank you, 10,000 naira", that admins keep here to give to many people. A price
-- voucher is never sold in the shop, and has no items.
ALTER TABLE voucher_products ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'BUNDLE';

ALTER TABLE voucher_products ADD CONSTRAINT voucher_products_kind_check CHECK (kind IN ('BUNDLE', 'VALUE'));
ALTER TABLE voucher_products ADD CONSTRAINT voucher_products_value_check
    CHECK (kind <> 'VALUE' OR (price_kobo > 0 AND items = '[]'::jsonb));

-- +goose Down

ALTER TABLE voucher_products DROP CONSTRAINT IF EXISTS voucher_products_value_check;
ALTER TABLE voucher_products DROP CONSTRAINT IF EXISTS voucher_products_kind_check;
ALTER TABLE voucher_products DROP COLUMN IF EXISTS kind;
