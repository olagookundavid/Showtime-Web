-- Rolls back Arena migration 001. DESTROYS all Arena data. Run by hand only.

BEGIN;

DROP TABLE IF EXISTS arena_follows;
DROP TABLE IF EXISTS arena_match_player_stats;
DROP TABLE IF EXISTS arena_team_sheet_players;
DROP TABLE IF EXISTS arena_team_sheets;
DROP TABLE IF EXISTS arena_matches;
DROP TABLE IF EXISTS arena_registrations;
DROP TABLE IF EXISTS arena_contract_events;
DROP TABLE IF EXISTS arena_contracts;
DROP TABLE IF EXISTS arena_players;
DROP TABLE IF EXISTS arena_division_clubs;
DROP TABLE IF EXISTS arena_clubs;
DROP TABLE IF EXISTS arena_divisions;
DROP TABLE IF EXISTS arena_seasons;
DELETE FROM role_permissions WHERE role_key = 'arena_admin';
DELETE FROM roles WHERE key = 'arena_admin';

COMMIT;
