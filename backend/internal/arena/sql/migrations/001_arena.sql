-- Clubs Arena, migration 001: tables, indexes and the arena_admin role.
--
-- NOT run by the backend. Run it by hand on the production database
-- (psql "$DB_URL" -f 001_arena.sql). It is safe to re-run: every statement is
-- IF NOT EXISTS / ON CONFLICT DO NOTHING, and it runs as one transaction.
-- Needs the Showtime tables users, roles and role_permissions to exist.

BEGIN;

-- Clubs Arena: an EA FC Pro Clubs tournament product that shares this database
-- and the users table with Showtime but is otherwise self-contained. Every table
-- is prefixed arena_ so the whole product can be lifted out later.

-- A season is the unit a tournament runs in (e.g. Season 04). At most one season
-- is "live" (active or playoffs) at a time.
CREATE TABLE IF NOT EXISTS arena_seasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number INT NOT NULL UNIQUE CHECK (number > 0),
    name TEXT NOT NULL,
    starts_on DATE,
    ends_on DATE,
    status TEXT NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'active', 'playoffs', 'completed')),
    -- While closed, contract offers can't be made or signed.
    transfer_window_open BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_arena_seasons_one_live
    ON arena_seasons ((TRUE)) WHERE status IN ('active', 'playoffs');

