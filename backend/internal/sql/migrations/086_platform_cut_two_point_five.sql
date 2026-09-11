-- +goose Up
-- The platform's cut of paid-league entry fees drops from 10% to 2.5%, leaving
-- 97.5% of the gross in the prize pool.
--
-- Only a stored value of exactly '10' is moved. The setting is admin-editable,
-- so anything else is a deliberate choice someone made and this must not
-- silently undo it. Migration 075 seeded '10', so that is what is being undone.
UPDATE app_settings
SET setting_value = '2.5'
WHERE setting_key = 'fantasy_platform_cut_percent'
  AND setting_value = '10';

-- Environments that never got the row (the seed used ON CONFLICT DO NOTHING)
-- still need one, or they fall through to the Go default.
INSERT INTO app_settings (setting_key, setting_value)
VALUES ('fantasy_platform_cut_percent', '2.5')
ON CONFLICT (setting_key) DO NOTHING;

-- +goose Down
-- Symmetrically, only undo the value this migration set.
UPDATE app_settings
SET setting_value = '10'
WHERE setting_key = 'fantasy_platform_cut_percent'
  AND setting_value = '2.5';
