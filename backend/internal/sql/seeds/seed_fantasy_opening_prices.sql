-- ====================================================================
-- SHOWTIME FANTASY: PRODUCTION OPENING PRICES SEED
-- Total Players: 314 | Source: Showtime_Fantasy_Player_Pricing_Model.xlsx
-- ====================================================================
BEGIN;
-- Ensure required extension, base tables, and fantasy schema exist (idempotent DDL)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS competitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    logo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    short_name VARCHAR(50),
    logo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    jersey_number INT,
    position VARCHAR(50),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    bio TEXT,
    image TEXT,
    email VARCHAR(255) NOT NULL DEFAULT '',
    gender VARCHAR(1) CHECK (gender IN ('M', 'F')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fantasy_seasons (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id     UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    name               TEXT NOT NULL,
    squad_size         INT NOT NULL DEFAULT 14,
    budget             NUMERIC(10,2) NOT NULL DEFAULT 100.00,
    min_female_offense INT NOT NULL DEFAULT 3,
    min_female_defense INT NOT NULL DEFAULT 3,
    max_per_club       INT NOT NULL DEFAULT 4,
    lock_mins_before   INT NOT NULL DEFAULT 15,
    status             TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'ACTIVE', 'COMPLETED')),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fantasy_player_prices (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id   UUID NOT NULL REFERENCES fantasy_seasons(id) ON DELETE CASCADE,
    player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    gameweek_id UUID,
    base_price  NUMERIC(10,2) NOT NULL DEFAULT 5.00,
    rating      NUMERIC(4,2) NOT NULL DEFAULT 5.00,
    price       NUMERIC(10,2) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(season_id, player_id, gameweek_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uix_fantasy_player_prices_opening
    ON fantasy_player_prices (season_id, player_id)
    WHERE gameweek_id IS NULL;

DO $$
DECLARE
    v_comp_id UUID;
    v_season_id UUID;
    v_season_name TEXT;
    v_season_budget NUMERIC(10,2);
    v_count INT := 0;
    v_teams_created INT := 0;
    v_players_created INT := 0;
    v_squads_restated INT := 0;
BEGIN
    -- Ensure at least one competition exists
    SELECT id INTO v_comp_id FROM competitions ORDER BY created_at DESC LIMIT 1;
    IF v_comp_id IS NULL THEN
        INSERT INTO competitions (name, created_at, updated_at)
        VALUES ('Showtime Flag Football League', NOW(), NOW())
        RETURNING id INTO v_comp_id;
        RAISE NOTICE 'Created default competition: %', v_comp_id;
    END IF;

    SELECT id, name, budget INTO v_season_id, v_season_name, v_season_budget FROM fantasy_seasons WHERE status IN ('ACTIVE', 'DRAFT') ORDER BY (status = 'ACTIVE') DESC, created_at DESC LIMIT 1;
    IF v_season_id IS NULL THEN
        INSERT INTO fantasy_seasons (competition_id, name, squad_size, budget, min_female_offense, min_female_defense, max_per_club, lock_mins_before, status, created_at, updated_at)
        VALUES (v_comp_id, 'Showtime Fantasy Season 2026', 14, 100.00, 3, 3, 4, 15, 'ACTIVE', NOW(), NOW())
        RETURNING id, name, budget INTO v_season_id, v_season_name, v_season_budget;
        RAISE NOTICE 'Created default fantasy season: % (ID: %)', v_season_name, v_season_id;
    END IF;
    RAISE NOTICE 'Seeding % player opening prices for season: % (ID: %)', 314, v_season_name, v_season_id;

    -- 1. Create temporary staging table
    CREATE TEMP TABLE tmp_player_pricing (
        rank INT,
        name TEXT,
        team_name TEXT,
        team_code TEXT,
        games_played INT,
        source_role TEXT,
        fantasy_position TEXT,
        composite_index NUMERIC,
        final_price NUMERIC(10,2),
        price_tier TEXT,
        pricing_status TEXT
    ) ON COMMIT DROP;

    -- 2. Stage the 314 records
    INSERT INTO tmp_player_pricing VALUES
    (2, 'Adetutu Oshikoya', 'ABIA WARRIORS', 'WAR', 9, 'WR', 'Receiver', 0.5598, 7.0, 'Core', 'Performance priced'),
    (3, 'Bello Remilekun', 'ABIA WARRIORS', 'WAR', 9, 'WR', 'Receiver', 1.0, 12.5, 'Elite', 'Performance priced'),
    (4, 'Jordan Nathaniel', 'ABIA WARRIORS', 'WAR', 9, 'WR', 'Receiver', 0.9165, 11.5, 'Elite', 'Performance priced'),
    (5, 'Joseph Williams', 'ABIA WARRIORS', 'WAR', 9, 'QB', 'QB', 1.0, 12.5, 'Elite', 'Performance priced'),
    (6, 'Samuel Gbemisola', 'ABIA WARRIORS', 'WAR', 9, 'QB', 'QB', 0.9056, 11.0, 'Premium', 'Performance priced'),
    (7, 'Success Patrick', 'ABIA WARRIORS', 'WAR', 9, 'WR', 'Receiver', 0.8634, 10.5, 'Premium', 'Performance priced'),
    (8, 'Imole Olorunfemi', 'CROSS RIVER IKAN SPORTS', 'IKN', 9, 'DB / CB', 'Defender', 0.5451, 7.0, 'Core', 'Performance priced'),
    (9, 'Praise Miene', 'CROSS RIVER IKAN SPORTS', 'IKN', 9, 'WR', 'Receiver', 0.8406, 10.5, 'Premium', 'Performance priced'),
    (10, 'Timothy Atibile', 'CROSS RIVER IKAN SPORTS', 'IKN', 9, 'QB', 'QB', 0.8819, 11.0, 'Premium', 'Performance priced'),
    (11, 'Utibe Ayi', 'CROSS RIVER IKAN SPORTS', 'IKN', 9, 'QB', 'QB', 0.5514, 7.0, 'Core', 'Performance priced'),
    (12, 'Waliyat Lawal', 'CROSS RIVER IKAN SPORTS', 'IKN', 9, 'WR', 'Receiver', 0.6053, 7.5, 'Starter', 'Performance priced'),
    (13, 'Chimobi .', 'DELTA BRAVES', 'BRV', 9, 'WR', 'Receiver', 0.909, 11.0, 'Premium', 'Performance priced'),
    (14, 'Ikechukwu Scott', 'DELTA BRAVES', 'BRV', 9, 'WR', 'Receiver', 0.7268, 9.0, 'Starter', 'Performance priced'),
    (15, 'J Fem', 'DELTA BRAVES', 'BRV', 9, 'QB', 'QB', 0.7875, 9.5, 'Premium', 'Performance priced'),
    (16, 'Nwadike Ijeoma Treasure', 'DELTA BRAVES', 'BRV', 9, 'WR', 'Receiver', 0.4232, 5.5, 'Core', 'Performance priced'),
    (17, 'Daniel John', 'DELTA PANTHERS', 'PAN', 9, 'WR', 'Receiver', 0.8103, 10.0, 'Premium', 'Performance priced'),
    (18, 'Ginikachukwu Godspower', 'DELTA PANTHERS', 'PAN', 9, 'DB / CB', 'Defender', 0.6528, 8.0, 'Starter', 'Performance priced'),
    (19, 'Jite Ughojor', 'DELTA PANTHERS', 'PAN', 9, 'QB', 'QB', 0.6931, 8.5, 'Starter', 'Performance priced'),
    (20, 'Sammy Agulonu', 'DELTA PANTHERS', 'PAN', 9, 'WR', 'Receiver', 0.8482, 10.5, 'Premium', 'Performance priced'),
    (21, 'Abiodun Akintoye', 'IBOM RAPTORS', 'RAP', 9, 'WR', 'Receiver', 0.9621, 12.0, 'Elite', 'Performance priced'),
    (22, 'Happiness Abanikonda', 'IBOM RAPTORS', 'RAP', 9, 'QB', 'QB', 0.8583, 10.5, 'Premium', 'Performance priced'),
    (23, 'Imoleayo Madamidaola', 'IBOM RAPTORS', 'RAP', 9, 'WR', 'Receiver', 0.8558, 10.5, 'Premium', 'Performance priced'),
    (24, 'Moyosore Adolphus', 'IBOM RAPTORS', 'RAP', 9, 'WR', 'Receiver', 0.9544, 12.0, 'Elite', 'Performance priced'),
    (25, 'Mustapha Babatunde', 'IBOM RAPTORS', 'RAP', 9, 'WR', 'Receiver', 0.9697, 12.0, 'Elite', 'Performance priced'),
    (26, 'Stephen Comfort', 'IBOM RAPTORS', 'RAP', 9, 'DB / CB', 'Defender', 0.4493, 6.0, 'Core', 'Performance priced'),
    (27, 'Taiwo Oluwalanu', 'IBOM RAPTORS', 'RAP', 9, 'QB', 'QB', 0.9527, 12.0, 'Elite', 'Performance priced'),
    (28, 'Toyibat Samsondeen', 'IBOM RAPTORS', 'RAP', 9, 'WR', 'Receiver', 0.7419, 9.0, 'Starter', 'Performance priced'),
    (29, 'Yusuf Adams', 'IBOM RAPTORS', 'RAP', 9, 'WR', 'Receiver', 0.9013, 11.0, 'Premium', 'Performance priced'),
    (30, 'Deborah Awoniyi', 'LAGOS GREENBACKS', 'GBK', 9, 'WR', 'Receiver', 0.3094, 4.5, 'Value', 'Performance priced'),
    (31, 'Obiekezie Chiamaka', 'LAGOS GREENBACKS', 'GBK', 9, 'QB', 'QB', 0.6458, 8.0, 'Starter', 'Performance priced'),
    (32, 'Oluremi Jedidiah', 'LAGOS GREENBACKS', 'GBK', 9, 'QB', 'QB', 0.8111, 10.0, 'Premium', 'Performance priced'),
    (33, 'Shuaib Folorunsho', 'LAGOS GREENBACKS', 'GBK', 9, 'DB / CB', 'Defender', 0.6887, 8.5, 'Starter', 'Performance priced'),
    (34, 'Awele Okoh', 'LAGOS KNIGHTS', 'LAK', 9, 'WR', 'Receiver', 0.8331, 10.0, 'Premium', 'Performance priced'),
    (35, 'Dabo Green', 'LAGOS KNIGHTS', 'LAK', 9, 'WR', 'Receiver', 0.9924, 12.5, 'Elite', 'Performance priced'),
    (36, 'Giovanni Onobun', 'LAGOS KNIGHTS', 'LAK', 9, 'DB / CB', 'Defender', 0.7725, 9.5, 'Premium', 'Performance priced'),
    (37, 'Jimmie Akinsola', 'LAGOS KNIGHTS', 'LAK', 9, 'DB / CB', 'Defender', 0.6409, 8.0, 'Starter', 'Performance priced'),
    (38, 'Jumoke Balogun', 'LAGOS KNIGHTS', 'LAK', 9, 'DB / CB', 'Defender', 0.4733, 6.0, 'Core', 'Performance priced'),
    (39, 'Kayode Mafe', 'LAGOS KNIGHTS', 'LAK', 9, 'QB', 'QB', 0.9764, 12.0, 'Elite', 'Performance priced'),
    (40, 'Kayode Ogundele', 'LAGOS KNIGHTS', 'LAK', 9, 'WR', 'Receiver', 0.8862, 11.0, 'Premium', 'Performance priced'),
    (41, 'Kemisola Olukoya', 'LAGOS KNIGHTS', 'LAK', 9, 'WR', 'Receiver', 0.7192, 9.0, 'Starter', 'Performance priced'),
    (42, 'Maudleen Julius', 'LAGOS KNIGHTS', 'LAK', 9, 'QB', 'QB', 0.7167, 9.0, 'Starter', 'Performance priced'),
    (43, 'Peace Ikhuoria', 'LAGOS KNIGHTS', 'LAK', 9, 'WR', 'Receiver', 0.3777, 5.0, 'Value', 'Performance priced'),
    (44, 'Sodiq Ayinde', 'LAGOS KNIGHTS', 'LAK', 9, 'DB / CB', 'Defender', 0.8564, 10.5, 'Premium', 'Performance priced'),
    (45, 'Taiwo Badmus', 'LAGOS KNIGHTS', 'LAK', 9, 'WR', 'Receiver', 0.6129, 7.5, 'Starter', 'Performance priced'),
    (46, 'Damilola Olubode', 'LAGOS REBELS', 'REB', 9, 'DB / CB', 'Defender', 0.6169, 7.5, 'Starter', 'Performance priced'),
    (47, 'Divine Eric', 'LAGOS REBELS', 'REB', 9, 'WR', 'Receiver', 0.7723, 9.5, 'Premium', 'Performance priced'),
    (48, 'Odudu Otu', 'LAGOS REBELS', 'REB', 9, 'WR', 'Receiver', 0.8785, 11.0, 'Premium', 'Performance priced'),
    (49, 'Oluwole Filani', 'LAGOS REBELS', 'REB', 9, 'DB / CB', 'Defender', 0.9521, 12.0, 'Elite', 'Performance priced'),
    (50, 'Onamusi Oreoluwa', 'LAGOS REBELS', 'REB', 9, 'WR', 'Receiver', 0.7496, 9.0, 'Starter', 'Performance priced'),
    (51, 'Ruth Chilaka', 'LAGOS REBELS', 'REB', 9, 'Rusher / DE', 'Rusher', 1.0, 12.5, 'Elite', 'Performance priced'),
    (52, 'Stephanie Onyegirigwam', 'LAGOS REBELS', 'REB', 9, 'QB', 'QB', 0.6694, 8.0, 'Starter', 'Performance priced'),
    (53, 'Sulaimon Alhameen', 'LAGOS REBELS', 'REB', 9, 'QB', 'QB', 0.9292, 11.5, 'Elite', 'Performance priced'),
    (54, 'Uchenna Henry', 'LAGOS REBELS', 'REB', 9, 'WR', 'Receiver', 0.9241, 11.5, 'Elite', 'Performance priced'),
    (55, 'Hawawu Temitope', 'OGUN HORNS', 'HNS', 9, 'WR', 'Receiver', 0.2715, 4.5, 'Value', 'Performance priced'),
    (56, 'Odimbu Awele Gift', 'OGUN HORNS', 'HNS', 9, 'WR', 'Receiver', 0.871, 10.5, 'Premium', 'Performance priced'),
    (57, 'Omadhebo David', 'OGUN HORNS', 'HNS', 9, 'WR', 'Receiver', 0.7647, 9.5, 'Premium', 'Performance priced'),
    (58, 'Omolola Adeseke', 'OGUN HORNS', 'HNS', 9, 'WR', 'Receiver', 0.5294, 6.5, 'Core', 'Performance priced'),
    (59, 'Fawaz Junaid', 'RIVERS ALPHAS', 'ALP', 9, 'WR', 'Receiver', 0.8027, 10.0, 'Premium', 'Performance priced'),
    (60, 'Freeman Oloteome', 'RIVERS ALPHAS', 'ALP', 9, 'QB', 'QB', 0.3861, 5.5, 'Core', 'Performance priced'),
    (61, 'Bello Anuoluwapo', 'ABIA WARRIORS', 'WAR', 8, 'QB', 'QB', 0.8181, 10.0, 'Premium', 'Performance priced'),
    (62, 'Clinton Koko', 'ABIA WARRIORS', 'WAR', 8, 'DB / CB', 'Defender', 0.7439, 9.0, 'Starter', 'Performance priced'),
    (63, 'Ipense Oloruntoba', 'ABIA WARRIORS', 'WAR', 8, 'DB / CB', 'Defender', 0.7917, 9.5, 'Premium', 'Performance priced'),
    (64, 'John Itsukwi', 'ABIA WARRIORS', 'WAR', 8, 'DB / CB', 'Defender', 0.5763, 7.0, 'Core', 'Performance priced'),
    (65, 'Oseto Waguan', 'ABIA WARRIORS', 'WAR', 8, 'WR', 'Receiver', 0.6949, 8.5, 'Starter', 'Performance priced'),
    (66, 'Owen Favour', 'ABIA WARRIORS', 'WAR', 8, 'DB / CB', 'Defender', 0.4446, 6.0, 'Core', 'Performance priced'),
    (67, 'Silas Ighalomen', 'ABIA WARRIORS', 'WAR', 8, 'WR', 'Receiver', 0.232, 4.0, 'Value', 'Performance priced'),
    (68, 'Thompson Daniel', 'ABIA WARRIORS', 'WAR', 8, 'DB / CB', 'Defender', 0.3967, 5.5, 'Core', 'Performance priced'),
    (69, 'Abayomi Agbayewa', 'CROSS RIVER IKAN SPORTS', 'IKN', 8, 'WR', 'Receiver', 0.9226, 11.5, 'Elite', 'Performance priced'),
    (70, 'Bolu Kujore-Onifade', 'CROSS RIVER IKAN SPORTS', 'IKN', 8, 'WR', 'Receiver', 0.2624, 4.5, 'Value', 'Performance priced'),
    (71, 'Salimon Muhammed', 'CROSS RIVER IKAN SPORTS', 'IKN', 8, 'WR', 'Receiver', 0.619, 7.5, 'Starter', 'Performance priced'),
    (72, 'Sharon Olagbami', 'CROSS RIVER IKAN SPORTS', 'IKN', 8, 'WR', 'Receiver', 0.4824, 6.0, 'Core', 'Performance priced'),
    (73, 'Boluwatife Akinde', 'DELTA BRAVES', 'BRV', 8, 'DB / CB', 'Defender', 0.9474, 12.0, 'Elite', 'Performance priced'),
    (74, 'Prisca Oguh', 'DELTA BRAVES', 'BRV', 8, 'QB', 'QB', 0.4875, 6.0, 'Core', 'Performance priced'),
    (75, 'Sunmisola Okeyemi', 'DELTA BRAVES', 'BRV', 8, 'DB / CB', 'Defender', 0.265, 4.5, 'Value', 'Performance priced'),
    (76, 'Faruk Amoo', 'DELTA PANTHERS', 'PAN', 8, 'WR', 'Receiver', 0.6342, 8.0, 'Starter', 'Performance priced'),
    (77, 'Lauretta Gabriel', 'DELTA PANTHERS', 'PAN', 8, 'WR', 'Receiver', 0.6874, 8.5, 'Starter', 'Performance priced'),
    (78, 'Mary ohobu Ogbonaya', 'DELTA PANTHERS', 'PAN', 8, 'WR', 'Receiver', 0.4142, 5.5, 'Core', 'Performance priced'),
    (79, 'kelvin kougninou', 'DELTA PANTHERS', 'PAN', 8, 'DB / CB', 'Defender', 0.5164, 6.5, 'Core', 'Performance priced'),
    (80, 'Aisha Raji Oluwatosin', 'IBOM RAPTORS', 'RAP', 8, 'DB / CB', 'Defender', 0.277, 4.5, 'Value', 'Performance priced'),
    (81, 'Ambrose victor Chibueze', 'IBOM RAPTORS', 'RAP', 8, 'DB / CB', 'Defender', 0.6122, 7.5, 'Starter', 'Performance priced'),
    (82, 'Kelsey Charleston', 'IBOM RAPTORS', 'RAP', 8, 'QB', 'QB', 0.3222, 4.5, 'Value', 'Performance priced'),
    (83, 'Olonade Valentino', 'IBOM RAPTORS', 'RAP', 8, 'DB / CB', 'Defender', 0.6601, 8.0, 'Starter', 'Performance priced'),
    (84, 'Precious Aladelua', 'LAGOS GREENBACKS', 'GBK', 8, 'WR', 'Receiver', 0.6646, 8.0, 'Starter', 'Performance priced'),
    (85, 'Umeh Chisom', 'LAGOS GREENBACKS', 'GBK', 8, 'QB', 'QB', 0.3931, 5.5, 'Core', 'Performance priced'),
    (86, 'Anyaorah Lotanna', 'LAGOS KNIGHTS', 'LAK', 8, 'WR', 'Receiver', 0.9302, 11.5, 'Elite', 'Performance priced'),
    (87, 'Balikis Bello', 'LAGOS KNIGHTS', 'LAK', 8, 'Rusher / DE', 'Rusher', 0.5197, 6.5, 'Core', 'Performance priced'),
    (88, 'Emeka Alagwu', 'LAGOS KNIGHTS', 'LAK', 8, 'DB / CB', 'Defender', 0.9713, 12.0, 'Elite', 'Performance priced'),
    (89, 'Fatai Praise', 'LAGOS KNIGHTS', 'LAK', 8, 'WR', 'Receiver', 0.7633, 9.5, 'Premium', 'Performance priced'),
    (90, 'Umeri Ruth', 'LAGOS KNIGHTS', 'LAK', 8, 'WR', 'Receiver', 0.3383, 5.0, 'Value', 'Performance priced'),
    (91, 'Akinade Rukayat', 'LAGOS REBELS', 'REB', 8, 'WR', 'Receiver', 0.657, 8.0, 'Starter', 'Performance priced'),
    (92, 'Fawaz Azeez', 'LAGOS REBELS', 'REB', 8, 'WR', 'Receiver', 0.915, 11.5, 'Elite', 'Performance priced'),
    (93, 'Onyinye Udueze', 'LAGOS REBELS', 'REB', 8, 'QB', 'QB', 0.6056, 7.5, 'Starter', 'Performance priced'),
    (94, 'Ruth Ifeoluwa Egbetunde', 'LAGOS REBELS', 'REB', 8, 'WR', 'Receiver', 0.1485, 3.5, 'Value', 'Performance priced'),
    (95, 'Adewole Mosimiloluwa', 'OGUN HORNS', 'HNS', 8, 'QB', 'QB', 0.4403, 6.0, 'Core', 'Performance priced'),
    (96, 'Judah Aromojolu', 'OGUN HORNS', 'HNS', 8, 'DB / CB', 'Defender', 0.8277, 10.0, 'Premium', 'Performance priced'),
    (97, 'Williams Oluwatosin', 'OGUN HORNS', 'HNS', 8, 'DB / CB', 'Defender', 0.8756, 11.0, 'Premium', 'Performance priced'),
    (98, 'Adeoye Anuoluwapo', 'RIVERS ALPHAS', 'ALP', 8, 'WR', 'Receiver', 0.4521, 6.0, 'Core', 'Performance priced'),
    (99, 'David Ojomo', 'RIVERS ALPHAS', 'ALP', 8, 'DB / CB', 'Defender', 0.9115, 11.5, 'Elite', 'Performance priced'),
    (100, 'Olugbani Segun', 'RIVERS ALPHAS', 'ALP', 8, 'QB', 'QB', 0.275, 4.5, 'Value', 'Performance priced'),
    (101, 'Temituro Elizabeth', 'RIVERS ALPHAS', 'ALP', 8, 'WR', 'Receiver', 0.3837, 5.5, 'Core', 'Performance priced'),
    (102, 'Confidence Nzurumike', 'ABIA WARRIORS', 'WAR', 7, 'Rusher / DE', 'Rusher', 0.7349, 9.0, 'Starter', 'Performance priced'),
    (103, 'Fatungase Jabar A.', 'ABIA WARRIORS', 'WAR', 7, 'WR', 'Receiver', 0.2836, 4.5, 'Value', 'Performance priced'),
    (104, 'Ogbodu Otega', 'ABIA WARRIORS', 'WAR', 7, 'WR', 'Receiver', 0.7238, 9.0, 'Starter', 'Performance priced'),
    (105, 'Bolaji Idris', 'CROSS RIVER IKAN SPORTS', 'IKN', 7, 'DB / CB', 'Defender', 0.6314, 8.0, 'Starter', 'Performance priced'),
    (106, 'David Madu', 'CROSS RIVER IKAN SPORTS', 'IKN', 7, 'DB / CB', 'Defender', 0.7152, 8.5, 'Starter', 'Performance priced'),
    (107, 'Ifeanyi Anine', 'CROSS RIVER IKAN SPORTS', 'IKN', 7, 'DB / CB', 'Defender', 0.9667, 12.0, 'Elite', 'Performance priced'),
    (108, 'Mukaila Rasheedat', 'CROSS RIVER IKAN SPORTS', 'IKN', 7, 'WR', 'Receiver', 0.3519, 5.0, 'Value', 'Performance priced'),
    (109, 'Nchor Jnr', 'CROSS RIVER IKAN SPORTS', 'IKN', 7, 'QB', 'QB', 0.2111, 4.0, 'Value', 'Performance priced'),
    (110, 'Ojuola Gbemileke Kwame', 'CROSS RIVER IKAN SPORTS', 'IKN', 7, 'WR', 'Receiver', 0.5948, 7.5, 'Starter', 'Performance priced'),
    (111, 'Destiny .', 'DELTA BRAVES', 'BRV', 7, 'DB / CB', 'Defender', 0.5716, 7.0, 'Core', 'Performance priced'),
    (112, 'Jedidiah Santana Oluremi', 'DELTA BRAVES', 'BRV', 7, 'QB', 'QB', 0.7305, 9.0, 'Starter', 'Performance priced'),
    (113, 'Anieloka Valentina', 'DELTA PANTHERS', 'PAN', 7, 'QB', 'QB', 0.5653, 7.0, 'Core', 'Performance priced'),
    (114, 'Garuba Aishat Olamide', 'DELTA PANTHERS', 'PAN', 7, 'DB / CB', 'Defender', 0.799, 10.0, 'Premium', 'Performance priced'),
    (115, 'Micheal Ugboma', 'IBOM RAPTORS', 'RAP', 7, 'DB / CB', 'Defender', 0.7871, 9.5, 'Premium', 'Performance priced'),
    (116, 'Adebowale Osipitan', 'LAGOS GREENBACKS', 'GBK', 7, 'DB / CB', 'Defender', 0.7632, 9.5, 'Premium', 'Performance priced'),
    (117, 'Aghahowa Damian', 'LAGOS GREENBACKS', 'GBK', 7, 'WR', 'Receiver', 0.7921, 9.5, 'Premium', 'Performance priced'),
    (118, 'Ayomide Adeniji', 'LAGOS GREENBACKS', 'GBK', 7, 'WR', 'Receiver', 0.4126, 5.5, 'Core', 'Performance priced'),
    (119, 'Chibuzor Daniel Onyegu', 'LAGOS GREENBACKS', 'GBK', 7, 'WR', 'Receiver', 0.701, 8.5, 'Starter', 'Performance priced'),
    (120, 'Divine Chidera', 'LAGOS GREENBACKS', 'GBK', 7, 'WR', 'Receiver', 0.9439, 11.5, 'Elite', 'Performance priced'),
    (121, 'Omosanya Taofeek', 'LAGOS GREENBACKS', 'GBK', 7, 'DB / CB', 'Defender', 0.8829, 11.0, 'Premium', 'Performance priced'),
    (122, 'Precious George', 'LAGOS GREENBACKS', 'GBK', 7, 'Rusher / DE', 'Rusher', 0.6576, 8.0, 'Starter', 'Performance priced'),
    (123, 'emmanuel ojirinnaka', 'LAGOS GREENBACKS', 'GBK', 7, 'DB / CB', 'Defender', 0.6674, 8.0, 'Starter', 'Performance priced'),
    (124, 'AdeKunle Raphael', 'LAGOS REBELS', 'REB', 7, 'DB / CB', 'Defender', 0.392, 5.5, 'Core', 'Performance priced'),
    (125, 'Chimaeze Ohajianya', 'LAGOS REBELS', 'REB', 7, 'WR', 'Receiver', 0.2001, 4.0, 'Value', 'Performance priced'),
    (126, 'Mofe Akinrinmade', 'LAGOS REBELS', 'REB', 7, 'WR', 'Receiver', 0.8604, 10.5, 'Premium', 'Performance priced'),
    (127, 'Adejoke Talabi', 'OGUN HORNS', 'HNS', 7, 'WR', 'Receiver', 0.5492, 7.0, 'Core', 'Performance priced'),
    (128, 'Adekunle Waliya', 'OGUN HORNS', 'HNS', 7, 'QB', 'QB', 0.2819, 4.5, 'Value', 'Performance priced'),
    (129, 'Bright Yerie Bertyes', 'OGUN HORNS', 'HNS', 7, 'WR', 'Receiver', 0.3595, 5.0, 'Value', 'Performance priced'),
    (130, 'Erie Destiny', 'OGUN HORNS', 'HNS', 7, 'WR', 'Receiver', 0.3064, 4.5, 'Value', 'Performance priced'),
    (131, 'Hammed Rodiat', 'OGUN HORNS', 'HNS', 7, 'WR', 'Receiver', 0.443, 6.0, 'Core', 'Performance priced'),
    (132, 'Nwokolo Prominence', 'OGUN HORNS', 'HNS', 7, 'QB', 'QB', 0.3292, 5.0, 'Value', 'Performance priced'),
    (133, 'Qudus Tanimowo', 'RIVERS ALPHAS', 'ALP', 7, 'DB / CB', 'Defender', 0.5357, 6.5, 'Core', 'Performance priced'),
    (134, 'Wilson Mazi', 'RIVERS ALPHAS', 'ALP', 7, 'QB', 'QB', 0.1167, 3.5, 'Value', 'Performance priced'),
    (135, 'Toluwalase Kujore-Onifade', 'CROSS RIVER IKAN SPORTS', 'IKN', 6, 'WR', 'Receiver', 0.2973, 4.5, 'Value', 'Performance priced'),
    (136, 'Ayinde Faruq M.', 'DELTA BRAVES', 'BRV', 6, 'DB / CB', 'Defender', 0.6866, 8.5, 'Starter', 'Performance priced'),
    (137, 'Happiness Okon', 'DELTA BRAVES', 'BRV', 6, 'WR', 'Receiver', 0.6085, 7.5, 'Starter', 'Performance priced'),
    (138, 'Jenny .', 'DELTA BRAVES', 'BRV', 6, 'WR', 'Receiver', 0.434, 5.5, 'Core', 'Performance priced'),
    (139, 'Emeka Bright', 'DELTA PANTHERS', 'PAN', 6, 'DB / CB', 'Defender', 0.5071, 6.5, 'Core', 'Performance priced'),
    (140, 'Gbenusola Oluwadamilola', 'DELTA PANTHERS', 'PAN', 6, 'WR', 'Receiver', 0.1759, 3.5, 'Value', 'Performance priced'),
    (141, 'Taiwo Adebolu', 'DELTA PANTHERS', 'PAN', 6, 'WR', 'Receiver', 0.4415, 6.0, 'Core', 'Performance priced'),
    (142, 'Moses Taiyelolu', 'IBOM RAPTORS', 'RAP', 6, 'Rusher / DE', 'Rusher', 0.1773, 3.5, 'Value', 'Performance priced'),
    (143, 'Ololade Olanrewaju', 'IBOM RAPTORS', 'RAP', 6, 'DB / CB', 'Defender', 0.8183, 10.0, 'Premium', 'Performance priced'),
    (144, 'Osho Isreal', 'IBOM RAPTORS', 'RAP', 6, 'WR', 'Receiver', 0.1683, 3.5, 'Value', 'Performance priced'),
    (145, 'Yesirah Sulaimon', 'IBOM RAPTORS', 'RAP', 6, 'Rusher / DE', 'Rusher', 0.4091, 5.5, 'Core', 'Performance priced'),
    (146, 'Bowofoluwa Oyerinde', 'LAGOS KNIGHTS', 'LAK', 6, 'DB / CB', 'Defender', 0.2437, 4.0, 'Value', 'Performance priced'),
    (147, 'Chidinma Onyenezi', 'LAGOS REBELS', 'REB', 6, 'DB / CB', 'Defender', 0.2916, 4.5, 'Value', 'Performance priced'),
    (148, 'Joshua Eritobor', 'OGUN HORNS', 'HNS', 6, 'DB / CB', 'Defender', 0.2916, 4.5, 'Value', 'Performance priced'),
    (149, 'Deborah Adekunle', 'RIVERS ALPHAS', 'ALP', 6, 'DB / CB', 'Defender', 0.4711, 6.0, 'Core', 'Performance priced'),
    (150, 'Ovie Orhotaire', 'RIVERS ALPHAS', 'ALP', 6, 'DB / CB', 'Defender', 0.3514, 5.0, 'Value', 'Performance priced'),
    (151, 'Wale Quadri', 'RIVERS ALPHAS', 'ALP', 6, 'WR', 'Receiver', 0.191, 4.0, 'Value', 'Performance priced'),
    (152, 'Esther Oyeyemi', 'CROSS RIVER IKAN SPORTS', 'IKN', 5, 'Defense', 'Defender', 0.2988, 4.5, 'Value', 'Performance priced'),
    (153, 'Jeffery Egonatu', 'CROSS RIVER IKAN SPORTS', 'IKN', 5, 'DB / CB', 'Defender', 0.5143, 6.5, 'Core', 'Performance priced'),
    (154, 'Sophia Onyegirigwam', 'CROSS RIVER IKAN SPORTS', 'IKN', 5, 'QB', 'QB', 0.1541, 3.5, 'Value', 'Performance priced'),
    (155, 'Johannes Ulrich', 'DELTA BRAVES', 'BRV', 5, 'WR', 'Receiver', 0.5767, 7.0, 'Core', 'Performance priced'),
    (156, 'Donald Akuwudike', 'DELTA PANTHERS', 'PAN', 5, 'WR', 'Receiver', 0.7284, 9.0, 'Starter', 'Performance priced'),
    (157, 'Esther Odeyemi', 'DELTA PANTHERS', 'PAN', 5, 'Rusher / DE', 'Rusher', 0.547, 7.0, 'Core', 'Performance priced'),
    (158, 'Esther Okorougo', 'DELTA PANTHERS', 'PAN', 5, 'Rusher / DE', 'Rusher', 0.7788, 9.5, 'Premium', 'Performance priced'),
    (159, 'Stella Offure Osas', 'DELTA PANTHERS', 'PAN', 5, 'WR', 'Receiver', 0.7512, 9.0, 'Starter', 'Performance priced'),
    (160, 'Junior Lawson', 'IBOM RAPTORS', 'RAP', 5, 'DB / CB', 'Defender', 0.4425, 6.0, 'Core', 'Performance priced'),
    (161, 'Ayodeji Olarewaju', 'LAGOS GREENBACKS', 'GBK', 5, 'DB / CB', 'Defender', 0.646, 8.0, 'Starter', 'Performance priced'),
    (162, 'Emmanuel Adegalu', 'LAGOS GREENBACKS', 'GBK', 5, 'WR', 'Receiver', 0.2958, 4.5, 'Value', 'Performance priced'),
    (163, 'Afeye momoh', 'LAGOS KNIGHTS', 'LAK', 5, 'WR', 'Receiver', 0.5994, 7.5, 'Starter', 'Performance priced'),
    (164, 'Oluwatobiloba Fasasi', 'LAGOS KNIGHTS', 'LAK', 5, 'WR', 'Receiver', 0.3945, 5.5, 'Core', 'Performance priced'),
    (165, 'Adewale Yussuf', 'LAGOS REBELS', 'REB', 5, 'WR', 'Receiver', 0.1896, 4.0, 'Value', 'Performance priced'),
    (166, 'Chidi Ugoji', 'LAGOS REBELS', 'REB', 5, 'WR', 'Receiver', 0.3034, 4.5, 'Value', 'Performance priced'),
    (167, 'Emmanuel Madu', 'LAGOS REBELS', 'REB', 5, 'DB / CB', 'Defender', 0.4306, 5.5, 'Core', 'Performance priced'),
    (168, 'Nasir Abdulmalik', 'LAGOS REBELS', 'REB', 5, 'DB / CB', 'Defender', 0.8137, 10.0, 'Premium', 'Performance priced'),
    (169, 'Awosika Oluwafikunmi', 'OGUN HORNS', 'HNS', 5, 'QB', 'QB', 0.4611, 6.0, 'Core', 'Performance priced'),
    (170, 'Mosope More', 'OGUN HORNS', 'HNS', 5, 'WR', 'Receiver', 0.2275, 4.0, 'Value', 'Performance priced'),
    (171, 'Ogunmoyede Caroline', 'OGUN HORNS', 'HNS', 5, 'Rusher / DE', 'Rusher', 0.3151, 4.5, 'Value', 'Performance priced'),
    (172, 'Samuelmoses Tega', 'OGUN HORNS', 'HNS', 5, 'DB / CB', 'Defender', 0.8735, 11.0, 'Premium', 'Performance priced'),
    (173, 'Uwaje Emmanuel', 'OGUN HORNS', 'HNS', 5, 'Defense / LB', 'Defender', 0.203, 4.0, 'Value', 'Performance priced'),
    (174, 'Nnamdi Agu Nicholas', 'RIVERS ALPHAS', 'ALP', 5, 'WR', 'Receiver', 0.2579, 4.0, 'Value', 'Performance priced'),
    (175, 'Olawode Jumoke Princess', 'RIVERS ALPHAS', 'ALP', 5, 'WR', 'Receiver', 0.4931, 6.5, 'Core', 'Performance priced'),
    (176, 'Oluwatamilore Fashina', 'RIVERS ALPHAS', 'ALP', 5, 'QB', 'QB', 0.107, 3.5, 'Value', 'Performance priced'),
    (177, 'Olaide Jumai', 'ABIA WARRIORS', 'WAR', 4, 'WR', 'Receiver', 0.9015, 11.0, 'Premium', 'Performance priced'),
    (178, 'Amos Samuel', 'CROSS RIVER IKAN SPORTS', 'IKN', 4, 'WR', 'Receiver', 0.1957, 4.0, 'Value', 'Performance priced'),
    (179, 'Godswill Atibile', 'CROSS RIVER IKAN SPORTS', 'IKN', 4, 'WR', 'Receiver', 0.3171, 4.5, 'Value', 'Performance priced'),
    (180, 'Ugbah Benita', 'CROSS RIVER IKAN SPORTS', 'IKN', 4, 'WR', 'Receiver', 0.6055, 7.5, 'Starter', 'Performance priced'),
    (181, 'Ameerah Omotosho', 'DELTA BRAVES', 'BRV', 4, 'Rusher / DE', 'Rusher', 0.2212, 4.0, 'Value', 'Performance priced'),
    (182, 'Favour Uzochukwukwadoe Emechete', 'DELTA BRAVES', 'BRV', 4, 'WR', 'Receiver', 0.0742, 3.0, 'Minimum', 'Performance priced'),
    (183, 'Akinlade Gideon', 'DELTA PANTHERS', 'PAN', 4, 'Defense / LB', 'Defender', 0.2343, 4.0, 'Value', 'Performance priced'),
    (184, 'Blessing Ojonade Gabriel', 'DELTA PANTHERS', 'PAN', 4, 'WR', 'Receiver', 0.3551, 5.0, 'Value', 'Performance priced'),
    (185, 'Abdulateef Sheu', 'IBOM RAPTORS', 'RAP', 4, 'WR', 'Receiver', 0.5069, 6.5, 'Core', 'Performance priced'),
    (186, 'Gideon Danjuma', 'IBOM RAPTORS', 'RAP', 4, 'DB / CB', 'Defender', 0.2463, 4.0, 'Value', 'Performance priced'),
    (187, 'Iudoyibo Ifeoma Goodluck', 'LAGOS GREENBACKS', 'GBK', 4, 'WR', 'Receiver', 0.2185, 4.0, 'Value', 'Performance priced'),
    (188, 'Ogbuo Judy Mathews', 'LAGOS GREENBACKS', 'GBK', 4, 'WR', 'Receiver', 0.0894, 3.5, 'Value', 'Performance priced'),
    (189, 'Ali Abubakar', 'LAGOS KNIGHTS', 'LAK', 4, 'WR', 'Receiver', 0.4689, 6.0, 'Core', 'Performance priced'),
    (190, 'Deborah Nicholas', 'LAGOS KNIGHTS', 'LAK', 4, 'WR', 'Receiver', 0.3171, 4.5, 'Value', 'Performance priced'),
    (191, 'Mary Nwakiye', 'LAGOS KNIGHTS', 'LAK', 4, 'Rusher / DE', 'Rusher', 0.8394, 10.5, 'Premium', 'Performance priced'),
    (192, 'Billie Oyebanji', 'LAGOS REBELS', 'REB', 4, 'Defense / LB', 'Defender', 0.1385, 3.5, 'Value', 'Performance priced'),
    (193, 'Takim Agbor', 'LAGOS REBELS', 'REB', 4, 'Squad', 'Unclassified', 0.0667, 3.0, 'Minimum', 'Minimum: role review'),
    (194, 'Bakare Oyinlola', 'OGUN HORNS', 'HNS', 4, 'Defense / LB', 'Defender', 0.1505, 3.5, 'Value', 'Performance priced'),
    (195, 'Busayo Agubiade', 'OGUN HORNS', 'HNS', 4, 'DB / CB', 'Defender', 0.2941, 4.5, 'Value', 'Performance priced'),
    (196, 'George Success', 'OGUN HORNS', 'HNS', 4, 'Defense / LB', 'Defender', 0.2941, 4.5, 'Value', 'Performance priced'),
    (197, 'Ibrahim (Franklin) Raheem', 'OGUN HORNS', 'HNS', 4, 'DB / CB', 'Defender', 0.7012, 8.5, 'Starter', 'Performance priced'),
    (198, 'Afolabi Ogunnaike', 'RIVERS ALPHAS', 'ALP', 4, 'QB', 'QB', 0.35, 5.0, 'Value', 'Performance priced'),
    (199, 'Daniel Denzel Davies', 'RIVERS ALPHAS', 'ALP', 4, 'WR', 'Receiver', 0.7042, 8.5, 'Starter', 'Performance priced'),
    (200, 'Travis Akinwunmi', 'RIVERS ALPHAS', 'ALP', 4, 'WR', 'Receiver', 0.4233, 5.5, 'Core', 'Performance priced'),
    (201, 'Yusuf Olopoeniyan', 'RIVERS ALPHAS', 'ALP', 4, 'DB / CB', 'Defender', 0.6414, 8.0, 'Starter', 'Performance priced'),
    (202, 'Ates Brown', 'ABIA WARRIORS', 'WAR', 3, 'Defense', 'Defender', 0.074, 3.0, 'Minimum', 'Performance priced'),
    (203, 'Christopher Nwadike', 'ABIA WARRIORS', 'WAR', 3, 'WR', 'Receiver', 0.0803, 3.0, 'Minimum', 'Performance priced'),
    (204, 'Micheal Eyomi', 'ABIA WARRIORS', 'WAR', 3, 'WR', 'Receiver', 0.0803, 3.0, 'Minimum', 'Performance priced'),
    (205, 'Mistura Subair', 'ABIA WARRIORS', 'WAR', 3, 'Defense', 'Defender', 0.05, 3.0, 'Minimum', 'Performance priced'),
    (206, 'Abraham Jeremiah', 'CROSS RIVER IKAN SPORTS', 'IKN', 3, 'Squad', 'Unclassified', 0.05, 3.0, 'Minimum', 'Minimum: role review'),
    (207, 'Agbokeye Mayowa Parish', 'CROSS RIVER IKAN SPORTS', 'IKN', 3, 'Squad', 'Unclassified', 0.05, 3.0, 'Minimum', 'Minimum: role review'),
    (208, 'Clinton Angel Gift', 'CROSS RIVER IKAN SPORTS', 'IKN', 3, 'WR', 'Receiver', 0.4371, 5.5, 'Core', 'Performance priced'),
    (209, 'Kareem Suliat', 'CROSS RIVER IKAN SPORTS', 'IKN', 3, 'WR', 'Receiver', 0.4598, 6.0, 'Core', 'Performance priced'),
    (210, 'Ogene Ruth', 'CROSS RIVER IKAN SPORTS', 'IKN', 3, 'Defense', 'Defender', 0.1098, 3.5, 'Value', 'Performance priced'),
    (211, 'Omotayo Kehinde Samanja', 'CROSS RIVER IKAN SPORTS', 'IKN', 3, 'Defense', 'Defender', 0.074, 3.0, 'Minimum', 'Performance priced'),
    (212, 'Priscilla Jeremiah', 'CROSS RIVER IKAN SPORTS', 'IKN', 3, 'Squad', 'Unclassified', 0.05, 3.0, 'Minimum', 'Minimum: role review'),
    (213, 'Sejebor Michael', 'CROSS RIVER IKAN SPORTS', 'IKN', 3, 'Defense', 'Defender', 0.074, 3.0, 'Minimum', 'Performance priced'),
    (214, 'Victor Oluwapamilerin', 'CROSS RIVER IKAN SPORTS', 'IKN', 3, 'RB', 'Rusher', 0.05, 3.0, 'Minimum', 'Performance priced'),
    (215, 'Miracle .', 'DELTA BRAVES', 'BRV', 3, 'WR', 'Receiver', 0.4371, 5.5, 'Core', 'Performance priced'),
    (216, 'Moboluwaji Simeon', 'DELTA BRAVES', 'BRV', 3, 'QB', 'QB', 0.0973, 3.5, 'Value', 'Performance priced'),
    (217, 'Basit Muritala', 'DELTA PANTHERS', 'PAN', 3, 'DB / CB', 'Defender', 0.8042, 10.0, 'Premium', 'Performance priced'),
    (218, 'Daniel Nyaka', 'DELTA PANTHERS', 'PAN', 3, 'QB', 'QB', 0.6402, 8.0, 'Starter', 'Performance priced'),
    (219, 'Deba Osas', 'DELTA PANTHERS', 'PAN', 3, 'WR', 'Receiver', 0.0803, 3.0, 'Minimum', 'Performance priced'),
    (220, 'Farouk Lawal', 'DELTA PANTHERS', 'PAN', 3, 'Defense', 'Defender', 0.1458, 3.5, 'Value', 'Performance priced'),
    (221, 'Wilson Ademulegun', 'DELTA PANTHERS', 'PAN', 3, 'WR', 'Receiver', 0.05, 3.0, 'Minimum', 'Performance priced'),
    (222, 'Yinoluwa Olowofoyeku', 'DELTA PANTHERS', 'PAN', 3, 'WR', 'Receiver', 0.4143, 5.5, 'Core', 'Performance priced'),
    (223, 'Zakari Ojochegbe', 'DELTA PANTHERS', 'PAN', 3, 'WR', 'Receiver', 0.0803, 3.0, 'Minimum', 'Performance priced'),
    (224, 'Divine Nathaniel', 'IBOM RAPTORS', 'RAP', 3, 'Squad', 'Unclassified', 0.05, 3.0, 'Minimum', 'Minimum: role review'),
    (225, 'Praise Bukem', 'IBOM RAPTORS', 'RAP', 3, 'WR', 'Receiver', 0.0803, 3.0, 'Minimum', 'Performance priced'),
    (226, 'Alicho Christian', 'LAGOS GREENBACKS', 'GBK', 3, 'WR', 'Receiver', 0.1638, 3.5, 'Value', 'Performance priced'),
    (227, 'Emmanuel Udakpa', 'LAGOS GREENBACKS', 'GBK', 3, 'DB / CB', 'Defender', 0.876, 11.0, 'Premium', 'Performance priced'),
    (228, 'Mololuwa Tewogbade', 'LAGOS GREENBACKS', 'GBK', 3, 'Squad', 'Unclassified', 0.05, 3.0, 'Minimum', 'Minimum: role review'),
    (229, 'Simileoluwa Omoniyi', 'LAGOS GREENBACKS', 'GBK', 3, 'WR', 'Receiver', 0.5965, 7.5, 'Starter', 'Performance priced'),
    (230, 'Edgar Ayalogu', 'LAGOS KNIGHTS', 'LAK', 3, 'Defense', 'Defender', 0.1458, 3.5, 'Value', 'Performance priced'),
    (231, 'Mofiyinfoluwa Orojo', 'LAGOS REBELS', 'REB', 3, 'WR', 'Receiver', 0.4902, 6.5, 'Core', 'Performance priced'),
    (232, 'Peter Abah', 'LAGOS REBELS', 'REB', 3, 'WR', 'Receiver', 0.2246, 4.0, 'Value', 'Performance priced'),
    (233, 'Charles Franklin', 'OGUN HORNS', 'HNS', 3, 'DB / CB', 'Defender', 0.3733, 5.0, 'Value', 'Performance priced'),
    (234, 'Gbadamosi Mary', 'OGUN HORNS', 'HNS', 3, 'Defense', 'Defender', 0.3373, 5.0, 'Value', 'Performance priced'),
    (235, 'Abudu Fathia', 'RIVERS ALPHAS', 'ALP', 3, 'Defense', 'Defender', 0.05, 3.0, 'Minimum', 'Performance priced'),
    (236, 'Godswill Willie', 'RIVERS ALPHAS', 'ALP', 3, 'QB', 'QB', 0.475, 6.0, 'Core', 'Performance priced'),
    (237, 'Maverick Chukwuemeka', 'RIVERS ALPHAS', 'ALP', 3, 'QB', 'QB', 0.1681, 3.5, 'Value', 'Performance priced'),
    (238, 'Messi Nwobodo', 'RIVERS ALPHAS', 'ALP', 3, 'WR', 'Receiver', 0.3535, 5.0, 'Value', 'Performance priced'),
    (239, 'Ojone Akubo', 'RIVERS ALPHAS', 'ALP', 3, 'WR', 'Receiver', 0.4219, 5.5, 'Core', 'Performance priced'),
    (240, 'Quadri Odufuwa', 'RIVERS ALPHAS', 'ALP', 3, 'QB', 'QB', 0.3806, 5.0, 'Value', 'Performance priced'),
    (241, 'Robert Edidiong', 'RIVERS ALPHAS', 'ALP', 3, 'WR', 'Receiver', 0.5206, 6.5, 'Core', 'Performance priced'),
    (242, 'Adeniyi Ileri', 'ABIA WARRIORS', 'WAR', 2, 'Squad', 'Unclassified', 0.0333, 3.0, 'Minimum', 'Minimum: <3 games'),
    (243, 'Itua Victor', 'ABIA WARRIORS', 'WAR', 2, 'DB / CB', 'Defender', 0.6439, 3.0, 'Minimum', 'Minimum: <3 games'),
    (244, 'Ejelonu Favour', 'CROSS RIVER IKAN SPORTS', 'IKN', 2, 'WR', 'Receiver', 0.3749, 3.0, 'Minimum', 'Minimum: <3 games'),
    (245, 'Favour Ezemelie', 'CROSS RIVER IKAN SPORTS', 'IKN', 2, 'Squad', 'Unclassified', 0.0333, 3.0, 'Minimum', 'Minimum: <3 games'),
    (246, 'Oluwatimilehin Oloidi', 'CROSS RIVER IKAN SPORTS', 'IKN', 2, 'Defense', 'Defender', 0.5361, 3.0, 'Minimum', 'Minimum: <3 games'),
    (247, 'Great Okenwa', 'DELTA BRAVES', 'BRV', 2, 'Defense', 'Defender', 0.0932, 3.0, 'Minimum', 'Minimum: <3 games'),
    (248, 'Abdulsalam Afolabi', 'DELTA PANTHERS', 'PAN', 2, 'DB / CB', 'Defender', 0.3925, 3.0, 'Minimum', 'Minimum: <3 games'),
    (249, 'Fuad Lawal', 'DELTA PANTHERS', 'PAN', 2, 'WR', 'Receiver', 0.0409, 3.0, 'Minimum', 'Minimum: <3 games'),
    (250, 'Igwe Ebube', 'DELTA PANTHERS', 'PAN', 2, 'Squad', 'Unclassified', 0.0333, 3.0, 'Minimum', 'Minimum: <3 games'),
    (251, 'Gabriel Simon', 'IBOM RAPTORS', 'RAP', 2, 'WR', 'Receiver', 0.2686, 3.0, 'Minimum', 'Minimum: <3 games'),
    (252, 'Micheal Amajie', 'IBOM RAPTORS', 'RAP', 2, 'Squad', 'Unclassified', 0.0333, 3.0, 'Minimum', 'Minimum: <3 games'),
    (253, 'Oluwaseun Bamidele', 'IBOM RAPTORS', 'RAP', 2, 'Squad', 'Unclassified', 0.0333, 3.0, 'Minimum', 'Minimum: <3 games'),
    (254, 'Arigbabuwo Basirat Anuoluwapo', 'LAGOS GREENBACKS', 'GBK', 2, 'Squad', 'Unclassified', 0.0333, 3.0, 'Minimum', 'Minimum: <3 games'),
    (255, 'Ebube Daniel', 'LAGOS GREENBACKS', 'GBK', 2, 'Squad', 'Unclassified', 0.0333, 3.0, 'Minimum', 'Minimum: <3 games'),
    (256, 'Glaji Divine', 'LAGOS GREENBACKS', 'GBK', 2, 'WR', 'Receiver', 0.557, 3.0, 'Minimum', 'Minimum: <3 games'),
    (257, 'Ibikunle Mutiat', 'LAGOS GREENBACKS', 'GBK', 2, 'WR', 'Receiver', 0.5949, 3.0, 'Minimum', 'Minimum: <3 games'),
    (258, 'Taiwo Oluwashindara', 'LAGOS GREENBACKS', 'GBK', 2, 'WR', 'Receiver', 0.1092, 3.0, 'Minimum', 'Minimum: <3 games'),
    (259, 'Damilola Olalegan', 'LAGOS KNIGHTS', 'LAK', 2, 'Defense', 'Defender', 0.0932, 3.0, 'Minimum', 'Minimum: <3 games'),
    (260, 'Edith Eronini', 'LAGOS REBELS', 'REB', 2, 'Defense', 'Defender', 0.1171, 3.0, 'Minimum', 'Minimum: <3 games'),
    (261, 'Adisa Oluwatobiloba', 'OGUN HORNS', 'HNS', 2, 'QB', 'QB', 0.1041, 3.0, 'Minimum', 'Minimum: <3 games'),
    (262, 'Adebola Taiwo', 'RIVERS ALPHAS', 'ALP', 2, 'Defense', 'Defender', 0.0932, 3.0, 'Minimum', 'Minimum: <3 games'),
    (263, 'Faith Cletus Udofot', 'RIVERS ALPHAS', 'ALP', 2, 'QB', 'QB', 0.0806, 3.0, 'Minimum', 'Minimum: <3 games'),
    (264, 'Idongesit Godwin', 'RIVERS ALPHAS', 'ALP', 2, 'QB', 'QB', 0.3875, 3.0, 'Minimum', 'Minimum: <3 games'),
    (265, 'Michael Simon', 'RIVERS ALPHAS', 'ALP', 2, 'DB / CB', 'Defender', 0.6559, 3.0, 'Minimum', 'Minimum: <3 games'),
    (266, 'Mistura Subair', 'RIVERS ALPHAS', 'ALP', 2, 'QB', 'QB', 0.2458, 3.0, 'Minimum', 'Minimum: <3 games'),
    (267, 'Olusi Samson', 'RIVERS ALPHAS', 'ALP', 2, 'Squad', 'Unclassified', 0.0333, 3.0, 'Minimum', 'Minimum: <3 games'),
    (268, 'Utibe Udo Effiong', 'RIVERS ALPHAS', 'ALP', 2, 'WR', 'Receiver', 0.6101, 3.0, 'Minimum', 'Minimum: <3 games'),
    (269, 'Kadiri Ikhana', 'ABIA WARRIORS', 'WAR', 1, 'Squad', 'Unclassified', 0.0167, 3.0, 'Minimum', 'Minimum: <3 games'),
    (270, 'Noble Emmanuel', 'ABIA WARRIORS', 'WAR', 1, 'Squad', 'Unclassified', 0.0167, 3.0, 'Minimum', 'Minimum: <3 games'),
    (271, 'Anthony Rashid', 'CROSS RIVER IKAN SPORTS', 'IKN', 1, 'Squad', 'Unclassified', 0.0167, 3.0, 'Minimum', 'Minimum: <3 games'),
    (272, 'Bajomo Jumoke', 'CROSS RIVER IKAN SPORTS', 'IKN', 1, 'Squad', 'Unclassified', 0.0167, 3.0, 'Minimum', 'Minimum: <3 games'),
    (273, 'Chike Okala', 'CROSS RIVER IKAN SPORTS', 'IKN', 1, 'Squad', 'Unclassified', 0.0167, 3.0, 'Minimum', 'Minimum: <3 games'),
    (274, 'Mobolu Onigbanjo', 'CROSS RIVER IKAN SPORTS', 'IKN', 1, 'Squad', 'Unclassified', 0.0167, 3.0, 'Minimum', 'Minimum: <3 games'),
    (275, 'Okeowo Oyenike', 'CROSS RIVER IKAN SPORTS', 'IKN', 1, 'WR', 'Receiver', 0.1305, 3.0, 'Minimum', 'Minimum: <3 games'),
    (276, 'Adeoye Copeland Ayomide', 'DELTA BRAVES', 'BRV', 1, 'WR', 'Receiver', 0.8439, 3.0, 'Minimum', 'Minimum: <3 games'),
    (277, 'Jefferson Ibinabo', 'DELTA BRAVES', 'BRV', 1, 'QB', 'QB', 0.5834, 3.0, 'Minimum', 'Minimum: <3 games'),
    (278, 'Ochola .', 'DELTA BRAVES', 'BRV', 1, 'DB / CB', 'Defender', 0.8787, 3.0, 'Minimum', 'Minimum: <3 games'),
    (279, 'Apollo-James Angel', 'DELTA PANTHERS', 'PAN', 1, 'Defense', 'Defender', 0.0765, 3.0, 'Minimum', 'Minimum: <3 games'),
    (280, 'Blessing Tonkumor', 'DELTA PANTHERS', 'PAN', 1, 'Defense', 'Defender', 0.1125, 3.0, 'Minimum', 'Minimum: <3 games'),
    (281, 'Daniel Davies', 'DELTA PANTHERS', 'PAN', 1, 'Squad', 'Unclassified', 0.0167, 3.0, 'Minimum', 'Minimum: <3 games'),
    (282, 'Faith Madaki', 'DELTA PANTHERS', 'PAN', 1, 'DB / CB', 'Defender', 0.8188, 3.0, 'Minimum', 'Minimum: <3 games'),
    (283, 'Inidara Uwa', 'DELTA PANTHERS', 'PAN', 1, 'WR', 'Receiver', 0.1305, 3.0, 'Minimum', 'Minimum: <3 games'),
    (284, 'Jenrola Medoye', 'DELTA PANTHERS', 'PAN', 1, 'Squad', 'Unclassified', 0.0167, 3.0, 'Minimum', 'Minimum: <3 games'),
    (285, 'Mariam Ojo', 'DELTA PANTHERS', 'PAN', 1, 'Squad', 'Unclassified', 0.0167, 3.0, 'Minimum', 'Minimum: <3 games'),
    (286, 'Olatokunbo Sadiku', 'IBOM RAPTORS', 'RAP', 1, 'Squad', 'Unclassified', 0.0167, 3.0, 'Minimum', 'Minimum: <3 games'),
    (287, 'Promise Nicholas', 'IBOM RAPTORS', 'RAP', 1, 'Squad', 'Unclassified', 0.0167, 3.0, 'Minimum', 'Minimum: <3 games'),
    (288, 'Adedeji Damilare', 'LAGOS GREENBACKS', 'GBK', 1, 'Squad', 'Unclassified', 0.0167, 3.0, 'Minimum', 'Minimum: <3 games'),
    (289, 'Adenuga Temiloluwa', 'LAGOS GREENBACKS', 'GBK', 1, 'Squad', 'Unclassified', 0.0167, 3.0, 'Minimum', 'Minimum: <3 games'),
    (290, 'Adielle Melody', 'LAGOS GREENBACKS', 'GBK', 1, 'Squad', 'Unclassified', 0.0167, 3.0, 'Minimum', 'Minimum: <3 games'),
    (291, 'Arute-John Matthew', 'LAGOS GREENBACKS', 'GBK', 1, 'Squad', 'Unclassified', 0.0167, 3.0, 'Minimum', 'Minimum: <3 games'),
    (292, 'Gideon Samuel', 'LAGOS GREENBACKS', 'GBK', 1, 'Squad', 'Unclassified', 0.0167, 3.0, 'Minimum', 'Minimum: <3 games'),
    (293, 'Gregory Chidera Clement', 'LAGOS GREENBACKS', 'GBK', 1, 'Squad', 'Unclassified', 0.0167, 3.0, 'Minimum', 'Minimum: <3 games'),
    (294, 'Melody Adielle', 'LAGOS GREENBACKS', 'GBK', 1, 'WR', 'Receiver', 0.0242, 3.0, 'Minimum', 'Minimum: <3 games'),
    (295, 'Nicholas Deborah', 'LAGOS GREENBACKS', 'GBK', 1, 'Squad', 'Unclassified', 0.0167, 3.0, 'Minimum', 'Minimum: <3 games'),
    (296, 'Osasah Ejiro Anthonia', 'LAGOS GREENBACKS', 'GBK', 1, 'Squad', 'Unclassified', 0.0167, 3.0, 'Minimum', 'Minimum: <3 games'),
    (297, 'Samuel Gideon', 'LAGOS GREENBACKS', 'GBK', 1, 'Defense', 'Defender', 0.5914, 3.0, 'Minimum', 'Minimum: <3 games'),
    (298, 'Samuel Timilehin', 'LAGOS GREENBACKS', 'GBK', 1, 'DB / CB', 'Defender', 0.8787, 3.0, 'Minimum', 'Minimum: <3 games'),
    (299, 'Fagha Faloughi', 'LAGOS KNIGHTS', 'LAK', 1, 'Defense', 'Defender', 0.0765, 3.0, 'Minimum', 'Minimum: <3 games'),
    (300, 'Igwele Emmanuel', 'LAGOS REBELS', 'REB', 1, 'Defense', 'Defender', 0.2801, 3.0, 'Minimum', 'Minimum: <3 games'),
    (301, 'Isreal Ibitoye', 'LAGOS REBELS', 'REB', 1, 'WR', 'Receiver', 0.1305, 3.0, 'Minimum', 'Minimum: <3 games'),
    (302, 'Akpan Saviour', 'OGUN HORNS', 'HNS', 1, 'Squad', 'Unclassified', 0.0167, 3.0, 'Minimum', 'Minimum: <3 games'),
    (303, 'Amodu Taiwo', 'OGUN HORNS', 'HNS', 1, 'Squad', 'Unclassified', 0.0167, 3.0, 'Minimum', 'Minimum: <3 games'),
    (304, 'Donald Oguh', 'OGUN HORNS', 'HNS', 1, 'Defense', 'Defender', 0.0765, 3.0, 'Minimum', 'Minimum: <3 games'),
    (305, 'Kayode Ijeoma', 'OGUN HORNS', 'HNS', 1, 'Squad', 'Unclassified', 0.0167, 3.0, 'Minimum', 'Minimum: <3 games'),
    (306, 'Nwachukwu Divine', 'OGUN HORNS', 'HNS', 1, 'Squad', 'Unclassified', 0.0167, 3.0, 'Minimum', 'Minimum: <3 games'),
    (307, 'Tunde Tanko', 'OGUN HORNS', 'HNS', 1, 'WR', 'Receiver', 0.1305, 3.0, 'Minimum', 'Minimum: <3 games'),
    (308, 'Bawa Shitgurum', 'RIVERS ALPHAS', 'ALP', 1, 'Squad', 'Unclassified', 0.0167, 3.0, 'Minimum', 'Minimum: <3 games'),
    (309, 'Damilare Olapade', 'RIVERS ALPHAS', 'ALP', 1, 'Squad', 'Unclassified', 0.0167, 3.0, 'Minimum', 'Minimum: <3 games'),
    (310, 'Destiny Ataga', 'RIVERS ALPHAS', 'ALP', 1, 'WR', 'Receiver', 0.0167, 3.0, 'Minimum', 'Minimum: <3 games'),
    (311, 'Goddey Divine', 'RIVERS ALPHAS', 'ALP', 1, 'DB / CB', 'Defender', 0.8188, 3.0, 'Minimum', 'Minimum: <3 games'),
    (312, 'Kareem Balikis', 'RIVERS ALPHAS', 'ALP', 1, 'Squad', 'Unclassified', 0.0167, 3.0, 'Minimum', 'Minimum: <3 games'),
    (313, 'Peter Peekay', 'RIVERS ALPHAS', 'ALP', 1, 'Squad', 'Unclassified', 0.0167, 3.0, 'Minimum', 'Minimum: <3 games'),
    (314, 'Sheriff Idris', 'RIVERS ALPHAS', 'ALP', 1, 'Squad', 'Unclassified', 0.0167, 3.0, 'Minimum', 'Minimum: <3 games'),
    (315, 'daniel samuel', 'RIVERS ALPHAS', 'ALP', 1, 'Squad', 'Unclassified', 0.0167, 3.0, 'Minimum', 'Minimum: <3 games');

    -- 3. Ensure the 10 clubs exist in teams
    INSERT INTO teams (name, short_name, created_at, updated_at)
    SELECT DISTINCT t.team_name, t.team_code, NOW(), NOW()
    FROM tmp_player_pricing t
    WHERE NOT EXISTS (
        SELECT 1 FROM teams tm WHERE LOWER(TRIM(tm.name)) = LOWER(TRIM(t.team_name))
                                  OR UPPER(TRIM(COALESCE(tm.short_name, ''))) = UPPER(TRIM(t.team_code))
    );
    GET DIAGNOSTICS v_teams_created = ROW_COUNT;
    IF v_teams_created > 0 THEN
        RAISE NOTICE 'Created % new clubs in teams table', v_teams_created;
    END IF;

    -- 4. Match or create players
    INSERT INTO players (name, team_id, position, created_at, updated_at)
    SELECT DISTINCT ON (LOWER(TRIM(t.name)), tm.id)
           t.name, tm.id,
           CASE WHEN t.fantasy_position = 'Unclassified' THEN 'Defender' ELSE t.fantasy_position END,
           NOW(), NOW()
    FROM tmp_player_pricing t
    JOIN teams tm ON LOWER(TRIM(tm.name)) = LOWER(TRIM(t.team_name))
                  OR UPPER(TRIM(COALESCE(tm.short_name, ''))) = UPPER(TRIM(t.team_code))
    WHERE NOT EXISTS (
        SELECT 1 FROM players pl WHERE LOWER(TRIM(pl.name)) = LOWER(TRIM(t.name))
                                  AND (pl.team_id = tm.id OR pl.team_id IS NULL)
    )
    ORDER BY LOWER(TRIM(t.name)), tm.id, t.rank ASC;
    GET DIAGNOSTICS v_players_created = ROW_COUNT;
    IF v_players_created > 0 THEN
        RAISE NOTICE 'Created % new players in players table', v_players_created;
    END IF;

    -- 5. Upsert opening prices into fantasy_player_prices
    WITH matched_players AS (
        SELECT DISTINCT ON (t.rank)
            t.rank,
            t.final_price,
            t.composite_index,
            pl.id AS player_id
        FROM tmp_player_pricing t
        JOIN teams tm ON LOWER(TRIM(tm.name)) = LOWER(TRIM(t.team_name))
                      OR UPPER(TRIM(COALESCE(tm.short_name, ''))) = UPPER(TRIM(t.team_code))
        JOIN players pl ON LOWER(TRIM(pl.name)) = LOWER(TRIM(t.name))
                       AND (pl.team_id = tm.id OR pl.team_id IS NULL)
        ORDER BY t.rank, (pl.team_id = tm.id) DESC, pl.created_at ASC
    )
    INSERT INTO fantasy_player_prices (id, season_id, player_id, gameweek_id, base_price, rating, price, created_at)
    SELECT DISTINCT ON (m.player_id)
        gen_random_uuid(),
        v_season_id,
        m.player_id,
        NULL, -- opening season price
        m.final_price,
        ROUND(GREATEST(LEAST(m.composite_index * 10, 10.0), 3.0), 2),
        m.final_price,
        NOW()
    FROM matched_players m
    ORDER BY m.player_id, m.rank ASC
    ON CONFLICT (season_id, player_id) WHERE gameweek_id IS NULL
    DO UPDATE SET
        price = EXCLUDED.price,
        base_price = EXCLUDED.base_price,
        rating = EXCLUDED.rating,
        created_at = NOW();
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'Upserted % opening prices into fantasy_player_prices', v_count;

    -- 6. Restate existing squads and banks against new prices (if tables exist)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fantasy_squad_players') THEN
        UPDATE fantasy_squad_players sp
        SET purchase_price = COALESCE((
                SELECT pp.price FROM fantasy_player_prices pp
                WHERE pp.player_id = sp.player_id AND pp.season_id = v_season_id
                ORDER BY (pp.gameweek_id IS NULL), pp.created_at DESC LIMIT 1
            ), 3.00)
        FROM fantasy_teams ft
        WHERE ft.id = sp.team_id AND ft.season_id = v_season_id AND sp.sold_at IS NULL;
        GET DIAGNOSTICS v_squads_restated = ROW_COUNT;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fantasy_teams' AND column_name = 'bank') THEN
            UPDATE fantasy_teams ft
            SET bank = GREATEST(v_season_budget - COALESCE((
                    SELECT SUM(sp.purchase_price) FROM fantasy_squad_players sp
                    WHERE sp.team_id = ft.id AND sp.sold_at IS NULL), 0), 0)
            WHERE ft.season_id = v_season_id;
        END IF;

        IF v_squads_restated > 0 THEN
            RAISE NOTICE 'Restated % squad players and refreshed manager bank balances', v_squads_restated;
        END IF;
    END IF;
END $$;

COMMIT;