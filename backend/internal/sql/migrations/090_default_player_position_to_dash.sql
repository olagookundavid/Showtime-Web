-- +goose Up
UPDATE players
SET position = '-'
WHERE position IS NULL OR TRIM(position) = '' OR LOWER(position) = 'null';

ALTER TABLE players
    ALTER COLUMN position SET DEFAULT '-';

ALTER TABLE players
    ALTER COLUMN position SET NOT NULL;

-- +goose Down
ALTER TABLE players
    ALTER COLUMN position DROP NOT NULL;

ALTER TABLE players
    ALTER COLUMN position DROP DEFAULT;
