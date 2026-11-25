-- +goose Up

-- Arena 1/3: seasons, divisions, clubs and players.
-- Clubs Arena migration (tagged "arena" in the file name so the product's files
-- are easy to find and lift out later: ls *_arena_*.sql).

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

-- +goose Down
DROP TABLE IF EXISTS arena_players;
DROP TABLE IF EXISTS arena_division_clubs;
DROP TABLE IF EXISTS arena_clubs;
DROP TABLE IF EXISTS arena_divisions;
DROP TABLE IF EXISTS arena_seasons;
