-- +goose Up

ALTER TABLE competitions
ADD COLUMN status VARCHAR(20) DEFAULT 'active' NOT NULL;

-- +goose Down

ALTER TABLE competitions
DROP COLUMN status;