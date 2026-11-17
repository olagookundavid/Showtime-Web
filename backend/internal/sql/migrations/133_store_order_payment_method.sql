-- +goose Up

-- How a store order was paid. Cancelling a wallet-paid order puts the money back
-- in the buyer's wallet; a card payment is never refunded automatically. Every
-- order before this column was paid with Paystack (or was free), so the default
-- fits all existing rows.
ALTER TABLE online_orders ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'paystack';

-- +goose Down

ALTER TABLE online_orders DROP COLUMN IF EXISTS payment_method;
