#!/usr/bin/env python3
"""
Seed Showtime Fantasy Player Opening Prices from Showtime_Fantasy_Player_Pricing_Model.xlsx

This script reads the 314-player pricing workbook directly (using standard Python
built-in zipfile/xml libraries, requiring NO third-party packages like openpyxl or pandas)
and can:
  1. Generate ready-to-run idempotent SQL (--dump-sql or -o seed.sql)
  2. Pipe directly into psql: python3 scripts/seed_fantasy_prices.py --psql "$DATABASE_URL"
  3. Export clean JSON (--dump-json)
  4. Perform dry-run audit of tiers, prices, and clubs
"""

import argparse
import json
import os
import subprocess
import sys
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter


def extract_pricing_data(excel_path):
    if not os.path.exists(excel_path):
        raise FileNotFoundError(f"Pricing spreadsheet not found at: {excel_path}")

    with zipfile.ZipFile(excel_path, 'r') as z:
        s3_root = ET.fromstring(z.read('xl/worksheets/sheet3.xml'))
        s6_root = ET.fromstring(z.read('xl/worksheets/sheet6.xml'))
        ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

        def get_row(r):
            d = {}
            for c in r.findall('ns:c', ns):
                col = ''.join([ch for ch in c.attrib.get('r') if ch.isalpha()])
                v_elem = c.find('ns:v', ns)
                val = v_elem.text if v_elem is not None else None
                if val is None:
                    is_elem = c.find('ns:is', ns)
                    if is_elem is not None:
                        t_elem = is_elem.find('ns:t', ns)
                        if t_elem is not None:
                            val = t_elem.text
                d[col] = val
            return d

        rows3 = s3_root.findall('.//ns:row', ns)[4:]
        rows6 = s6_root.findall('.//ns:row', ns)[4:]

        players = []
        for i in range(len(rows3)):
            d3 = get_row(rows3[i])
            d6 = get_row(rows6[i])

            name = d3.get('B', '').strip()
            if not name:
                continue

            p = {
                'rank': int(d3.get('A', i + 1)),
                'name': name,
                'team_name': d3.get('C', '').strip(),
                'team_code': d3.get('D', '').strip(),
                'games_played': int(float(d3.get('E', 0))),
                'source_role': d3.get('F', '').strip(),
                'fantasy_position': d3.get('G', '').strip(),
                'passing_pts': float(d3.get('H', 0)),
                'rush_rec_pts': float(d3.get('I', 0)),
                'defence_pts': float(d3.get('J', 0)),
                'other_deductions': float(d3.get('K', 0)),
                'fantasy_pts': float(d3.get('L', 0)),
                'pts_per_game': float(d3.get('M', 0)),
                'position_percentile': float(d3.get('P', 0)),
                'availability': float(d3.get('Q', 0)),
                'composite_index': float(d3.get('R', 0)),
                'raw_price': float(d3.get('S', 0)),
                'final_price': float(d3.get('T', 0)),
                'price_tier': d3.get('U', '').strip(),
                'pricing_status': d3.get('V', '').strip(),
                'review_note': d3.get('W', '').strip() if d3.get('W') else None,
                'stats': {
                    'pass_att': int(float(d6.get('G', 0))),
                    'pass_comp': int(float(d6.get('H', 0))),
                    'pass_tds': int(float(d6.get('J', 0))),
                    'ints_thrown': int(float(d6.get('K', 0))),
                    'rush_att': int(float(d6.get('L', 0))),
                    'rush_tds': int(float(d6.get('M', 0))),
                    'receptions': int(float(d6.get('N', 0))),
                    'rec_tds': int(float(d6.get('O', 0))),
                    'drops': int(float(d6.get('P', 0))),
                    'total_tds': int(float(d6.get('Q', 0))),
                    'xp': int(float(d6.get('R', 0))),
                    'total_points_scored': int(float(d6.get('S', 0))),
                    'flag_pulls': int(float(d6.get('T', 0))),
                    'def_sacks': int(float(d6.get('U', 0))),
                    'interceptions': int(float(d6.get('V', 0))),
                    'pass_deflections': int(float(d6.get('W', 0))),
                    'def_tds': int(float(d6.get('X', 0))),
                    'def_xp_tds': int(float(d6.get('Y', 0))),
                    'safeties': int(float(d6.get('Z', 0))),
                    'qb_sacks_allowed': int(float(d6.get('AA', 0))),
                }
            }
            players.append(p)

    return players


