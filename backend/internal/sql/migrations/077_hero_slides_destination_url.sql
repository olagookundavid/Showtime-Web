-- +goose Up

-- Generic destination for a hero slide — a free-text internal path
-- (e.g. /stats, /news/some-slug) or an external URL, pasted in by the admin.
-- Replaces the old model where a slide could ONLY link to an
-- auto-created hidden News article via news_id. news_id/news stay in the
-- schema (nullable, read-only going forward) purely so slides created
-- before this migration keep rendering/linking without any data loss.
ALTER TABLE hero_slides ADD COLUMN IF NOT EXISTS destination_url TEXT;

-- Backfill: existing slides that only had a linked article get an
-- equivalent destination_url pointing at that article's public URL, so
-- the new column is immediately authoritative for every slide.
UPDATE hero_slides hs
SET destination_url = '/news/' || n.slug
FROM news n
WHERE hs.news_id = n.id
  AND hs.destination_url IS NULL;

-- +goose Down
ALTER TABLE hero_slides DROP COLUMN IF EXISTS destination_url;
