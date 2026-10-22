-- +goose Up
-- The carousel at the top of the Fantasy page. Each slide is a published news
-- article an editor chose to feature, in an order they control — the same
-- shape as hero_slides, but pointing at an article rather than an image. The
-- article is the source of truth for the slide's title, picture and link, so
-- editing the article updates the slide, and deleting it removes the slide.
CREATE TABLE IF NOT EXISTS fantasy_carousel_slides (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    news_id       UUID NOT NULL UNIQUE REFERENCES news(id) ON DELETE CASCADE,
    display_order INT NOT NULL DEFAULT 0,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fantasy_carousel_slides_order
    ON fantasy_carousel_slides (display_order, created_at);

-- Whoever can manage the homepage hero slides can manage this carousel too, at
-- the same level. It is a separate permission so a role can be given one
-- without the other from the Roles page.
INSERT INTO role_permissions (role_key, feature, level)
SELECT role_key, 'fantasy_carousel', level
FROM role_permissions
WHERE feature = 'hero_slides'
ON CONFLICT (role_key, feature) DO NOTHING;

-- +goose Down
DELETE FROM role_permissions WHERE feature = 'fantasy_carousel';
DROP TABLE IF EXISTS fantasy_carousel_slides;
