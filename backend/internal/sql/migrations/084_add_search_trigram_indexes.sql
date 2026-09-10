-- +goose Up

-- Every text search in the app already goes through ILIKE '%term%' (see the
-- case-sensitivity sweep this migration follows from), but a leading-wildcard
-- ILIKE can never use a plain btree index — every one of these searches has
-- been a full table scan. pg_trgm's GIN indexes are what actually make
-- '%term%' ILIKE fast, and they speed up ILIKE regardless of wildcard
-- position, so this is the other half of "search should be ILIKE with a GIN
-- index" for every searched column in the app.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Players: name + position (admin/team-head roster search, contracts,
-- transfer market, fantasy market/pricing search).
CREATE INDEX IF NOT EXISTS idx_players_name_trgm ON players USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_players_position_trgm ON players USING gin (position gin_trgm_ops);

-- Teams: name + short_name (admin teams, match/competition search, contracts).
CREATE INDEX IF NOT EXISTS idx_teams_name_trgm ON teams USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_teams_short_name_trgm ON teams USING gin (short_name gin_trgm_ops);

-- Competitions: name (admin competitions, match search).
CREATE INDEX IF NOT EXISTS idx_competitions_name_trgm ON competitions USING gin (name gin_trgm_ops);

-- News: title/content/category/author (admin news search + category/author filters).
CREATE INDEX IF NOT EXISTS idx_news_title_trgm ON news USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_news_content_trgm ON news USING gin (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_news_category_trgm ON news USING gin (category gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_news_author_trgm ON news USING gin (author gin_trgm_ops);

-- Users: full_name + email (admin user search). Separate from the unique
-- LOWER(email) index added for uniqueness in the previous migration — that
-- one is for exact-match lookups (login), this one is for '%term%' search.
CREATE INDEX IF NOT EXISTS idx_users_full_name_trgm ON users USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_email_trgm ON users USING gin (email gin_trgm_ops);

-- Player claims: proposed_name + claimed_email (admin claims review search).
CREATE INDEX IF NOT EXISTS idx_player_claims_proposed_name_trgm ON player_claims USING gin (proposed_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_player_claims_claimed_email_trgm ON player_claims USING gin (claimed_email gin_trgm_ops);

-- Store products (current store) + inventory products (legacy/parallel
-- inventory system) — both are still searched independently.
CREATE INDEX IF NOT EXISTS idx_store_products_name_trgm ON store_products USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_inventory_products_name_trgm ON inventory_products USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_inventory_products_sku_trgm ON inventory_products USING gin (sku gin_trgm_ops);

-- Ticketing: event day title, ticket tier name (searched via the discount-
-- target picker; ticket_tiers has no "code" column, only access_code, which
-- is never searched), referral code name/code.
CREATE INDEX IF NOT EXISTS idx_event_days_title_trgm ON event_days USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ticket_tiers_name_trgm ON ticket_tiers USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ticket_referral_codes_name_trgm ON ticket_referral_codes USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ticket_referral_codes_code_trgm ON ticket_referral_codes USING gin (code gin_trgm_ops);

-- Fantasy: league name + invite code (admin fantasy leagues search).
CREATE INDEX IF NOT EXISTS idx_fantasy_leagues_name_trgm ON fantasy_leagues USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_fantasy_leagues_invite_code_trgm ON fantasy_leagues USING gin (invite_code gin_trgm_ops);

-- +goose Down
DROP INDEX IF EXISTS idx_fantasy_leagues_invite_code_trgm;
DROP INDEX IF EXISTS idx_fantasy_leagues_name_trgm;
DROP INDEX IF EXISTS idx_ticket_referral_codes_code_trgm;
DROP INDEX IF EXISTS idx_ticket_referral_codes_name_trgm;
DROP INDEX IF EXISTS idx_ticket_tiers_name_trgm;
DROP INDEX IF EXISTS idx_event_days_title_trgm;
DROP INDEX IF EXISTS idx_inventory_products_sku_trgm;
DROP INDEX IF EXISTS idx_inventory_products_name_trgm;
DROP INDEX IF EXISTS idx_store_products_name_trgm;
DROP INDEX IF EXISTS idx_player_claims_claimed_email_trgm;
DROP INDEX IF EXISTS idx_player_claims_proposed_name_trgm;
DROP INDEX IF EXISTS idx_users_email_trgm;
DROP INDEX IF EXISTS idx_users_full_name_trgm;
DROP INDEX IF EXISTS idx_news_author_trgm;
DROP INDEX IF EXISTS idx_news_category_trgm;
DROP INDEX IF EXISTS idx_news_content_trgm;
DROP INDEX IF EXISTS idx_news_title_trgm;
DROP INDEX IF EXISTS idx_competitions_name_trgm;
DROP INDEX IF EXISTS idx_teams_short_name_trgm;
DROP INDEX IF EXISTS idx_teams_name_trgm;
DROP INDEX IF EXISTS idx_players_position_trgm;
DROP INDEX IF EXISTS idx_players_name_trgm;
-- pg_trgm itself is left installed — harmless to keep, and DROP EXTENSION
-- would fail here anyway since nothing above uses CASCADE.
