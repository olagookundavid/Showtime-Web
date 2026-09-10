-- +goose Up

-- users.email had a case-sensitive UNIQUE constraint while every read path
-- already matches it case-insensitively (LOWER(email) = LOWER($1) in
-- GetUserByEmail, login, ticket-by-email, player/user matching, etc.), so
-- "Bob@x.com" and "bob@x.com" could exist as two distinct rows today and
-- silently confuse the case-insensitive login path.
--
-- This fails loudly instead of silently merging data if two existing rows
-- would collide once lowercased — that has to be resolved by hand (decide
-- which account is canonical, per the query in the error message) before
-- this migration can proceed.
-- +goose StatementBegin
DO $$
DECLARE
    dupe_count INT;
BEGIN
    SELECT COUNT(*) INTO dupe_count FROM (
        SELECT LOWER(email) FROM users GROUP BY LOWER(email) HAVING COUNT(*) > 1
    ) d;
    IF dupe_count > 0 THEN
        RAISE EXCEPTION 'Cannot enforce case-insensitive email uniqueness: % email(s) collide once lowercased. Resolve manually first: SELECT id, email, created_at FROM users WHERE LOWER(email) IN (SELECT LOWER(email) FROM users GROUP BY LOWER(email) HAVING COUNT(*) > 1) ORDER BY LOWER(email);', dupe_count;
    END IF;
END $$;
-- +goose StatementEnd

-- Normalize stored casing so display/exports are consistent going forward.
-- Not required for correctness (every read already folds case) but avoids
-- e.g. the same person's email showing up capitalized in one place and not
-- another.
UPDATE users SET email = LOWER(email) WHERE email <> LOWER(email);

-- Drop the old case-sensitive constraint/index...
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
DROP INDEX IF EXISTS idx_users_email;

-- ...and replace it with a case-insensitive one, keeping the exact name
-- "users_email_key" so the existing duplicate-email error handling in
-- auth_repo.go:Register and claim_repo.go (both string-match
-- `duplicate key value violates unique constraint "users_email_key"`)
-- keeps working unchanged — Postgres's unique-violation error always names
-- the backing index, whether it was created via ADD CONSTRAINT or, as here,
-- a plain CREATE UNIQUE INDEX.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (LOWER(email));

-- +goose Down
DROP INDEX IF EXISTS users_email_key;
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
