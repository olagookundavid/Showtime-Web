-- +goose Up
ALTER TABLE inventory_sales ADD COLUMN payment_method VARCHAR(50) NOT NULL DEFAULT 'Cash';

-- +goose Down
ALTER TABLE inventory_sales DROP COLUMN payment_method;
