-- +goose Up
-- The photo gallery was removed from the site. Drop its table and take the
-- "gallery" feature off every role so the roles page doesn't carry a dead entry.
DELETE FROM role_permissions WHERE feature = 'gallery';
DROP TABLE IF EXISTS gallery;

-- +goose Down
-- The photos are gone for good; this only restores an empty table.
CREATE TABLE IF NOT EXISTS gallery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_week VARCHAR(255) NOT NULL,
    date VARCHAR(100) NOT NULL,
    players_photo_url VARCHAR(255) NOT NULL,
    fans_photo_url VARCHAR(255) NOT NULL,
    competition_id UUID REFERENCES competitions(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
