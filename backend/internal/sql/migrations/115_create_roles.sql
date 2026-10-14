-- +goose Up

-- Roles and what each may do in the admin panel used to be a hard-coded matrix
-- (middlewares.FeatureAccess) mirrored by hand in the frontend. They live here
-- now so an admin can create a role and change its access without a deploy.
-- A feature is still named in code (a route has to say which feature it is), so
-- role_permissions.feature is not constrained here; the service validates it
-- against the feature catalog on write.
CREATE TABLE IF NOT EXISTS roles (
    key VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    -- System roles (user, player, team_head, seller, app_admin...) have their own
    -- portal or flow in code and can't be edited or deleted from the UI.
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_name_lower ON roles (LOWER(name));

CREATE TABLE IF NOT EXISTS role_permissions (
    role_key VARCHAR(50) NOT NULL REFERENCES roles(key) ON DELETE CASCADE,
    feature VARCHAR(60) NOT NULL,
    -- No row means no access. 'view' is GET-only; 'full' can also change things.
    level VARCHAR(10) NOT NULL CHECK (level IN ('view', 'full')),
    PRIMARY KEY (role_key, feature)
);

-- Roles that keep their own portal or flow in code.
INSERT INTO roles (key, name, description, is_system) VALUES
    ('app_admin',      'App Admin',      'Superuser. Full access to everything, always.', TRUE),
    ('user',           'User',           'A regular signed-in fan.', TRUE),
    ('player',         'Player',         'A claimed player profile. Uses the player portal.', TRUE),
    ('player_pending', 'Player (pending)', 'Has claimed a player profile that is awaiting approval.', TRUE),
    ('team_head',      'Team Head',      'Manages one team from the team-head portal.', TRUE),
    ('seller',         'Seller',         'Sells tickets and merchandise from the seller portal.', TRUE)
ON CONFLICT (key) DO NOTHING;

-- The internal roles, seeded with exactly the access they had in code so
-- nobody gains or loses anything on deploy. From here they are ordinary rows.
INSERT INTO roles (key, name, description, is_system) VALUES
    ('admin',                'Admin',                'Runs the league day to day.', FALSE),
    ('broadcast',            'Broadcast',            'Runs the broadcast studio on match days.', FALSE),
    ('referee',              'Referee',              'Logs plays and stats during matches.', FALSE),
    ('stats',                'Stats',                'Enters and corrects match statistics.', FALSE),
    ('ticketer',             'Ticketer',             'Handles ticketing and referrals.', FALSE),
    ('commissioner',         'Commissioner',         'Runs the competition, teams and players.', FALSE),
    ('fantasy_commissioner', 'Fantasy Commissioner', 'Runs the fantasy game.', FALSE),
    ('head_referee',         'Head Referee',         'Oversees refereeing and commits match results.', FALSE),
    ('news_head',            'News Head',            'Runs news and editorial content.', FALSE),
    ('content_creator',      'Content Creator',      'Creates news, hero slides and broadcast content.', FALSE),
    ('store_manager',        'Store Manager',        'Runs the store, inventory and referrals.', FALSE)
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role_key, feature, level) VALUES
    ('seller',    'seller_tools', 'full'),

    ('admin', 'dashboard',           'full'),
    ('admin', 'user_management',     'full'),
    ('admin', 'competitions',        'full'),
    ('admin', 'teams_standings',     'full'),
    ('admin', 'matches',             'full'),
    ('admin', 'play_by_play',        'full'),
    ('admin', 'play_by_play_commit', 'full'),
    ('admin', 'broadcast_studio',    'full'),
    ('admin', 'stats_edit',          'full'),
    ('admin', 'players',             'full'),
    ('admin', 'totw',                'full'),
    ('admin', 'badges',              'full'),
    ('admin', 'fantasy',             'full'),
    ('admin', 'claims',              'full'),
    ('admin', 'contracts',           'full'),
    ('admin', 'transfers',           'full'),
    ('admin', 'transfer_windows',    'full'),
    ('admin', 'team_budgets',        'full'),
    ('admin', 'tickets',             'full'),
    ('admin', 'referrals',           'full'),
    ('admin', 'event_days',          'full'),
    ('admin', 'store',               'full'),
    ('admin', 'inventory',           'full'),
    ('admin', 'news',                'full'),
    ('admin', 'hero_slides',         'full'),
    ('admin', 'gallery',             'full'),
    ('admin', 'live_stream',         'full'),
    ('admin', 'season_mvps',         'full'),
    ('admin', 'app_settings',        'full'),
    ('admin', 'seller_tools',        'full'),
    -- Replace checks that used to be written as role == "admin" in code.
    ('admin', 'roles',               'full'),
    ('admin', 'play_by_play_lock',   'full'),
    ('admin', 'comment_moderation',  'full'),
    ('admin', 'team_portal',         'full'),

    ('commissioner', 'competitions',      'full'),
    ('commissioner', 'teams_standings',   'full'),
    ('commissioner', 'matches',           'full'),
    ('commissioner', 'play_by_play',      'full'),
    ('commissioner', 'play_by_play_commit','full'),
    ('commissioner', 'stats_edit',        'full'),
    ('commissioner', 'players',           'full'),
    ('commissioner', 'totw',              'full'),
    ('commissioner', 'badges',            'full'),
    ('commissioner', 'fantasy',           'view'),
    ('commissioner', 'claims',            'full'),
    ('commissioner', 'contracts',         'full'),
    ('commissioner', 'transfers',         'full'),
    ('commissioner', 'transfer_windows',  'full'),
    ('commissioner', 'team_budgets',      'full'),
    ('commissioner', 'event_days',        'full'),
    ('commissioner', 'season_mvps',       'full'),
    ('commissioner', 'app_settings',      'full'),

    ('fantasy_commissioner', 'teams_standings', 'view'),
    ('fantasy_commissioner', 'matches',         'view'),
    ('fantasy_commissioner', 'totw',            'view'),
    ('fantasy_commissioner', 'badges',          'view'),
    ('fantasy_commissioner', 'fantasy',         'full'),
    ('fantasy_commissioner', 'event_days',      'view'),
    ('fantasy_commissioner', 'season_mvps',     'view'),

    ('head_referee', 'teams_standings',    'full'),
    ('head_referee', 'matches',            'full'),
    ('head_referee', 'play_by_play',       'full'),
    ('head_referee', 'play_by_play_commit','full'),
    ('head_referee', 'stats_edit',         'full'),
    ('head_referee', 'players',            'full'),

    ('referee', 'matches',      'full'),
    ('referee', 'play_by_play', 'full'),
    ('referee', 'players',      'full'),
    ('referee', 'event_days',   'full'),

    ('stats', 'teams_standings',  'full'),
    ('stats', 'matches',          'full'),
    ('stats', 'play_by_play',     'full'),
    ('stats', 'broadcast_studio', 'full'),
    ('stats', 'players',          'full'),
    ('stats', 'event_days',       'full'),

    ('broadcast', 'matches',          'full'),
    ('broadcast', 'broadcast_studio', 'full'),

    ('news_head', 'players',          'view'),
    ('news_head', 'transfer_windows', 'view'),
    ('news_head', 'event_days',       'full'),
    ('news_head', 'news',             'full'),
    ('news_head', 'season_mvps',      'view'),

    ('content_creator', 'broadcast_studio', 'full'),
    ('content_creator', 'players',          'view'),
    ('content_creator', 'transfer_windows', 'view'),
    ('content_creator', 'event_days',       'full'),
    ('content_creator', 'news',             'full'),
    ('content_creator', 'hero_slides',      'full'),
    ('content_creator', 'gallery',          'full'),
    ('content_creator', 'season_mvps',      'view'),

    ('ticketer', 'tickets',   'full'),
    ('ticketer', 'referrals', 'full'),

    ('store_manager', 'referrals',    'full'),
    ('store_manager', 'event_days',   'full'),
    ('store_manager', 'store',        'full'),
    ('store_manager', 'inventory',    'full'),
    ('store_manager', 'seller_tools', 'full')
ON CONFLICT (role_key, feature) DO NOTHING;

-- Anything already on a user that isn't a known role (a hand-edited row, an old
-- value) becomes a role with no access, so the foreign key below can't fail and
-- the person keeps their login but loses nothing they could actually use.
INSERT INTO roles (key, name, description, is_system)
SELECT DISTINCT u.role, u.role, 'Imported from an existing user.', FALSE
FROM users u
WHERE u.role IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM roles r WHERE r.key = u.role)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE users
    ADD CONSTRAINT users_role_fkey FOREIGN KEY (role) REFERENCES roles(key);

-- +goose Down
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_fkey;
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS roles;
