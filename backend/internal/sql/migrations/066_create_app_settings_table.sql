-- +goose Up
-- Small key/value store for site-wide display settings an admin can change at
-- runtime. Seeded with the default app font so a fresh install reads the same
-- value the frontend falls back to.
CREATE TABLE IF NOT EXISTS app_settings (
    setting_key   VARCHAR(64) PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_settings (setting_key, setting_value)
VALUES ('app_font_id', 'georgia')
ON CONFLICT (setting_key) DO NOTHING;

-- +goose Down
DROP TABLE IF EXISTS app_settings;
