-- +goose Up

-- A voucher is now either a BUNDLE (a fixed list of items, as before) or a VALUE
-- voucher: a set amount of money, e.g. a "Thank you" voucher worth 10,000 naira,
-- that the bar takes off the bill. Both are redeemed once, only on valid dates.
--
-- For a VALUE voucher price_kobo is its amount, items is empty and product_id is
-- NULL. description is the line shown to the holder ("Valid for anything at the
-- Showtime bar"); bundles copy their product's description into it.
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'BUNDLE';
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';

ALTER TABLE vouchers ADD CONSTRAINT vouchers_kind_check CHECK (kind IN ('BUNDLE', 'VALUE'));
-- A VALUE voucher is worth something; it is always an admin gift, never bought.
ALTER TABLE vouchers ADD CONSTRAINT vouchers_value_check
    CHECK (kind <> 'VALUE' OR (price_kobo > 0 AND source = 'ADMIN_ISSUED'));

-- +goose Down

ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_value_check;
ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_kind_check;
ALTER TABLE vouchers DROP COLUMN IF EXISTS description;
ALTER TABLE vouchers DROP COLUMN IF EXISTS kind;
