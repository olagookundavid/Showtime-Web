-- +goose Up

-- Hero slides shown on the home page MainHeroCarousel. Previously the slides
-- were hard-coded in the frontend; this table lets admins add/remove/reorder
-- images on the fly. The carousel UI is small (3-5 slides), so a flat table
-- with a manual display_order column is enough.
CREATE TABLE IF NOT EXISTS hero_slides (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_url     TEXT NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hero_slides_order ON hero_slides(display_order, created_at);

-- +goose Down

DROP INDEX IF EXISTS idx_hero_slides_order;
DROP TABLE IF EXISTS hero_slides;
