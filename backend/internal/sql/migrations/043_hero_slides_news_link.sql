-- +goose Up

-- Marks a news article as carousel-only: authored from the Hero Slides admin,
-- excluded from the public news list/feed and the admin news list, reachable
-- only via its direct slug URL (linked from a hero slide).
ALTER TABLE news ADD COLUMN IF NOT EXISTS is_hero_only BOOLEAN NOT NULL DEFAULT FALSE;

-- Optional link from a hero slide to the news article it opens when clicked.
-- Nullable: existing slides have none. ON DELETE SET NULL so a deleted article
-- never leaves a dangling reference (the app also deletes the slide's linked
-- article when the slide itself is deleted, since it has no life outside it).
ALTER TABLE hero_slides ADD COLUMN IF NOT EXISTS news_id UUID REFERENCES news(id) ON DELETE SET NULL;

-- +goose Down
ALTER TABLE hero_slides DROP COLUMN IF EXISTS news_id;
ALTER TABLE news DROP COLUMN IF EXISTS is_hero_only;
