-- +goose Up
-- Add news_id to team_of_the_week
ALTER TABLE team_of_the_week
ADD COLUMN IF NOT EXISTS news_id UUID REFERENCES news(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_totw_news_id ON team_of_the_week(news_id);

-- +goose Down
DROP INDEX IF EXISTS idx_totw_news_id;
ALTER TABLE team_of_the_week DROP COLUMN IF EXISTS news_id;