-- A division is its own league table inside a season.
CREATE TABLE IF NOT EXISTS arena_divisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES arena_seasons(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    -- How many clubs go to the playoffs (0 = no playoffs, 2 = straight final).
    playoff_spots INT NOT NULL DEFAULT 4 CHECK (playoff_spots IN (0, 2, 4)),
    -- 0 = Sunday ... 6 = Saturday, in Africa/Lagos.
    kickoff_day SMALLINT NOT NULL DEFAULT 0 CHECK (kickoff_day BETWEEN 0 AND 6),
    -- Kick-off times (HH:MM, Lagos time) used in turn when fixtures are made.
    kickoff_slots TEXT[] NOT NULL DEFAULT ARRAY['20:00', '20:30'],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_arena_divisions_name ON arena_divisions (season_id, LOWER(name));

CREATE TABLE IF NOT EXISTS arena_clubs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    short VARCHAR(3) NOT NULL,
    color TEXT NOT NULL DEFAULT '#4e7050',
    crest_url TEXT NOT NULL DEFAULT '',
    founded_year INT,
    -- The club's manager. A user manages at most one club.
    manager_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (short = UPPER(short) AND short ~ '^[A-Z0-9]{2,3}$')
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_arena_clubs_name ON arena_clubs (LOWER(name));
CREATE UNIQUE INDEX IF NOT EXISTS idx_arena_clubs_short ON arena_clubs (short);
CREATE UNIQUE INDEX IF NOT EXISTS idx_arena_clubs_manager ON arena_clubs (manager_user_id) WHERE manager_user_id IS NOT NULL;

-- Which division a club plays in for a season. season_id is repeated here so the
-- database itself guarantees a club is in one division per season.
CREATE TABLE IF NOT EXISTS arena_division_clubs (
    division_id UUID NOT NULL REFERENCES arena_divisions(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES arena_clubs(id) ON DELETE CASCADE,
    season_id UUID NOT NULL REFERENCES arena_seasons(id) ON DELETE CASCADE,
    PRIMARY KEY (division_id, club_id),
    UNIQUE (season_id, club_id)
);
CREATE INDEX IF NOT EXISTS idx_arena_division_clubs_club ON arena_division_clubs (club_id);

CREATE TABLE IF NOT EXISTS arena_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Set once the person has an account and has been linked to this profile.
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    gamertag TEXT NOT NULL,
    ea_id TEXT NOT NULL DEFAULT '',
    platform TEXT NOT NULL DEFAULT 'PS' CHECK (platform IN ('PS', 'XBOX', 'PC')),
    primary_position TEXT NOT NULL CHECK (primary_position IN
        ('GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST')),
    avatar_url TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_arena_players_gamertag ON arena_players (LOWER(gamertag));

-- An offer to a player. The whole history of one offer is arena_contract_events.
-- fee_ngn is a record of the agreed fee only: nothing is charged in v1.
CREATE TABLE IF NOT EXISTS arena_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES arena_seasons(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES arena_players(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES arena_clubs(id) ON DELETE CASCADE,
    -- The club the player belonged to when the offer was made (NULL = free agent).
    from_club_id UUID REFERENCES arena_clubs(id) ON DELETE SET NULL,
    squad_role TEXT NOT NULL DEFAULT 'first_team' CHECK (squad_role IN ('first_team', 'rotation', 'reserve')),
    end_date DATE NOT NULL,
    fee_ngn BIGINT NOT NULL DEFAULT 0 CHECK (fee_ngn >= 0 AND fee_ngn <= 100000000),
    terms TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK (status IN
        ('awaiting_release', 'awaiting_player', 'signed', 'rejected', 'release_declined', 'withdrawn')),
    signature TEXT NOT NULL DEFAULT '',
    signed_at TIMESTAMPTZ,
    reason TEXT NOT NULL DEFAULT '',
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- A club can have only one open offer to a player at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_arena_contracts_open
    ON arena_contracts (player_id, club_id) WHERE status IN ('awaiting_release', 'awaiting_player');
CREATE INDEX IF NOT EXISTS idx_arena_contracts_club ON arena_contracts (club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_arena_contracts_player ON arena_contracts (player_id, created_at DESC);

CREATE TABLE IF NOT EXISTS arena_contract_events (
    id BIGSERIAL PRIMARY KEY,
    contract_id UUID NOT NULL REFERENCES arena_contracts(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_arena_contract_events_contract ON arena_contract_events (contract_id, at);

-- Which club a player belongs to. A row with ended_at NULL is the current one.
-- Stats stay with the club (and season) the player played for at the time.
CREATE TABLE IF NOT EXISTS arena_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES arena_players(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES arena_clubs(id) ON DELETE CASCADE,
    season_id UUID NOT NULL REFERENCES arena_seasons(id) ON DELETE CASCADE,
    shirt_number SMALLINT NOT NULL CHECK (shirt_number BETWEEN 1 AND 99),
    squad_role TEXT NOT NULL DEFAULT 'first_team' CHECK (squad_role IN ('first_team', 'rotation', 'reserve')),
    contract_id UUID REFERENCES arena_contracts(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_arena_reg_player_open ON arena_registrations (player_id) WHERE ended_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_arena_reg_shirt_open ON arena_registrations (club_id, shirt_number) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_arena_reg_club ON arena_registrations (club_id) WHERE ended_at IS NULL;

CREATE TABLE IF NOT EXISTS arena_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES arena_seasons(id) ON DELETE CASCADE,
    division_id UUID NOT NULL REFERENCES arena_divisions(id) ON DELETE CASCADE,
    stage TEXT NOT NULL DEFAULT 'league' CHECK (stage IN ('league', 'semi', 'final')),
    matchweek INT NOT NULL DEFAULT 1 CHECK (matchweek > 0),
    -- Playoff matches wait for their clubs, so these can be NULL until fed.
    home_club_id UUID REFERENCES arena_clubs(id) ON DELETE CASCADE,
    away_club_id UUID REFERENCES arena_clubs(id) ON DELETE CASCADE,
    kickoff_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'forfeit', 'postponed')),
    home_score INT CHECK (home_score IS NULL OR home_score >= 0),
    away_score INT CHECK (away_score IS NULL OR away_score >= 0),
    -- A knockout can't end level: when the score is, this says who won the shoot-out.
    penalty_winner TEXT CHECK (penalty_winner IN ('home', 'away')),
    -- Winner of this match goes into feeds_match_id's home or away side.
    feeds_match_id UUID REFERENCES arena_matches(id) ON DELETE SET NULL,
    feeds_slot TEXT CHECK (feeds_slot IN ('home', 'away')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (home_club_id IS NULL OR away_club_id IS NULL OR home_club_id <> away_club_id),
    CHECK (status NOT IN ('completed', 'forfeit') OR (home_score IS NOT NULL AND away_score IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_arena_matches_division ON arena_matches (division_id, stage, matchweek);
CREATE INDEX IF NOT EXISTS idx_arena_matches_home ON arena_matches (home_club_id);
CREATE INDEX IF NOT EXISTS idx_arena_matches_away ON arena_matches (away_club_id);
CREATE INDEX IF NOT EXISTS idx_arena_matches_kickoff ON arena_matches (kickoff_at);

CREATE TABLE IF NOT EXISTS arena_team_sheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES arena_matches(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES arena_clubs(id) ON DELETE CASCADE,
    formation TEXT NOT NULL DEFAULT '4-2-3-1',
    captain_player_id UUID REFERENCES arena_players(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
    revision INT NOT NULL DEFAULT 0,
    submitted_at TIMESTAMPTZ,
    -- Why a submitted sheet was sent back to draft (e.g. after a transfer).
    review_reason TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (match_id, club_id)
);

CREATE TABLE IF NOT EXISTS arena_team_sheet_players (
    sheet_id UUID NOT NULL REFERENCES arena_team_sheets(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES arena_players(id) ON DELETE CASCADE,
    -- 0..10 for a starter (the formation's slot order), NULL for a substitute.
    slot_index SMALLINT CHECK (slot_index IS NULL OR slot_index BETWEEN 0 AND 10),
    slot_position TEXT,
    is_bench BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (sheet_id, player_id),
    CHECK ((is_bench AND slot_index IS NULL) OR (NOT is_bench AND slot_index IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_arena_sheet_slot ON arena_team_sheet_players (sheet_id, slot_index) WHERE slot_index IS NOT NULL;

CREATE TABLE IF NOT EXISTS arena_match_player_stats (
    match_id UUID NOT NULL REFERENCES arena_matches(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES arena_players(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES arena_clubs(id) ON DELETE CASCADE,
    started BOOLEAN NOT NULL DEFAULT TRUE,
    goals INT NOT NULL DEFAULT 0 CHECK (goals >= 0),
    assists INT NOT NULL DEFAULT 0 CHECK (assists >= 0),
    rating NUMERIC(3, 1) CHECK (rating IS NULL OR (rating >= 0 AND rating <= 10)),
    motm BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (match_id, player_id)
);
CREATE INDEX IF NOT EXISTS idx_arena_stats_player ON arena_match_player_stats (player_id);
CREATE INDEX IF NOT EXISTS idx_arena_stats_club ON arena_match_player_stats (club_id);

-- A signed-in user's "my club".
CREATE TABLE IF NOT EXISTS arena_follows (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES arena_clubs(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

COMMIT;
