-- +goose Up

-- 1. Snapshot columns: a ticket keeps a copy of its event/tier details so the
--    record stays meaningful even after the event day (and its tiers) are deleted.
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS event_title VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS event_date DATE;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS event_venue VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS tier_name VARCHAR(100) NOT NULL DEFAULT '';

-- 2. Backfill snapshots for existing tickets from the live event/tier rows.
UPDATE tickets t
SET event_title = COALESCE(ed.title, ''),
    event_date  = ed.date,
    event_venue = COALESCE(ed.venue, '')
FROM event_days ed
WHERE t.event_day_id = ed.id;

UPDATE tickets t
SET tier_name = COALESCE(tt.name, '')
FROM ticket_tiers tt
WHERE t.tier_id = tt.id;

-- 3. Allow the FK columns to become NULL once their parent is deleted.
ALTER TABLE tickets ALTER COLUMN event_day_id DROP NOT NULL;
ALTER TABLE tickets ALTER COLUMN tier_id DROP NOT NULL;

-- 4. Replace the ON DELETE CASCADE foreign keys with ON DELETE SET NULL so the
--    ticket row survives deletion of its event day / tier. Drop the existing
--    constraints by introspection so we don't depend on their generated names.
-- +goose StatementBegin
DO $$
DECLARE
    c RECORD;
BEGIN
    FOR c IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        WHERE rel.relname = 'tickets'
          AND con.contype = 'f'
          AND (
              con.conkey @> ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = rel.oid AND attname = 'event_day_id')]
              OR con.conkey @> ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = rel.oid AND attname = 'tier_id')]
          )
    LOOP
        EXECUTE format('ALTER TABLE tickets DROP CONSTRAINT %I', c.conname);
    END LOOP;
END $$;
-- +goose StatementEnd

ALTER TABLE tickets
    ADD CONSTRAINT tickets_event_day_id_fkey
    FOREIGN KEY (event_day_id) REFERENCES event_days(id) ON DELETE SET NULL;

ALTER TABLE tickets
    ADD CONSTRAINT tickets_tier_id_fkey
    FOREIGN KEY (tier_id) REFERENCES ticket_tiers(id) ON DELETE SET NULL;

-- +goose Down

ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_event_day_id_fkey;
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_tier_id_fkey;

-- Cascade-restore requires non-null FKs, so drop any rows orphaned while SET NULL was active.
DELETE FROM tickets WHERE event_day_id IS NULL OR tier_id IS NULL;

ALTER TABLE tickets ALTER COLUMN event_day_id SET NOT NULL;
ALTER TABLE tickets ALTER COLUMN tier_id SET NOT NULL;

ALTER TABLE tickets
    ADD CONSTRAINT tickets_event_day_id_fkey
    FOREIGN KEY (event_day_id) REFERENCES event_days(id) ON DELETE CASCADE;
ALTER TABLE tickets
    ADD CONSTRAINT tickets_tier_id_fkey
    FOREIGN KEY (tier_id) REFERENCES ticket_tiers(id) ON DELETE CASCADE;

ALTER TABLE tickets DROP COLUMN IF EXISTS event_title;
ALTER TABLE tickets DROP COLUMN IF EXISTS event_date;
ALTER TABLE tickets DROP COLUMN IF EXISTS event_venue;
ALTER TABLE tickets DROP COLUMN IF EXISTS tier_name;