def generate_sql(players, season_id=None, dry_run=False, restate_squads=True):
    lines = []
    lines.append('-- ====================================================================')
    lines.append('-- SHOWTIME FANTASY: PRODUCTION OPENING PRICES SEED')
    lines.append(f'-- Total Players: {len(players)} | Source: Showtime_Fantasy_Player_Pricing_Model.xlsx')
    lines.append('-- ====================================================================')
    lines.append('BEGIN;')
    lines.append('')
    lines.append('-- Ensure base tables and fantasy schema exist (idempotent DDL)')
    lines.append('CREATE TABLE IF NOT EXISTS competitions (')
    lines.append('    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),')
    lines.append('    name VARCHAR(255) NOT NULL,')
    lines.append('    logo TEXT,')
    lines.append('    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,')
    lines.append('    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP')
    lines.append(');')
    lines.append('')
    lines.append('CREATE TABLE IF NOT EXISTS teams (')
    lines.append('    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),')
    lines.append('    name VARCHAR(255) NOT NULL,')
    lines.append('    short_name VARCHAR(50),')
    lines.append('    logo TEXT,')
    lines.append('    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,')
    lines.append('    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP')
    lines.append(');')
    lines.append('')
    lines.append('CREATE TABLE IF NOT EXISTS players (')
    lines.append('    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),')
    lines.append('    name VARCHAR(255) NOT NULL,')
    lines.append('    jersey_number INT,')
    lines.append('    position VARCHAR(50),')
    lines.append('    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,')
    lines.append('    bio TEXT,')
    lines.append('    image TEXT,')
    lines.append('    email VARCHAR(255) NOT NULL DEFAULT \'\',')
    lines.append('    gender VARCHAR(1) CHECK (gender IN (\'M\', \'F\')),')
    lines.append('    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,')
    lines.append('    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP')
    lines.append(');')
    lines.append('')
    lines.append('CREATE TABLE IF NOT EXISTS fantasy_seasons (')
    lines.append('    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),')
    lines.append('    competition_id     UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,')
    lines.append('    name               TEXT NOT NULL,')
    lines.append('    squad_size         INT NOT NULL DEFAULT 14,')
    lines.append('    budget             NUMERIC(10,2) NOT NULL DEFAULT 100.00,')
    lines.append('    min_female_offense INT NOT NULL DEFAULT 3,')
    lines.append('    min_female_defense INT NOT NULL DEFAULT 3,')
    lines.append('    max_per_club       INT NOT NULL DEFAULT 4,')
    lines.append('    lock_mins_before   INT NOT NULL DEFAULT 15,')
    lines.append('    status             TEXT NOT NULL DEFAULT \'ACTIVE\' CHECK (status IN (\'DRAFT\', \'ACTIVE\', \'COMPLETED\')),')
    lines.append('    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),')
    lines.append('    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()')
    lines.append(');')
    lines.append('')
    lines.append('CREATE TABLE IF NOT EXISTS fantasy_player_prices (')
    lines.append('    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),')
    lines.append('    season_id   UUID NOT NULL REFERENCES fantasy_seasons(id) ON DELETE CASCADE,')
    lines.append('    player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,')
    lines.append('    gameweek_id UUID,')
    lines.append('    base_price  NUMERIC(10,2) NOT NULL DEFAULT 5.00,')
    lines.append('    rating      NUMERIC(4,2) NOT NULL DEFAULT 5.00,')
    lines.append('    price       NUMERIC(10,2) NOT NULL,')
    lines.append('    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),')
    lines.append('    UNIQUE(season_id, player_id, gameweek_id)')
    lines.append(');')
    lines.append('CREATE UNIQUE INDEX IF NOT EXISTS uix_fantasy_player_prices_opening')
    lines.append('    ON fantasy_player_prices (season_id, player_id)')
    lines.append('    WHERE gameweek_id IS NULL;')
    lines.append('')
    lines.append('DO $$')
    lines.append('DECLARE')
    lines.append('    v_comp_id UUID;')
    lines.append('    v_season_id UUID;')
    lines.append('    v_season_name TEXT;')
    lines.append('    v_season_budget NUMERIC(10,2);')
    lines.append('    v_count INT := 0;')
    lines.append('    v_teams_created INT := 0;')
    lines.append('    v_players_created INT := 0;')
    lines.append('    v_squads_restated INT := 0;')
    lines.append('BEGIN')
    lines.append('    -- Ensure at least one competition exists')
    lines.append('    SELECT id INTO v_comp_id FROM competitions ORDER BY created_at DESC LIMIT 1;')
    lines.append('    IF v_comp_id IS NULL THEN')
    lines.append('        INSERT INTO competitions (name, created_at, updated_at)')
    lines.append('        VALUES (\'Showtime Flag Football League\', NOW(), NOW())')
    lines.append('        RETURNING id INTO v_comp_id;')
    lines.append('        RAISE NOTICE \'Created default competition: %\', v_comp_id;')
    lines.append('    END IF;')
    lines.append('')
    if season_id:
        lines.append(f"    SELECT id, name, budget INTO v_season_id, v_season_name, v_season_budget FROM fantasy_seasons WHERE id = '{season_id}'::uuid;")
        lines.append(f"    IF v_season_id IS NULL THEN")
        lines.append(f"        RAISE EXCEPTION 'Specified season {season_id} not found';")
        lines.append(f"    END IF;")
    else:
        lines.append("    SELECT id, name, budget INTO v_season_id, v_season_name, v_season_budget FROM fantasy_seasons WHERE status IN ('ACTIVE', 'DRAFT') ORDER BY (status = 'ACTIVE') DESC, created_at DESC LIMIT 1;")
        lines.append("    IF v_season_id IS NULL THEN")
        lines.append("        INSERT INTO fantasy_seasons (competition_id, name, squad_size, budget, min_female_offense, min_female_defense, max_per_club, lock_mins_before, status, created_at, updated_at)")
        lines.append("        VALUES (v_comp_id, 'Showtime Fantasy Season 2026', 14, 100.00, 3, 3, 4, 15, 'ACTIVE', NOW(), NOW())")
        lines.append("        RETURNING id, name, budget INTO v_season_id, v_season_name, v_season_budget;")
        lines.append("        RAISE NOTICE 'Created default fantasy season: % (ID: %)', v_season_name, v_season_id;")
        lines.append("    END IF;")


    lines.append("    RAISE NOTICE 'Seeding % player opening prices for season: % (ID: %)', " + str(len(players)) + ", v_season_name, v_season_id;")
    lines.append('')
    lines.append('    -- 1. Create temporary staging table')
    lines.append('    CREATE TEMP TABLE tmp_player_pricing (')
    lines.append('        rank INT,')
    lines.append('        name TEXT,')
    lines.append('        team_name TEXT,')
    lines.append('        team_code TEXT,')
    lines.append('        games_played INT,')
    lines.append('        source_role TEXT,')
    lines.append('        fantasy_position TEXT,')
    lines.append('        composite_index NUMERIC,')
    lines.append('        final_price NUMERIC(10,2),')
    lines.append('        price_tier TEXT,')
    lines.append('        pricing_status TEXT')
    lines.append('    ) ON COMMIT DROP;')
    lines.append('')
    lines.append('    -- 2. Stage the 314 records')
    lines.append('    INSERT INTO tmp_player_pricing VALUES')

    val_chunks = []
    for p in players:
        name_esc = p['name'].replace("'", "''")
        team_esc = p['team_name'].replace("'", "''")
        role_esc = p['source_role'].replace("'", "''")
        pos_esc = p['fantasy_position'].replace("'", "''")
        tier_esc = p['price_tier'].replace("'", "''")
        stat_esc = p['pricing_status'].replace("'", "''")
        val_chunks.append(
            f"    ({p['rank']}, '{name_esc}', '{team_esc}', '{p['team_code']}', {p['games_played']}, '{role_esc}', '{pos_esc}', {p['composite_index']}, {p['final_price']}, '{tier_esc}', '{stat_esc}')"
        )

    lines.append(',\n'.join(val_chunks) + ';')
    lines.append('')
    lines.append('    -- 3. Ensure the 10 clubs exist in teams')
    lines.append('    INSERT INTO teams (name, short_name, created_at, updated_at)')
    lines.append('    SELECT DISTINCT t.team_name, t.team_code, NOW(), NOW()')
    lines.append('    FROM tmp_player_pricing t')
    lines.append('    WHERE NOT EXISTS (')
    lines.append('        SELECT 1 FROM teams tm WHERE LOWER(TRIM(tm.name)) = LOWER(TRIM(t.team_name))')
    lines.append('                                  OR UPPER(TRIM(COALESCE(tm.short_name, \'\'))) = UPPER(TRIM(t.team_code))')
    lines.append('    );')
    lines.append('    GET DIAGNOSTICS v_teams_created = ROW_COUNT;')
    lines.append("    IF v_teams_created > 0 THEN")
    lines.append("        RAISE NOTICE 'Created % new clubs in teams table', v_teams_created;")
    lines.append("    END IF;")
    lines.append('')
    lines.append('    -- 4. Match or create players')
    lines.append('    INSERT INTO players (name, team_id, position, created_at, updated_at)')
    lines.append('    SELECT t.name, tm.id,')
    lines.append('           CASE WHEN t.fantasy_position = \'Unclassified\' THEN \'Defender\' ELSE t.fantasy_position END,')
    lines.append('           NOW(), NOW()')
    lines.append('    FROM tmp_player_pricing t')
    lines.append('    JOIN teams tm ON LOWER(TRIM(tm.name)) = LOWER(TRIM(t.team_name))')
    lines.append('                  OR UPPER(TRIM(COALESCE(tm.short_name, \'\'))) = UPPER(TRIM(t.team_code))')
    lines.append('    WHERE NOT EXISTS (')
    lines.append('        SELECT 1 FROM players pl WHERE LOWER(TRIM(pl.name)) = LOWER(TRIM(t.name))')
    lines.append('    );')
    lines.append('    GET DIAGNOSTICS v_players_created = ROW_COUNT;')
    lines.append("    IF v_players_created > 0 THEN")
    lines.append("        RAISE NOTICE 'Created % new players in players table', v_players_created;")
    lines.append("    END IF;")
    lines.append('')
    lines.append('    -- 5. Upsert opening prices into fantasy_player_prices')
    lines.append('    INSERT INTO fantasy_player_prices (id, season_id, player_id, gameweek_id, base_price, rating, price, created_at)')
    lines.append('    SELECT')
    lines.append('        gen_random_uuid(),')
    lines.append('        v_season_id,')
    lines.append('        pl.id,')
    lines.append('        NULL, -- opening season price')
    lines.append('        t.final_price,')
    lines.append('        ROUND(GREATEST(LEAST(t.composite_index * 10, 10.0), 3.0), 2),')
    lines.append('        t.final_price,')
    lines.append('        NOW()')
    lines.append('    FROM tmp_player_pricing t')
    lines.append('    JOIN teams tm ON LOWER(TRIM(tm.name)) = LOWER(TRIM(t.team_name))')
    lines.append('                  OR UPPER(TRIM(COALESCE(tm.short_name, \'\'))) = UPPER(TRIM(t.team_code))')
    lines.append('    JOIN players pl ON (pl.team_id = tm.id OR pl.team_id IS NULL) AND LOWER(TRIM(pl.name)) = LOWER(TRIM(t.name))')
    lines.append('    ON CONFLICT (season_id, player_id) WHERE gameweek_id IS NULL')
    lines.append('    DO UPDATE SET')
    lines.append('        price = EXCLUDED.price,')
    lines.append('        base_price = EXCLUDED.base_price,')
    lines.append('        rating = EXCLUDED.rating,')
    lines.append('        created_at = NOW();')
    lines.append('    GET DIAGNOSTICS v_count = ROW_COUNT;')
    lines.append("    RAISE NOTICE 'Upserted % opening prices into fantasy_player_prices', v_count;")

    if restate_squads:
        lines.append('')
        lines.append('    -- 6. Restate existing squads and banks against new prices (if tables exist)')
        lines.append('    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = \'fantasy_squad_players\') THEN')
        lines.append('        UPDATE fantasy_squad_players sp')
        lines.append('        SET purchase_price = COALESCE((')
        lines.append('                SELECT pp.price FROM fantasy_player_prices pp')
        lines.append('                WHERE pp.player_id = sp.player_id AND pp.season_id = v_season_id')
        lines.append('                ORDER BY (pp.gameweek_id IS NULL), pp.created_at DESC LIMIT 1')
        lines.append('            ), 3.00)')
        lines.append('        FROM fantasy_teams ft')
        lines.append('        WHERE ft.id = sp.team_id AND ft.season_id = v_season_id AND sp.sold_at IS NULL;')
        lines.append('        GET DIAGNOSTICS v_squads_restated = ROW_COUNT;')
        lines.append('')
        lines.append('        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = \'fantasy_teams\' AND column_name = \'bank\') THEN')
        lines.append('            UPDATE fantasy_teams ft')
        lines.append('            SET bank = GREATEST(v_season_budget - COALESCE((')
        lines.append('                    SELECT SUM(sp.purchase_price) FROM fantasy_squad_players sp')
        lines.append('                    WHERE sp.team_id = ft.id AND sp.sold_at IS NULL), 0), 0)')
        lines.append('            WHERE ft.season_id = v_season_id;')
        lines.append('        END IF;')
        lines.append('')
        lines.append('        IF v_squads_restated > 0 THEN')
        lines.append('            RAISE NOTICE \'Restated % squad players and refreshed manager bank balances\', v_squads_restated;')
        lines.append('        END IF;')
        lines.append('    END IF;')

    lines.append('END $$;')
    lines.append('')

    if dry_run:
        lines.append('-- Dry run requested: Rolling back transaction')
        lines.append('ROLLBACK;')
    else:
        lines.append('COMMIT;')

    return '\n'.join(lines)


