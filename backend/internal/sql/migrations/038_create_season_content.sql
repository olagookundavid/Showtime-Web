-- +goose Up

-- Team of the Season graphics — exactly two rows (offense / defense). Each is an
-- admin-uploaded graphic with an optional square/portrait mobile variant. Upsert
-- by category, so setting a graphic replaces the existing one for that side.
CREATE TABLE IF NOT EXISTS season_graphics (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category         VARCHAR(10) NOT NULL UNIQUE CHECK (category IN ('offense', 'defense')),
    image_url        TEXT NOT NULL,
    mobile_image_url TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Meet our MVPs — an admin-curated list of players, each with a free-text label
-- (e.g. "Offensive MVP", "Rookie of the Season"). Cards link to /players/:id.
CREATE TABLE IF NOT EXISTS season_mvps (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id     UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    label         VARCHAR(80) NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_season_mvps_order ON season_mvps (display_order, created_at);

-- +goose Down
DROP INDEX IF EXISTS idx_season_mvps_order;
DROP TABLE IF EXISTS season_mvps;
DROP TABLE IF EXISTS season_graphics;
