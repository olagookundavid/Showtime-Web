-- +goose Up
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS playoff_competition_id UUID REFERENCES competitions(id) ON DELETE SET NULL;

-- +goose Down
ALTER TABLE competitions DROP COLUMN IF EXISTS playoff_competition_id;
