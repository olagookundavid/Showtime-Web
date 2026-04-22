-- +goose Up
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS phone VARCHAR(30) NULL;

-- +goose Down
ALTER TABLE tickets DROP COLUMN IF EXISTS phone;
