-- +goose Up
-- The badge artwork library. Badges pick their image from here (badges.icon holds
-- the chosen image_url); admins manage the library itself in Badges & Honors.
-- Replacing an icon's image also updates every badge that was using it.
CREATE TABLE IF NOT EXISTS badge_icons (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(100) NOT NULL,
    image_url  TEXT         NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- One library entry per image, so a badge's artwork maps to exactly one icon.
CREATE UNIQUE INDEX IF NOT EXISTS badge_icons_image_url_key ON badge_icons (image_url);

-- Start with the ten official Showtime emblems (previously hard-coded in the
-- admin page)...
INSERT INTO badge_icons (name, image_url) VALUES
    ('Game MVP',             'https://cdn.sffl.football/badges/game-mvp.png'),
    ('Player of the Week',   'https://cdn.sffl.football/badges/player-of-the-week.png'),
    ('Team of the Week',     'https://cdn.sffl.football/badges/team-of-the-week.png'),
    ('Team of the Season',   'https://cdn.sffl.football/badges/team-of-the-season.png'),
    ('Best Defender',        'https://cdn.sffl.football/badges/best-defender.png'),
    ('Best Receiver',        'https://cdn.sffl.football/badges/best-receiver.png'),
    ('Best Rusher',          'https://cdn.sffl.football/badges/best-rusher.png'),
    ('Best Center',          'https://cdn.sffl.football/badges/best-center.png'),
    ('Rookie of the Season', 'https://cdn.sffl.football/badges/rookie-of-the-season.png'),
    ('Tournament MVP',       'https://cdn.sffl.football/badges/tournament-mvp.png')
ON CONFLICT (image_url) DO NOTHING;

-- ...plus any uploaded artwork badges already use, so nothing in use is missing
-- from the library. Emoji icons from the earliest badges are not images and stay out.
INSERT INTO badge_icons (name, image_url)
SELECT DISTINCT ON (icon) name, icon
FROM badges
WHERE icon ~* '^(https?://|/)'
ORDER BY icon, is_system DESC, name
ON CONFLICT (image_url) DO NOTHING;

-- +goose Down
DROP TABLE IF EXISTS badge_icons;
