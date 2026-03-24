-- Migration to add status to competitions

ALTER TABLE competitions
ADD COLUMN status VARCHAR(20) DEFAULT 'active' NOT NULL;
