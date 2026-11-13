-- +goose Up

-- Only admins edit players and teams. Commissioners keep viewing them, and keep the
-- approvals they already hold (account claims, committing match results, force-accepting
-- contracts, transfers). Prompted by a commissioner re-rostering 26 players by direct
-- player edit on 10 Nov 2026, which put them on teams with no contract.
UPDATE role_permissions SET level = 'view'
WHERE role_key = 'commissioner' AND feature IN ('players', 'teams_standings');

-- +goose Down

UPDATE role_permissions SET level = 'full'
WHERE role_key = 'commissioner' AND feature IN ('players', 'teams_standings');
