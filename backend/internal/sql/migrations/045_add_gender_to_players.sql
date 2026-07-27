-- +goose Up
ALTER TABLE players
    ADD COLUMN IF NOT EXISTS gender VARCHAR(1) CHECK (gender IN ('M', 'F'));

-- +goose Down
ALTER TABLE players
    DROP COLUMN IF EXISTS gender;