def print_summary(players):
    print("=" * 60)
    print("SHOWTIME FANTASY PRICING MODEL SUMMARY")
    print(f"Total Athletes: {len(players)}")
    print("=" * 60)

    tier_counts = Counter([p['price_tier'] for p in players])
    print("\nTier Breakdown:")
    for tier in ['Minimum', 'Value', 'Core', 'Starter', 'Premium', 'Elite']:
        print(f"  {tier:<10} : {tier_counts[tier]:>3} players")

    price_counts = Counter([p['final_price'] for p in players])
    print("\nPrice Distribution (SC):")
    for price in sorted(price_counts.keys()):
        print(f"  ₦{price:4.1f}m ({price:4.1f} SC) : {price_counts[price]:>3} players")

    club_counts = Counter([p['team_name'] for p in players])
    print(f"\nClubs ({len(club_counts)}):")
    for club, count in club_counts.most_common():
        print(f"  {club:<26} : {count:>2} players")
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(description="Seed Showtime Fantasy Player Opening Prices into Production")
    parser.add_argument(
        "--file",
        default=os.path.join(os.path.dirname(os.path.dirname(__file__)), "Showtime_Fantasy_Player_Pricing_Model.xlsx"),
        help="Path to Showtime_Fantasy_Player_Pricing_Model.xlsx"
    )
    parser.add_argument("--season-id", help="Target fantasy season UUID")
    parser.add_argument("--dry-run", action="store_true", help="Generate ROLLBACK transaction for dry-run inspection")
    parser.add_argument("--dump-sql", action="store_true", help="Print generated SQL to stdout")
    parser.add_argument("-o", "--output-sql", help="Write generated SQL to file")
    parser.add_argument("--dump-json", help="Export clean JSON to specified path")
    parser.add_argument("--psql", help="Directly pipe SQL into psql with given connection string or database name")
    parser.add_argument("--no-restate", action="store_true", help="Skip restating squad purchase prices and banks")

    args = parser.parse_args()

    players = extract_pricing_data(args.file)
    print_summary(players)

    if args.dump_json:
        with open(args.dump_json, 'w') as f:
            json.dump(players, f, indent=2)
        print(f"\n[✓] Exported clean JSON to: {args.dump_json}")

    sql = generate_sql(
        players,
        season_id=args.season_id,
        dry_run=args.dry_run,
        restate_squads=not args.no_restate
    )

    if args.output_sql:
        with open(args.output_sql, 'w') as f:
            f.write(sql)
        print(f"\n[✓] Saved SQL seed script to: {args.output_sql}")

    if args.dump_sql:
        print("\n--- GENERATED SQL ---")
        print(sql)

    if args.psql:
        print(f"\nExecuting SQL via psql against: {args.psql} ...")
        proc = subprocess.Popen(["psql", args.psql], stdin=subprocess.PIPE, text=True)
        proc.communicate(input=sql)
        if proc.returncode != 0:
            print(f"[!] psql exited with code {proc.returncode}")
            sys.exit(proc.returncode)
        print("[✓] psql execution completed successfully.")


if __name__ == '__main__':
    main()
