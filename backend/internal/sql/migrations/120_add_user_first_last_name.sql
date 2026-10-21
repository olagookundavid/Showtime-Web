-- +goose Up
-- Migration 120: Separate first/last name on user accounts.
--
-- Signup now collects First Name and Last Name instead of one Full Name
-- field. Existing accounts have neither yet (NULL is the "needs to complete
-- their profile" signal the gate modal checks for) — no backfill by splitting
-- the current full_name, since that guess is unreliable. full_name itself is
-- untouched here; it stays the display name, and becomes
-- first_name + " " + last_name only when a user next registers or saves
-- their profile.

ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(255);

-- +goose Down
ALTER TABLE users DROP COLUMN IF EXISTS first_name;
ALTER TABLE users DROP COLUMN IF EXISTS last_name;
