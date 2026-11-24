-- +goose Up

-- Arena 3/3: the arena_admin role and its permissions.
-- Clubs Arena migration (tagged "arena" in the file name so the product's files
-- are easy to find and lift out later: ls *_arena_*.sql).

-- A role for people who only run Arena. It holds the Arena features and nothing
-- from the Showtime admin panel.
INSERT INTO roles (key, name, description, is_system) VALUES
    ('arena_admin', 'Arena Admin', 'Runs Clubs Arena: seasons, clubs, players, results and transfers.', FALSE)
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role_key, feature, level) VALUES
    ('arena_admin', 'arena_seasons', 'full'),
    ('arena_admin', 'arena_clubs', 'full'),
    ('arena_admin', 'arena_results', 'full'),
    ('arena_admin', 'arena_transfers', 'full')
ON CONFLICT (role_key, feature) DO NOTHING;

-- +goose Down
DELETE FROM role_permissions WHERE role_key = 'arena_admin';
DELETE FROM roles WHERE key = 'arena_admin';
