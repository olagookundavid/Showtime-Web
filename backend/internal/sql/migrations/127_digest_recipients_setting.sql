-- +goose Up

-- Who gets the weekly league-wide contract summary is now a setting (App Settings >
-- Notifications) instead of "everyone with the Commissioner role". It starts as just
-- Adebare, as the league asked.
INSERT INTO app_settings (setting_key, setting_value)
SELECT 'contract_digest_recipients', COALESCE(json_agg(id)::text, '[]')
FROM users WHERE lower(email) = 'adebare@sffl.football'
ON CONFLICT (setting_key) DO NOTHING;

-- +goose Down

DELETE FROM app_settings WHERE setting_key IN (
    'contract_digest_recipients', 'contract_default_length', 'contract_onboarding_length',
    'contract_warning_matches', 'contract_team_summaries_enabled', 'contract_league_digest_enabled'
);
