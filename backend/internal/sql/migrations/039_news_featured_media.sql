-- +goose Up
-- Featured media for news: either a photo (featured_image, as before) or an
-- embedded YouTube video. featured_media_type selects which one the public
-- pages render; existing rows keep rendering their photo via the default.
ALTER TABLE news ADD COLUMN IF NOT EXISTS featured_media_type VARCHAR(10) NOT NULL DEFAULT 'image';
ALTER TABLE news ADD COLUMN IF NOT EXISTS featured_youtube_url VARCHAR(500) NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE news DROP COLUMN IF EXISTS featured_media_type;
ALTER TABLE news DROP COLUMN IF EXISTS featured_youtube_url;
