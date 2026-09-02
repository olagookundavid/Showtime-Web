-- +goose Up

-- 1. Fantasy Seasons
CREATE TABLE IF NOT EXISTS fantasy_seasons (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id     UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    name               TEXT NOT NULL,
    squad_size         INT NOT NULL DEFAULT 14,
    budget             NUMERIC(10,2) NOT NULL DEFAULT 230.00,
    min_female_offense INT NOT NULL DEFAULT 3,
    min_female_defense INT NOT NULL DEFAULT 3,
    max_per_club       INT NOT NULL DEFAULT 4,
    lock_mins_before   INT NOT NULL DEFAULT 15,
    status             TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'COMPLETED')),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Fantasy Gameweeks
CREATE TABLE IF NOT EXISTS fantasy_gameweeks (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id    UUID NOT NULL REFERENCES fantasy_seasons(id) ON DELETE CASCADE,
    number       INT NOT NULL,
    event_day_id UUID NOT NULL REFERENCES event_days(id) ON DELETE RESTRICT,
    deadline     TIMESTAMPTZ NOT NULL,
    status       TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'LOCKED', 'LIVE', 'FINALIZED')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(season_id, number),
    UNIQUE(season_id, event_day_id)
);

-- 3. Dynamic Player Price Snapshots
CREATE TABLE IF NOT EXISTS fantasy_player_prices (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id   UUID NOT NULL REFERENCES fantasy_seasons(id) ON DELETE CASCADE,
    player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    gameweek_id UUID REFERENCES fantasy_gameweeks(id) ON DELETE CASCADE,
    base_price  NUMERIC(10,2) NOT NULL DEFAULT 10.00,
    rating      NUMERIC(4,2) NOT NULL DEFAULT 5.00,
    price       NUMERIC(10,2) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(season_id, player_id, gameweek_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uix_fantasy_player_prices_opening
    ON fantasy_player_prices (season_id, player_id)
    WHERE gameweek_id IS NULL;

-- 4. User Fantasy Teams (1 squad per user per season)
CREATE TABLE IF NOT EXISTS fantasy_teams (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    season_id    UUID NOT NULL REFERENCES fantasy_seasons(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    total_points NUMERIC(12,3) NOT NULL DEFAULT 0.000,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, season_id)
);
CREATE INDEX IF NOT EXISTS idx_fantasy_teams_season ON fantasy_teams(season_id);

-- 5. Gameweek Lineups (Draft / Locked snapshot)
CREATE TABLE IF NOT EXISTS fantasy_lineups (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id     UUID NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
    gameweek_id UUID NOT NULL REFERENCES fantasy_gameweeks(id) ON DELETE CASCADE,
    total_spent NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    points      NUMERIC(12,3) NOT NULL DEFAULT 0.000,
    status      TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'LOCKED')),
    locked_at   TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(team_id, gameweek_id)
);

-- 6. Lineup Picks (14 Slots per Lineup with Exact Role Mapping)
CREATE TABLE IF NOT EXISTS fantasy_lineup_picks (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lineup_id      UUID NOT NULL REFERENCES fantasy_lineups(id) ON DELETE CASCADE,
    player_id      UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    slot           TEXT NOT NULL CHECK (slot IN (
                       'QB_M', 'QB_F', 'REC_1', 'REC_2', 'REC_3', 'REC_4', 'REC_5',
                       'RUSHER', 'DEF_1', 'DEF_2', 'DEF_3', 'DEF_4', 'DEF_5', 'DEF_6'
                   )),
    purchase_price NUMERIC(10,2) NOT NULL,
    points         NUMERIC(10,3) NOT NULL DEFAULT 0.000,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(lineup_id, slot),
    UNIQUE(lineup_id, player_id)
);
CREATE INDEX IF NOT EXISTS idx_lineup_picks_player ON fantasy_lineup_picks(player_id);

-- 7. Gameweek Match Points Breakdown Log
CREATE TABLE IF NOT EXISTS fantasy_gw_points (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id     UUID NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
    gameweek_id UUID NOT NULL REFERENCES fantasy_gameweeks(id) ON DELETE CASCADE,
    player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    match_id    UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    points      NUMERIC(10,3) NOT NULL DEFAULT 0.000,
    breakdown   JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(team_id, gameweek_id, player_id, match_id)
);
CREATE INDEX IF NOT EXISTS idx_fantasy_gw_points_gw ON fantasy_gw_points(gameweek_id);

-- 8. Fantasy Leagues
CREATE TABLE IF NOT EXISTS fantasy_leagues (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id          UUID NOT NULL REFERENCES fantasy_seasons(id) ON DELETE CASCADE,
    name               TEXT NOT NULL,
    type               TEXT NOT NULL DEFAULT 'PRIVATE' CHECK (type IN ('OVERALL', 'PUBLIC', 'PRIVATE')),
    invite_code        TEXT UNIQUE,
    -- NULL for system-owned leagues (the per-season OVERALL league has no human
    -- creator). ON DELETE SET NULL so deleting a user doesn't take their
    -- mini-league — and everyone else's standings in it — with them.
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    entry_fee          INT NOT NULL DEFAULT 0,
    max_members        INT NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fantasy_leagues_season ON fantasy_leagues(season_id);

-- 9. Fantasy League Memberships (with Paystack support)
CREATE TABLE IF NOT EXISTS fantasy_league_members (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id           UUID NOT NULL REFERENCES fantasy_leagues(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_id             UUID NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
    payment_status      TEXT NOT NULL DEFAULT 'FREE' CHECK (payment_status IN ('FREE', 'PENDING', 'PAID', 'FAILED')),
    paystack_reference  TEXT UNIQUE,
    paystack_access_code TEXT,
    joined_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(league_id, user_id)
);

-- +goose Down
DROP TABLE IF EXISTS fantasy_league_members;
DROP TABLE IF EXISTS fantasy_leagues;
DROP TABLE IF EXISTS fantasy_gw_points;
DROP TABLE IF EXISTS fantasy_lineup_picks;
DROP TABLE IF EXISTS fantasy_lineups;
DROP TABLE IF EXISTS fantasy_teams;
DROP INDEX IF EXISTS uix_fantasy_player_prices_opening;
DROP TABLE IF EXISTS fantasy_player_prices;
DROP TABLE IF EXISTS fantasy_gameweeks;
DROP TABLE IF EXISTS fantasy_seasons;
