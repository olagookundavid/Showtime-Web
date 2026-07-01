-- +goose Up
-- Optional mobile-specific hero image. The desktop image is a wide 2:1 banner;
-- on a near-square mobile hero box that gets cropped. Admins can upload a
-- square (~1080x1080) mobile variant per slide; when absent, the frontend
-- falls back to the desktop image_url.
ALTER TABLE hero_slides ADD COLUMN IF NOT EXISTS mobile_image_url TEXT;

-- +goose Down
ALTER TABLE hero_slides DROP COLUMN IF EXISTS mobile_image_url;
