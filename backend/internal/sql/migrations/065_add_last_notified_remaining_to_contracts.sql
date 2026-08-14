-- +goose Up
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS last_notified_remaining INT DEFAULT -1;

-- +goose Down
ALTER TABLE contracts DROP COLUMN IF EXISTS last_notified_remaining;
