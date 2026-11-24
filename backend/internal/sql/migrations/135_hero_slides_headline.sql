-- +goose Up

-- Optional short caption shown in the hero carousel's side preview panel.
-- Free text, no legacy equivalent, so no backfill is needed.
ALTER TABLE hero_slides ADD COLUMN IF NOT EXISTS headline TEXT;

-- +goose Down
ALTER TABLE hero_slides DROP COLUMN IF EXISTS headline;
