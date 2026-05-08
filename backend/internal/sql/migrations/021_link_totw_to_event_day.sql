-- +goose Up
-- Add event_day_id to link TOTW specifically to an event day
ALTER TABLE team_of_the_week
ADD COLUMN IF NOT EXISTS event_day_id UUID REFERENCES event_days(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_totw_event_day ON team_of_the_week(event_day_id);

-- Update existing entries by matching dates if possible
UPDATE team_of_the_week totw
SET event_day_id = ed.id
FROM event_days ed
WHERE totw.event_day_date = ed.date;

-- +goose Down
DROP INDEX IF EXISTS idx_totw_event_day;
ALTER TABLE team_of_the_week DROP COLUMN IF EXISTS event_day_id;
