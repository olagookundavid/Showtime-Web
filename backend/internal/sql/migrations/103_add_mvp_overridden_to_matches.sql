-- +goose Up
ALTER TABLE matches ADD COLUMN IF NOT EXISTS mvp_overridden BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_matches_mvp_overridden ON matches(mvp_overridden) WHERE mvp_overridden = true;

-- +goose Down
DROP INDEX IF EXISTS idx_matches_mvp_overridden;
ALTER TABLE matches DROP COLUMN IF EXISTS mvp_overridden;
