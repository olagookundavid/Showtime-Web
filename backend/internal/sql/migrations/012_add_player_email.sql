-- +goose Up
ALTER TABLE players ADD COLUMN email VARCHAR(255) NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE players DROP COLUMN IF EXISTS email;
