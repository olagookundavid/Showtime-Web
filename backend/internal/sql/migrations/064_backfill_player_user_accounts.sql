-- +goose Up

-- 1. Link existing unlinked players to existing users with matching emails, and ensure role is 'player'
UPDATE players p
SET user_id = u.id
FROM users u
WHERE p.user_id IS NULL
  AND p.email IS NOT NULL
  AND TRIM(p.email) != ''
  AND LOWER(TRIM(p.email)) = LOWER(u.email);

UPDATE users u
SET role = 'player'
FROM players p
WHERE p.user_id = u.id
  AND u.role = 'user';

-- 2. Provision new user accounts for remaining unlinked players with emails
WITH inserted_users AS (
    INSERT INTO users (full_name, email, password_hash, role)
    SELECT 
        p.name,
        LOWER(TRIM(p.email)),
        decode('$2a$12$eGbaLqCJzXWSvT8JT7bZfOJv5Hq6uTvZ7u7apm/naxz05ehf0EdEO', 'escape'),
        'player'
    FROM players p
    WHERE p.user_id IS NULL
      AND p.email IS NOT NULL
      AND TRIM(p.email) != ''
      AND NOT EXISTS (
          SELECT 1 FROM users u2 WHERE LOWER(u2.email) = LOWER(TRIM(p.email))
      )
    ON CONFLICT (email) DO NOTHING
    RETURNING id, email
)
UPDATE players p
SET user_id = iu.id
FROM inserted_users iu
WHERE LOWER(TRIM(p.email)) = iu.email
  AND p.user_id IS NULL;

-- +goose Down
-- No-op for safety to preserve user data
