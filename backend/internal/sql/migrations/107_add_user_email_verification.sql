-- +goose Up
-- Migration 107: Email verification for user accounts.
--
-- Voting for Player of the Week needs a verified email so one person can't vote
-- many times through throwaway accounts. Users verify with a 6-digit code (the
-- otps table, purpose 'email_verify').

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- Accounts that already proved their email through an approved player claim
-- (the claim emailed them a verification link) count as verified.
UPDATE users u
SET email_verified_at = pc.email_verified_at
FROM player_claims pc
WHERE pc.user_id = u.id
  AND pc.email_verified_at IS NOT NULL
  AND LOWER(pc.claimed_email) = LOWER(u.email)
  AND u.email_verified_at IS NULL;

-- +goose Down
ALTER TABLE users DROP COLUMN IF EXISTS email_verified_at;
